import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icon } from './ui.jsx';
export default function EndTripDialog({trip,pending,onClose,onEnded}){
  const ref=useRef(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const focused=document.activeElement;ref.current.showModal();return()=>focused?.focus();},[]);
  async function end(){setBusy(true);try{await api('/trips/'+trip._id+'/end',{});onEnded();}catch(e){setError(e.message);setBusy(false);}}
  return <dialog ref={ref} className="end-dialog" aria-labelledby="end-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><span className="end-icon"><Icon name="trip" size={28}/></span><h2 id="end-title">Ready to end this trip?</h2><p>Expenses and contributions will be locked. Everyone can still view the final balances and history.</p><p>Ask everyone to sync their pending expenses first. Unsynced payments cannot be added after the trip ends.</p>{pending>0&&<p className="error">You have {pending} payments still waiting for confirmation. Sync them first.</p>}{error&&<p className="error" role="alert">{error}</p>}<div><button className="secondary" disabled={busy} onClick={onClose}>Keep trip open</button><button className="primary" disabled={busy||pending>0||!navigator.onLine} onClick={end}>{busy?'Ending…':'End trip'}</button></div></dialog>;
}
