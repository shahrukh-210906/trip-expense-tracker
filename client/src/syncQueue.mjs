export function createQueueSync({ userId, store, send, onSynced = () => {}, onBusy = () => {}, lock = work => work() }) {
  let running = null, stopped = false;
  async function flush() {
    onBusy(true);
    try {
      while (!stopped) {
        const rows = (await store.listQueue(userId)).filter(row => row.state === 'pending').slice(0, 100);
        if (!rows.length || stopped) return;
        let result;
        try {
          result = await send(rows.map(row => row.entry));
          if (!Array.isArray(result.savedExpenses) || !Array.isArray(result.errors)) throw new Error('Sync response was incomplete. Your payments remain on this device.');
        } catch (error) {
          await store.updateQueue(userId, rows.map(row => ({ clientId: row.entry.clientId, state: 'pending', error: error.message })));
          return;
        }
        let retryLater = false, saved = false;
        const updates = rows.map(row => {
          const entry = row.entry;
          const receipt = result.savedExpenses.find(item => item.clientId === entry.clientId && item.tripId === entry.tripId && item.recordedBy === userId);
          if (receipt) { saved = true; return { clientId: entry.clientId, state: 'synced' }; }
          const rejection = result.errors.find(item => item.clientId === entry.clientId);
          if (!rejection || rejection.retryable) retryLater = true;
          return { clientId: entry.clientId, state: rejection && !rejection.retryable ? 'failed' : 'pending',
            error: rejection?.error || 'Waiting for server confirmation.' };
        });
        await store.updateQueue(userId, updates);
        if (saved && !stopped) onSynced();
        if (retryLater) return;
      }
    } finally { if (!stopped) onBusy(false); }
  }
  return {
    sync() {
      if (stopped) return Promise.resolve();
      if (!running) running = Promise.resolve().then(() => lock(flush)).finally(() => { running = null; });
      return running;
    },
    stop() { stopped = true; },
  };
}
