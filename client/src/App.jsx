import { useEffect, useRef, useState } from 'react';
import { useLiveTrip } from './useLiveTrip.js';
import { useOfflineQueue } from './useOfflineQueue.js';
import { cacheTrips, getCached } from './offlineStore.mjs';
import SyncQueue from './components/SyncQueue.jsx';
import InstallApp from './components/InstallApp.jsx';
import Tutorial from './components/Tutorial.jsx';
import Onboarding from './components/Onboarding.jsx';
import { Overview, LiveFeed } from './components/TripViews.jsx';
import { useNetwork } from './useNetwork.js';
import Balances from './components/Balances.jsx';
import Purse from './components/Purse.jsx';
import EndTripDialog from './components/EndTripDialog.jsx';
import ExpenseDialog from './components/ExpenseDialog.jsx';
import { Icon } from './components/ui.jsx';
import { api, getSession, clearSession } from './api.js';

const pages = { overview: 'Overview', feed: 'Live feed', balances: 'Settlement', purse: 'Kitty history' };

export default function App() {
  const [session, setSession] = useState(getSession);
  const [tripId, setTripId] = useState(() => localStorage.getItem('active-trip'));
  const [trips, setTrips] = useState([]);
  const { data, error, setError, status, reload, cached } = useLiveTrip(session, tripId);
  const offline = useOfflineQueue(session);
  const networkOffline = useNetwork();
  const queued = offline.rows.filter(row => row.entry.tripId === tripId);
  const selectedTrip = useRef(tripId);
  selectedTrip.current = tripId;
  const [page, setPage] = useState('overview');
  const [notice, setNotice] = useState('');
  const [ending,setEnding]=useState(false);
  const [entryKind, setEntryKind] = useState(null), [refreshing, setRefreshing] = useState(false);
  const userId = session?.user._id, lead = data?.trip.groupLeads.includes(userId);
  const name = id => data?.members.find(member => member._id === id)?.displayName || 'Traveler';
  function resetSession(){clearSession();setSession(null);setTripId(null);setTrips([]);setEntryKind(null);setEnding(false);setError('');}
  useEffect(()=>{window.addEventListener('session-expired',resetSession);return()=>window.removeEventListener('session-expired',resetSession);},[]);
  async function logout(){try{await api('/session',undefined,{method:'DELETE'});resetSession();}catch(error){setError(error.message);}}

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
    setTripId(id); setPage('overview'); setError(''); setNotice(''); setRefreshing(false);
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

  const disconnected=networkOffline || status==='offline' || cached;
  return <div className={'mobile-app '+(!session?'auth-shell':'')}>
    {session&&<header className="mobile-header"><button className="icon-button" aria-label={tripId?'Back to my trips':'My trips'} onClick={backToTrips}><Icon name={tripId?'back':'trip'}/></button><strong>{tripId?(data?.trip.name||'Your trip'):'triproam.'}</strong>{disconnected&&tripId?<span className="offline-badge" role="status"><Icon name="cloud" size={17}/>Offline Mode</span>:tripId&&<span className="connection-label" role="status">{status==='live'?'Live': 'Connecting…'}</span>}{tripId?<button className="icon-button" aria-label="Refresh trip" disabled={refreshing} onClick={()=>refresh()}><Icon name="refresh"/></button>:<button className="text-button" onClick={logout}>Sign out</button>}</header>}
    <main className="mobile-main">
      {error&&<p className="error" role="alert">{error}</p>}{offline.storageError&&<p className="error" role="alert">{offline.storageError}</p>}
      {!session||!tripId?<><Onboarding session={session} onSession={setSession} onJoinSuccess={selectTrip} trips={trips}/>{session&&<InstallApp/>}</>:!data?<div className="loading-state"><Icon name="trip" size={32}/><h1>{error?'Trip unavailable':'Loading your trip…'}</h1><button className="secondary" onClick={backToTrips}>Back to my trips</button></div>:<>
        <div className="mobile-page-heading"><span className="eyebrow">{page==='overview'?'TRIP OVERVIEW':'TRIP DETAILS'}</span><h1>{pages[page]}</h1></div>
        {(queued.length>0||disconnected)&&<SyncQueue rows={queued} cached={cached} busy={offline.busy} retry={offline.retry} sync={()=>{offline.sync();void refresh();}}/>}
        {data.trip.status==='ended'&&<div className="ended-banner"><Icon name="check"/>Trip ended · Final balances below</div>}
        {page==='overview'&&<Overview data={data} userId={userId} name={name} lead={lead} manage={()=>setEntryKind('expense')} history={()=>setPage('purse')} feed={()=>setPage('feed')}/>}
        {page==='feed'&&<LiveFeed data={data} rows={queued} name={name} userId={userId}/>}
        {page==='balances'&&<Balances data={data} userId={userId} name={name}/>}
        {page==='purse'&&<><button className="text-button" onClick={()=>setPage('overview')}><Icon name="back"/>Overview</button><Purse data={data} name={name}/></>}
        {page==='overview'&&lead&&data.trip.status!=='ended'&&<button className="end-trip-link" onClick={()=>setEnding(true)}>End trip<Icon name="arrow" size={16}/></button>}
        {page==='overview'&&<details className="trip-people"><summary><Icon name="users"/>{data.members.length} travelers · Invite friends<Icon name="down"/></summary><p>Share this trip PIN</p><code>{data.trip.joinCode}</code>{data.members.map(member=><div key={member._id}>{member.displayName}<small>{data.trip.groupLeads.includes(member._id)?'Group lead':'Member'}</small></div>)}</details>}
      </>}
      <Tutorial/>
    </main>
    {session&&tripId&&data&&<>{data.trip.status!=='ended'&&<button className="expense-fab" onClick={()=>setEntryKind('personal')}><Icon name="plus"/>Add expense</button>}<nav className="bottom-nav" aria-label="Trip navigation">{[['overview','Overview','trip'],['feed','Live Feed','expenses'],['balances','Settlement','balances']].map(([id,label,icon])=><button key={id} aria-current={(page===id||(id==='overview'&&page==='purse'))?'page':undefined} onClick={()=>{setPage(id);window.scrollTo({top:0,behavior:'instant'});}}><Icon name={icon}/><span>{label}</span></button>)}</nav></>}
    {notice&&<div className="toast" role="status"><Icon name="check"/>{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={()=>setNotice('')}><Icon name="close"/></button></div>}
    {ending&&data&&<EndTripDialog trip={data.trip} pending={queued.length} onClose={()=>setEnding(false)} onEnded={()=>{setEnding(false);setPage('balances');void refresh('Trip ended. Final balances are ready.');}}/>}
    {entryKind&&data&&data.trip.status!=='ended'&&<ExpenseDialog initialKind={entryKind} data={data} user={session.user} enqueue={offline.enqueue} onClose={()=>setEntryKind(null)} onSaved={saved}/>}
  </div>;
}
