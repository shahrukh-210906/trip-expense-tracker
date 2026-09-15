import { useEffect, useRef, useState } from 'react';
import * as store from './offlineStore.mjs';
import { createQueueSync } from './syncQueue.mjs';
import { api } from './api.js';

export function useOfflineQueue(session) {
  const [rows, setRows] = useState([]), [busy, setBusy] = useState(false), [storageError, setStorageError] = useState('');
  const engine = useRef(null);
  useEffect(() => {
    setRows([]); setBusy(false); setStorageError('');
    if (!session?.user?._id) return;
    let active = true;
    const userId = session.user._id;
    const failure = () => { if (active) setStorageError('Offline storage is unavailable. Keep this page open and check your browser storage settings.'); };
    const read = () => store.listQueue(userId).then(rows => { if (active) setRows(rows); }).catch(failure);
    const current = createQueueSync({ userId, store,
      send: entries => api('/expenses/sync', { offlineExpenses: entries }, { token: session.token }),
      onBusy: value => { if (active) setBusy(value); },
      onSynced: () => window.dispatchEvent(new Event('trip:sync-complete')),
      lock: work => navigator.locks ? navigator.locks.request('trip-sync:' + userId, { ifAvailable: true }, lock => lock ? work() : undefined) : work(),
    });
    engine.current = current;
    const sync = () => { if (navigator.onLine) void current.sync().catch(failure); };
    const unsubscribe = store.subscribeOffline(reason => {
      void read();
      if (reason === 'enqueue') sync();
      if (reason === 'synced') window.dispatchEvent(new Event('trip:sync-complete'));
    });
    window.addEventListener('online', sync);
    window.addEventListener('trip:connected', sync);
    const interval = setInterval(sync, 30000);
    void read(); sync();
    return () => {
      active = false; current.stop(); engine.current = null; unsubscribe(); clearInterval(interval);
      window.removeEventListener('online', sync); window.removeEventListener('trip:connected', sync);
    };
  }, [session?.token, session?.user?._id]);
  return { rows: rows.filter(row => row.userId === session?.user?._id), busy, storageError,
    enqueue: entry => store.enqueuePayment(session.user._id, entry),
    retry: clientId => store.retryPayment(session.user._id, clientId).catch(() => setStorageError('Could not retry this payment. Check your browser storage.')),
    sync: () => engine.current?.sync().catch(() => setStorageError('Could not access the saved queue. Try again.')),
  };
}
