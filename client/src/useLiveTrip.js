import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api.js';
import { createTripLoader } from './tripLoader.mjs';

export function useLiveTrip(session, tripId) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [status, setStatus] = useState('connecting');
  const loader = useRef(null);
  useEffect(() => {
    setData(null); setError(''); setStatus('connecting');
    if (!session?.token || !tripId) return;
    let active = true, retryTimer;
    const current = createTripLoader(() => api('/trips/' + tripId),
      snapshot => { setData(snapshot); setError(''); },
      error => setError(error.message));
    loader.current = current;
    const socket = io({ auth: { token: session.token, tripId }, autoConnect: false });
    socket.on('connect', () => {
      if (!active) return;
      setStatus('live');
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
    window.addEventListener('online', retry);
    window.addEventListener('offline', offline);
    socket.connect();
    void current.request();
    return () => {
      active = false; current.stop();
      clearTimeout(retryTimer);
      if (loader.current === current) loader.current = null;
      socket.removeAllListeners(); socket.disconnect();
      window.removeEventListener('online', retry); window.removeEventListener('offline', offline);
    };
  }, [session?.token, tripId]);
  return { data: data?.trip._id === tripId ? data : null, error, setError, status,
    reload: () => loader.current?.request() ?? Promise.resolve(false) };
}
