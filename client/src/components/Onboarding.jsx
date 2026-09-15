import {useState} from 'react';
import {api,saveSession} from '../api.js';
export default function Onboarding({session,onSession,onJoinSuccess,trips=[]}){
  const [mode,setMode]=useState('join'),[name,setName]=useState(''),[tripName,setTripName]=useState(''),
    [pin,setPin]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e){
    e.preventDefault();setError('');setBusy(true);
    try{
      if(!session){const result=await api('/session',{displayName:name});saveSession(result);onSession(result);}
      const result=await api('/trips/'+mode,mode==='create'?{name:tripName}:{joinCode:pin});
      onJoinSuccess(result.trip._id);
    }catch(error){setError(error.message)}finally{setBusy(false)}
  }
  return <div className="onboarding"><div className="intro"><span className="eyebrow">GOOD COMPANY. CLEAR BALANCES.</span>
    <h1>Enjoy the trip.<br/>We’ll keep the tabs.</h1><p>One place for your personal payments, shared costs, and the group purse.</p>
    <div className="journey-art" aria-hidden="true">↗</div></div><section className="card onboarding-card">
    <h2>{session?'Ready for the next adventure, '+session.user.displayName+'?':'Let’s get you on board'}</h2>
    {trips.length>0&&<div className="trip-list"><p>Your trips</p>{trips.map(t=><button key={t._id} onClick={()=>onJoinSuccess(t._id)}>{t.name} →</button>)}</div>}
    <div className="tabs"><button className={mode==='join'?'selected':''} onClick={()=>{setMode('join');setError('')}}>Join trip</button>
      <button className={mode==='create'?'selected':''} onClick={()=>{setMode('create');setError('')}}>Create trip</button></div>
    <form onSubmit={submit}>{!session&&<label>Your name<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Shahrukh"/></label>}
    {mode==='create'?<label>Trip name<input required maxLength={100} value={tripName} onChange={e=>setTripName(e.target.value)} placeholder="e.g. Goa with the gang"/></label>:
      <label>Trip code<input required pattern="[A-Za-z0-9]{6}" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.toUpperCase())} placeholder="A9B2X7"/></label>}
    {error&&<p className="error" role="alert">{error}</p>}
    <button className="primary full" disabled={busy}>{busy?'Connecting…':mode==='create'?'Create trip →':'Join the trip →'}</button>
    <small>Your traveler session stays in this browser. Use the same browser to return to your trips.</small>
    </form></section></div>;
}
