import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const requireClient = createRequire(new URL('../client/package.json', import.meta.url));
const fake = requireClient('fake-indexeddb');
globalThis.indexedDB = fake.indexedDB;
import * as store from '../client/src/offlineStore.mjs';
import { createQueueSync } from '../client/src/syncQueue.mjs';
after(() => store.closeOfflineStore());

const entry = fields => ({ clientId: randomUUID(), tripId: 'trip-a', ledger: 'personal', title: 'Offline lunch',
  amountPaise: 101, splitAmong: ['friend'], clientCreatedAt: new Date().toISOString(), ...fields });
const receipt = (userId, entry) => ({ ...entry, recordedBy: userId, _id: randomUUID() });
const snapshot = (userId, expenses = [], purseEntries = []) => ({ trip: { _id: 'trip-a', participants: [userId] }, expenses, purseEntries });

test('IndexedDB persists across reopen and isolates travelers and cached trips', async () => {
  const user = randomUUID(), other = randomUUID(), payment = entry();
  await store.enqueuePayment(user, payment);
  await store.cacheTrips(user, [{ _id: 'trip-a', name: 'Goa' }]);
  await store.saveTripSnapshot(user, snapshot(user));
  await store.closeOfflineStore();
  assert.deepEqual((await store.listQueue(user))[0].entry, payment);
  assert.deepEqual(await store.listQueue(other), []);
  assert.equal(await store.getCached(other, 'trip-a'), null);
  assert.equal((await store.getCached(user, 'trips'))[0].name, 'Goa');
  await assert.rejects(store.saveTripSnapshot(other, snapshot(user)));
  await store.forgetTrip(user, 'trip-a');
  assert.equal(await store.getCached(user, 'trip-a'), null);
  assert.equal((await store.listQueue(user)).length, 1);
});

test('enqueue retries are idempotent and cannot overwrite a different payment', async () => {
  const user = randomUUID(), payment = entry();
  await store.enqueuePayment(user, payment); await store.enqueuePayment(user, payment);
  assert.equal((await store.listQueue(user)).length, 1);
  await assert.rejects(store.enqueuePayment(user, { ...payment, amountPaise: 900 }));
  assert.equal((await store.listQueue(user))[0].entry.amountPaise, 101);
});

test('a lost response survives reload and retries the same ID without another charge', async () => {
  const userId = randomUUID(), payment = entry(), committed = new Map();
  await store.enqueuePayment(userId, payment);
  let loseResponse = true;
  const send = async entries => {
    for (const item of entries) if (!committed.has(item.clientId)) committed.set(item.clientId, receipt(userId, item));
    if (loseResponse) { loseResponse = false; throw new Error('Connection dropped after commit'); }
    return { savedExpenses: entries.map(item => committed.get(item.clientId)), errors: [] };
  };
  const first = createQueueSync({ userId, store, send });
  await first.sync(); first.stop(); await store.closeOfflineStore();
  assert.equal((await store.listQueue(userId))[0].state, 'pending');
  const recovered = createQueueSync({ userId, store, send });
  await recovered.sync();
  assert.equal(committed.size, 1);
  assert.equal((await store.listQueue(userId))[0].state, 'synced');
  await store.saveTripSnapshot(userId, snapshot(userId, [...committed.values()]));
  assert.deepEqual(await store.listQueue(userId), []);
});

test('partial rejection keeps failed entries visible while confirming accepted ones', async () => {
  const userId = randomUUID(), personal = entry(), purse = entry({ ledger: 'purse', kind: 'expense', title: 'Taxi' });
  await store.enqueuePayment(userId, personal); await store.enqueuePayment(userId, purse);
  const sync = createQueueSync({ userId, store, send: async () => ({ savedExpenses: [receipt(userId, personal)], errors: [
    { clientId: purse.clientId, error: 'Insufficient purse balance.', retryable: false },
  ] }) });
  await sync.sync();
  const rows = await store.listQueue(userId);
  assert.equal(rows.find(row => row.entry.clientId === personal.clientId).state, 'synced');
  assert.equal(rows.find(row => row.entry.clientId === purse.clientId).state, 'failed');
  assert.equal(rows.find(row => row.entry.clientId === purse.clientId).entry.amountPaise, 101);
  await store.retryPayment(userId, purse.clientId);
  const retry = createQueueSync({ userId, store, send: async entries => ({ savedExpenses: entries.map(item => receipt(userId, item)), errors: [] }) });
  await retry.sync();
  assert.ok((await store.listQueue(userId)).every(row => row.state === 'synced'));
});

test('transient or incomplete results preserve pending entries and do not spin', async () => {
  for (const result of [{ savedExpenses: [], errors: [] }, { savedExpenses: null }, { savedExpenses: [], errors: [{ retryable: true }] }]) {
    const userId = randomUUID(), payment = entry(); let sends = 0;
    await store.enqueuePayment(userId, payment);
    const sync = createQueueSync({ userId, store, send: async () => { sends++; return result; } });
    await sync.sync(); assert.equal(sends, 1);
    assert.equal((await store.listQueue(userId))[0].state, 'pending');
  }
});

test('late responses from another tab cannot downgrade or resurrect confirmed payments', async () => {
  const userId = randomUUID(), payment = entry();
  await store.enqueuePayment(userId, payment);
  await store.updateQueue(userId, [{ clientId: payment.clientId, state: 'synced' }]);
  await store.updateQueue(userId, [{ clientId: payment.clientId, state: 'pending', error: 'Old timeout' }]);
  assert.equal((await store.listQueue(userId))[0].state, 'synced');
  await store.saveTripSnapshot(userId, snapshot(userId, [receipt(userId, payment)]));
  await store.updateQueue(userId, [{ clientId: payment.clientId, state: 'synced' }]);
  assert.deepEqual(await store.listQueue(userId), []);
});

test('queue sync batches at 100 and coalesces simultaneous attempts', async () => {
  const userId = randomUUID();
  await Promise.all(Array.from({ length: 101 }, () => store.enqueuePayment(userId, entry())));
  const batches = [];
  const sync = createQueueSync({ userId, store, send: async entries => { batches.push(entries.length); return { savedExpenses: entries.map(e => receipt(userId, e)), errors: [] }; } });
  await Promise.all([sync.sync(), sync.sync()]);
  assert.deepEqual(batches, [100, 1]);
});

test('a held cross-tab lock does not start another sender', async () => {
  const userId = randomUUID(); let sends = 0;
  await store.enqueuePayment(userId, entry());
  const sync = createQueueSync({ userId, store, send: async () => { sends++; }, lock: async () => {} });
  await sync.sync(); assert.equal(sends, 0);
  assert.equal((await store.listQueue(userId))[0].state, 'pending');
});
