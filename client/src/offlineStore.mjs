const DB_NAME = 'trip-expenses-offline';
let opening;
const listeners = new Set();
const channel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('trip-offline') : null;
channel?.addEventListener('message', event => listeners.forEach(listener => listener(event.data)));
function changed(reason = 'change') { listeners.forEach(listener => listener(reason)); channel?.postMessage(reason); }
export function subscribeOffline(listener) { listeners.add(listener); return () => listeners.delete(listener); }

function database() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const outbox = db.createObjectStore('outbox', { keyPath: 'key' });
      outbox.createIndex('userId', 'userId');
      db.createObjectStore('snapshots', { keyPath: 'key' });
    };
    request.onerror = () => { opening = null; reject(request.error); };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); opening = null; };
      resolve(request.result);
    };
  });
  return opening;
}

async function transaction(stores, mode, work) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error('Offline storage could not save this payment.'));
    tx.onerror = () => {}; // Abort handles request and transaction failures together.
    try { work(tx, value => { result = value; }); } catch (error) { tx.abort(); reject(error); }
  });
}
const key = (userId, id) => `${userId}:${id}`;

export async function enqueuePayment(userId, entry) {
  if (!userId || !entry.clientId || !entry.tripId) throw new Error('A traveler, trip, and payment ID are required.');
  const row = { key: key(userId, entry.clientId), userId, entry, state: 'pending', error: '', queuedAt: Date.now() };
  await transaction(['outbox'], 'readwrite', tx => {
    const store = tx.objectStore('outbox'), request = store.get(row.key);
    request.onsuccess = () => {
      if (!request.result) store.add(row);
      else if (JSON.stringify(request.result.entry) !== JSON.stringify(entry)) tx.abort();
    };
  });
  changed('enqueue');
}
export function listQueue(userId) {
  return transaction(['outbox'], 'readonly', (tx, done) => {
    const request = tx.objectStore('outbox').index('userId').getAll(userId);
    request.onsuccess = () => done(request.result.sort((a, b) => a.queuedAt - b.queuedAt || a.key.localeCompare(b.key)));
  });
}
export async function updateQueue(userId, updates) {
  await transaction(['outbox'], 'readwrite', tx => {
    const store = tx.objectStore('outbox');
    for (const update of updates) {
      const request = store.get(key(userId, update.clientId));
      request.onsuccess = () => {
        const row = request.result;
        // A delayed tab must never resurrect a reconciled row or downgrade a receipt.
        if (row && (row.state !== 'synced' || update.state === 'synced')) {
          store.put({ ...row, state: update.state, error: update.error || '' });
        }
      };
    }
  });
  changed(updates.some(update => update.state === 'synced') ? 'synced' : 'change');
}
export async function retryPayment(userId, clientId) {
  await updateQueue(userId, [{ clientId, state: 'pending' }]); changed('enqueue');
}
export async function saveTripSnapshot(userId, snapshot) {
  if (!snapshot.trip.participants.includes(userId)) throw new Error('Cannot cache another traveler’s trip.');
  await transaction(['snapshots', 'outbox'], 'readwrite', tx => {
    tx.objectStore('snapshots').put({ key: key(userId, snapshot.trip._id), value: snapshot, savedAt: Date.now() });
    const outbox = tx.objectStore('outbox');
    for (const [ledger, entries] of [['personal', snapshot.expenses], ['purse', snapshot.purseEntries]]) {
      for (const entry of entries) {
        if (entry.recordedBy !== userId || !entry.clientId) continue;
        const request = outbox.get(key(userId, entry.clientId));
        request.onsuccess = () => {
          const row = request.result;
          if (row?.entry.tripId === snapshot.trip._id && row.entry.ledger === ledger) outbox.delete(row.key);
        };
      }
    }
  });
  changed();
}
export function getCached(userId, id) {
  return transaction(['snapshots'], 'readonly', (tx, done) => {
    const request = tx.objectStore('snapshots').get(key(userId, id));
    request.onsuccess = () => done(request.result?.value || null);
  });
}
export function cacheTrips(userId, trips) {
  return transaction(['snapshots'], 'readwrite', tx => tx.objectStore('snapshots').put({ key: key(userId, 'trips'), value: trips }));
}
export function forgetTrip(userId, tripId) {
  return transaction(['snapshots'], 'readwrite', tx => tx.objectStore('snapshots').delete(key(userId, tripId)));
}

// Useful for lifecycle tests; persisted data remains intact.
export async function closeOfflineStore() { if (opening) (await opening).close(); opening = null; }
