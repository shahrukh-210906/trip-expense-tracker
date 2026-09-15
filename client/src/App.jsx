import { useEffect, useRef, useState } from 'react';
import { useLiveTrip } from './useLiveTrip.js';
import { useOfflineQueue } from './useOfflineQueue.js';
import { cacheTrips, getCached } from './offlineStore.mjs';
import SyncQueue from './components/SyncQueue.jsx';
import Onboarding from './components/Onboarding.jsx';
import Expenses from './components/Expenses.jsx';
import Balances from './components/Balances.jsx';
import Purse from './components/Purse.jsx';
import ExpenseDialog from './components/ExpenseDialog.jsx';
import { Icon } from './components/ui.jsx';
import { api, getSession } from './api.js';

const pages = {
  expenses: { title: 'Expenses', description: 'Keep track of what you paid and who it was for.' },
  balances: { title: 'Your balances', description: 'See what you owe friends and what comes back to you.' },
  purse: { title: 'Group purse', description: 'Manage the money set aside for shared trip expenses.' },
};

export default function App() {
  const [session, setSession] = useState(getSession);
  const [tripId, setTripId] = useState(() => localStorage.getItem('active-trip'));
  const [trips, setTrips] = useState([]);
  const { data, error, setError, status, reload, cached } = useLiveTrip(session, tripId);
  const offline = useOfflineQueue(session);
  const queued = offline.rows.filter(row => row.entry.tripId === tripId);
  const selectedTrip = useRef(tripId);
  selectedTrip.current = tripId;
  const [page, setPage] = useState('expenses');
  const [notice, setNotice] = useState('');
  const [entryKind, setEntryKind] = useState(null), [refreshing, setRefreshing] = useState(false);
  const userId = session?.user._id, lead = data?.trip.groupLeads.includes(userId);
  const name = id => data?.members.find(member => member._id === id)?.displayName || 'Traveler';

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let fresh = false, hasCached = false, connectionFailed = false;
    void getCached(session.user._id, 'trips').then(trips => { if (!cancelled && !fresh && trips) { hasCached = true; setTrips(trips); if (connectionFailed) setError(''); } }).catch(() => {});
    api('/trips', undefined, { token: session.token }).then(result => {
      fresh = true;
      if (!cancelled) setTrips(result.trips);
      void cacheTrips(session.user._id, result.trips).catch(() => {});
    }).catch(error => { connectionFailed = error.retryable; if (!cancelled && (!hasCached || !error.retryable)) setError(error.message); });
    return () => { cancelled = true; };
  }, [session, tripId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  function selectTrip(id) {
    localStorage.setItem('active-trip', id);
    setTripId(id); setPage('expenses'); setError(''); setNotice(''); setRefreshing(false);
  }
  function backToTrips() {
    localStorage.removeItem('active-trip');
    setTripId(null); setError(''); setNotice(''); setRefreshing(false);
  }
  async function refresh(savedMessage) {
    const requestedTrip = tripId;
    setRefreshing(true);
    const success = await reload();
    if (selectedTrip.current !== requestedTrip) return;
    if (success) setNotice(savedMessage || 'Trip is up to date.');
    else if (savedMessage) setError('Your payment was saved. Refresh to load the updated trip.');
    setRefreshing(false);
  }
  function saved(message) { setEntryKind(null); setNotice(message); }

  return <div className={'app ' + (!tripId ? 'trip-picker' : '')}>
    <aside className="sidebar"><button className="brand" onClick={backToTrips} aria-label="Trip tracker home">trip<span>.</span></button>
      {tripId && data && <><button className="trip-switcher" onClick={backToTrips}><span className="trip-mark"><Icon name="trip"/></span><span><small>CURRENT TRIP</small><strong>{data.trip.name}</strong></span><Icon name="down" size={16}/></button>
        <nav aria-label="Trip navigation">{[['expenses', 'Expenses', 'Your payments & activity'], ['balances', 'Balances', 'Who owes whom'], ...(lead ? [['purse', 'Group purse', 'Shared trip funds']] : [])].map(([id, label, description]) =>
          <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => { setPage(id); setNotice(''); }}><Icon name={id}/><span><strong>{label}</strong><small>{description}</small></span></button>)}</nav>
        <div className="sidebar-note"><small>Expenses and balances update automatically.</small></div></>}
      <div className="profile"><span className="avatar">{(session?.user.displayName || 'T').slice(0, 1)}</span><span><strong>{session?.user.displayName || 'Welcome, traveler'}</strong><small>{data && tripId ? lead ? 'Group lead' : 'Traveler' : 'Your travel companion'}</small></span></div>
    </aside>
    <main>
      {tripId && data && <header className="trip-header"><span className="trip-breadcrumb"><Icon name="trip" size={16}/>{data.trip.name}</span><div className="header-tools"><details className="invite"><summary><Icon name="users" size={17}/>{data.members.length} {data.members.length === 1 ? 'traveler' : 'travelers'}<Icon name="down" size={14}/></summary><div className="invite-content"><strong>Invite a friend</strong><p>Ask them to choose Join trip and enter this code.</p><code>{data.trip.joinCode}</code><div className="member-list">{data.members.map(member => <div key={member._id}>{member.displayName}<small>{data.trip.groupLeads.includes(member._id) ? 'Group lead' : 'Traveler'}</small></div>)}</div></div></details>
        <span className={'live-status ' + (cached ? 'offline' : status)} role="status"><span className="status-dot"/>{error ? 'Refresh needed' : cached ? 'Saved copy' : status === 'live' ? 'Live' : status === 'connecting' ? 'Connecting' : status === 'offline' ? 'Offline' : status === 'unavailable' ? 'Live unavailable' : 'Reconnecting'}</span>
        <button className="icon-button" aria-label="Refresh trip" title="Refresh trip" disabled={refreshing} onClick={() => refresh()}><Icon name="refresh"/></button></div></header>}
      {error && <div className="error" role="alert">{error}{tripId && <button className="text-button" disabled={refreshing} onClick={() => refresh()}>Try again</button>}</div>}
      {offline.storageError && <div className="error" role="alert">{offline.storageError}</div>}
      {!tripId ? <Onboarding session={session} onSession={setSession} onJoinSuccess={selectTrip} trips={trips}/> : !data ? <div className="loading-state"><Icon name="trip" size={32}/><h1>{error ? 'Let’s get you back to your trip' : 'Loading your trip…'}</h1><button className="secondary" onClick={backToTrips}>Back to my trips</button></div> : <>
        <div className="page-heading"><div><span className="eyebrow">{page === 'purse' ? 'FOR GROUP LEADS' : 'YOUR TRIP, AT A GLANCE'}</span><h1>{pages[page].title}</h1><p>{pages[page].description}</p></div>
          <button className="primary" disabled={refreshing} onClick={() => setEntryKind(page === 'purse' ? 'expense' : 'personal')}><Icon name="plus" size={18}/>{page === 'purse' ? 'Record purse spending' : 'Add expense'}</button></div>
        {(queued.length > 0 || cached || status === 'offline') && <SyncQueue rows={queued} cached={cached} busy={offline.busy} retry={offline.retry} sync={() => { offline.sync(); void refresh(); }}/>}
        {page === 'expenses' && <Expenses data={data} userId={userId} name={name}/>}
        {page === 'balances' && <Balances data={data} userId={userId} name={name}/>}
        {page === 'purse' && lead && <Purse data={data} name={name}/>}
      </>}
    </main>
    {notice && <div className="toast" role="status"><Icon name="check" size={18}/>{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><Icon name="close" size={16}/></button></div>}
    {entryKind && data && <ExpenseDialog initialKind={entryKind} data={data} user={session.user} enqueue={offline.enqueue} onClose={() => setEntryKind(null)} onSaved={saved}/>}
  </div>;
}
