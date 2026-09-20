import { useEffect, useState } from 'react';
import { api, saveSession } from '../api.js';
import { Icon } from './ui.jsx';
import { googleLogin, prepareGoogleLogin } from '../google.js';
export default function Onboarding({session,onSession,onJoinSuccess,trips=[]}){
 const [pin,setPin]=useState(''),[tripName,setTripName]=useState(''),[create,setCreate]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{void prepareGoogleLogin().catch(()=>{});},[]);
 async function login(){setBusy(true);setError('');try{const result=await googleLogin(Boolean(session));saveSession(result);onSession(result);}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function submit(event,mode){event.preventDefault();setBusy(true);setError('');try{const result=await api('/trips/'+mode,mode==='join'?{joinCode:pin}:{name:tripName});onJoinSuccess(result.trip._id);}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!session)return <section className="minimal-login"><div className="login-logo" aria-label="Triproam"><span className="logo-mark"><Icon name="trip" size={34}/></span><h1>triproam<span>.</span></h1></div><button className="google-button" disabled={busy} onClick={login}>{busy?'Connecting…':'Continue with Google'}<Icon name="arrow"/></button>{error&&<p className="error" role="alert">{error}</p>}</section>;
 return <section className="dashboard"><div className="dashboard-title"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>My trips</h1><p>Hey {session.user.displayName.split(' ')[0]}, where to next?</p></div>
 <form className="join-strip" onSubmit={e=>submit(e,'join')}><label htmlFor="trip-pin">Join a trip with a PIN</label><div><input id="trip-pin" required pattern="[A-Za-z0-9]{6}" minLength={6} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck="false" value={pin} placeholder="A9B2X7" onChange={e=>setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}/><button className="primary" disabled={busy||pin.length!==6}>Join<Icon name="arrow" size={18}/></button></div></form>
 {error&&<p className="error" role="alert">{error}</p>}
 {!session.user.googleLinked&&<button className="secondary" disabled={busy} onClick={login}>Link Google to keep your trips</button>}
 <div className="section-heading"><h2 className="section-title">Trips <span className="count-tag">{trips.length}</span></h2><button className="text-button" aria-expanded={create} onClick={()=>setCreate(!create)}><Icon name="plus" size={18}/>New trip</button></div>
 {create&&<form className="create-trip-card" onSubmit={e=>submit(e,'create')}><label>Trip name<input autoFocus required maxLength={100} value={tripName} onChange={e=>setTripName(e.target.value)} placeholder="e.g. A weekend in Goa"/></label><button className="primary" disabled={busy}>Create trip<Icon name="arrow"/></button></form>}
 <div className="adventure-list">{trips.map((trip,index)=><button className="adventure-card" key={trip._id} onClick={()=>onJoinSuccess(trip._id)}><span className={'adventure-art tone-'+index%3}><Icon name="trip" size={28}/></span><span><strong>{trip.name}</strong><small>{trip.status==='ended'?'Ended':'Active'} · {trip.participants?.length||1} travelers · {trip.groupLeads.includes(session.user._id)?'Group lead':'Member'}</small></span><Icon name="arrow"/></button>)}</div>
 {!trips.length&&<div className="friendly-empty"><Icon name="trip" size={36}/><h2>No trips yet</h2><p>Create your first trip, or join friends with their PIN.</p><button className="primary" onClick={()=>setCreate(true)}>Create a trip<Icon name="plus"/></button></div>}
 </section>;
}
