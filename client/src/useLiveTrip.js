import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api.js';
import { createTripLoader } from './tripLoader.mjs';
import { getCached, saveTripSnapshot, forgetTrip } from './offlineStore.mjs';

export function useLiveTrip(session, tripId) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [status, setStatus] = useState('connecting');
  const [cached, setCached] = useState(false);
  const loader = useRef(null);
  useEffect(() => {
    setData(null); setError(''); setStatus('connecting'); setCached(false);
    if (!session?.token || !tripId) return;
    let active = true, retryTimer, receivedFresh = false, accessDenied = false, hasSnapshot = false, connectionFailed = false;
    void getCached(session.user._id, tripId).then(snapshot => {
      if (active && !receivedFresh && !accessDenied && snapshot) { hasSnapshot = true; setData(snapshot); setCached(true); if (connectionFailed) setError(''); }
    }).catch(() => {});
    const current = createTripLoader(() => api('/trips/' + tripId, undefined, { token: session.token }),
      snapshot => {
        receivedFresh = true; hasSnapshot = true; setData(snapshot); setError(''); setCached(false);
        void saveTripSnapshot(session.user._id, snapshot).catch(() => { if (active) setError('Trip loaded, but offline storage is unavailable in this browser.'); });
      },
      error => {
        if ([401, 403, 404].includes(error.status)) {
          accessDenied = true; setData(null); setError(error.message);
          void forgetTrip(session.user._id, tripId).catch(() => {});
        } else { connectionFailed = error.retryable; setCached(true); setError(hasSnapshot && error.retryable ? '' : error.message); }
      });
    loader.current = current;
    const socket = io({ auth: { token: session.token, tripId }, autoConnect: false });
    socket.on('connect', () => {
      if (!active) return;
      setStatus('live');
      window.dispatchEvent(new Event('trip:connected'));
      // Fetch after every subscription/reconnect, including changes missed offline.
      void current.request();
    });
    socket.on('trip:changed', event => { if (event?.tripId === tripId) void current.request(); });
    socket.on('disconnect', () => { if (active) setStatus(navigator.onLine ? 'reconnecting' : 'offline'); });
    socket.on('connect_error', error => {
      if (!active) return;
      setStatus(navigator.onLine ? socket.active ? 'reconnecting' : 'unavailable' : 'offline');
      // Socket.IO retries transport failures, but middleware failures need an explicit retry.
      if (!socket.active && error.message === 'Trip updates are unavailable.') {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { if (active) socket.connect(); }, 5000);
      }
    });
    const retry = () => { if (!socket.connected) socket.connect(); void current.request(); };
    const offline = () => setStatus('offline');
    const syncComplete = () => void current.request();
    window.addEventListener('online', retry);
    window.addEventListener('offline', offline);
    window.addEventListener('trip:sync-complete', syncComplete);
    socket.connect();
    void current.request();
    return () => {
      active = false; current.stop();
      clearTimeout(retryTimer);
      if (loader.current === current) loader.current = null;
      socket.removeAllListeners(); socket.disconnect();
      window.removeEventListener('online', retry); window.removeEventListener('offline', offline);
      window.removeEventListener('trip:sync-complete', syncComplete);
    };
  }, [session?.token, tripId]);
  return { data: data?.trip._id === tripId ? data : null, error, setError, status, cached,
    reload: () => loader.current?.request() ?? Promise.resolve(false) };
}
