import {useEffect,useRef,useState} from 'react';
import Onboarding from './components/Onboarding.jsx';
import {api,getSession} from './api.js';
const money=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(value/100);
export default function App(){
  const [session,setSession]=useState(getSession),[tripId,setTripId]=useState(()=>localStorage.getItem('active-trip')),
    [data,setData]=useState(null),[trips,setTrips]=useState([]),[page,setPage]=useState('overview'),
    [error,setError]=useState(''),[notice,setNotice]=useState(''),[showForm,setShowForm]=useState(false);
  const [kind,setKind]=useState('personal'),[title,setTitle]=useState(''),[amount,setAmount]=useState(''),
    [people,setPeople]=useState([]),[saving,setSaving]=useState(false),[formError,setFormError]=useState('');
  const pending=useRef(null),dialog=useRef(null);
  const userId=session?.user._id,lead=data?.trip.groupLeads.includes(userId);
  const name=id=>data?.members.find(m=>m._id===id)?.displayName||'Traveler';
  async function refresh(id=tripId){const result=await api('/trips/'+id);setData(result);return result}
  useEffect(()=>{
    if(!session)return;
    let cancelled=false;
    api('/trips').then(result=>{if(!cancelled)setTrips(result.trips)}).catch(e=>{if(!cancelled)setError(e.message)});
    return()=>{cancelled=true};
  },[session,tripId]);
  useEffect(()=>{
    if(!session||!tripId)return;
    let cancelled=false;
    setData(null);setError('');
    api('/trips/'+tripId).then(result=>{if(!cancelled)setData(result)}).catch(e=>{if(!cancelled)setError(e.message)});
    return()=>{cancelled=true};
  },[session,tripId]);
  useEffect(()=>{if(showForm)dialog.current?.showModal();else dialog.current?.close()},[showForm]);
  function selectTrip(id){localStorage.setItem('active-trip',id);setTripId(id);setPage('overview');setError('')}
  function openEntry(next='personal'){
    setKind(next);setTitle('');setAmount('');setPeople([userId]);setFormError('');pending.current=null;setShowForm(true);
  }
  async function save(e){
    e.preventDefault();setFormError('');
    if(!/^\d+(\.\d{1,2})?$/.test(amount))return setFormError('Enter an amount with at most two decimal places.');
    const amountPaise=Math.round(Number(amount)*100);
    if(!Number.isSafeInteger(amountPaise)||amountPaise<=0||amountPaise>1000000000)return setFormError('Enter an amount between ₹0.01 and ₹1,00,00,000.');
    if(kind==='personal'&&!people.length)return setFormError('Choose at least one beneficiary.');
    const body={tripId,ledger:kind==='personal'?'personal':'purse',amountPaise,
      title:kind==='contribution'?'Contribution to group purse':title.trim(),
      ...(kind==='personal'?{splitAmong:people}:{kind})};
    if(!body.title)return setFormError('Enter a description.');
    const signature=JSON.stringify(body);
    if(!pending.current||pending.current.signature!==signature)
      pending.current={signature,entry:{...body,clientId:crypto.randomUUID(),clientCreatedAt:new Date().toISOString()}};
    setSaving(true);
    try{
      const result=await api('/expenses/sync',{offlineExpenses:[pending.current.entry]});
      if(result.errors.length)throw new Error(result.errors[0].error);
      setShowForm(false);pending.current=null;setNotice('Payment recorded.');
      try{await refresh()}catch{setError('Saved successfully. Refresh to load the updated balance.')}
    }catch(e){setFormError(e.message)}finally{setSaving(false)}
  }
  const expenseRows=entries=>entries.length?entries.map(e=><div className="row" key={e._id}><div className="icon">↗</div>
    <div className="row-body"><strong>{e.title}</strong><small>{name(e.recordedBy)} · {e.splitAmong?e.splitAmong.map(name).join(', '):e.kind}
    {e.splitAmong?.length===1&&e.splitAmong[0]===e.recordedBy?' · Private':''}</small></div><strong>{money(e.amountPaise)}</strong></div>):<p className="empty">No payments yet. Add your first one when you’re ready.</p>;
  const balances=data?.transactions.filter(t=>t.from===userId||t.to===userId)||[];
  const paid=data?.expenses.filter(e=>e.recordedBy===userId).reduce((sum,e)=>sum+e.amountPaise,0)||0;
  return <div className="app"><aside><a className="brand" href="/" onClick={e=>{e.preventDefault();setTripId(null);localStorage.removeItem('active-trip')}}>trip<span>.</span></a>
    <p>More memories.<br/>Less money math.</p>
    {data&&tripId&&<nav>{[['overview','Overview'],['personal','Personal pocket'],['balances','Who owes whom'],...(lead?[['purse','Group purse']]:[])].map(([id,label])=>
      <button key={id} className={page===id?'selected':''} onClick={()=>setPage(id)}>{label}</button>)}
      <button onClick={()=>{setTripId(null);setData(null);localStorage.removeItem('active-trip')}}>＋ Join / create trip</button></nav>}
    <div className="aside-bottom">YOUR TRAVEL COMPANION<strong>{session?.user.displayName||'Welcome, traveler'}</strong></div></aside>
    <main><header><span>TRIP EXPENSE TRACKER</span><span>{session?.user.displayName||'LET’S GO SOMEWHERE'}</span></header>
    {error&&<p className="error" role="alert">{error} {tripId&&<button onClick={()=>refresh().then(()=>setError('')).catch(e=>setError(e.message))}>Refresh</button>}</p>}
    {!tripId?<Onboarding session={session} onSession={setSession} onJoinSuccess={selectTrip} trips={trips}/>:
      !data?<section className="card loading"><h2>{error?'Unable to load trip':'Loading your trip…'}</h2><button onClick={()=>{setTripId(null);localStorage.removeItem('active-trip')}}>Back to trips</button></section>:<>
      <p className="eyebrow">{data.trip.name} · {data.members.length} TRAVELERS</p>
      <div className="heading"><div><h1>{{overview:'A little less settling up.',personal:'Your personal pocket.',balances:'Who owes whom.',purse:'The group purse.'}[page]}</h1>
        <p className="muted">Trip code: <strong>{data.trip.joinCode}</strong> · Share it with your travel crew.</p></div><button className="primary" onClick={()=>openEntry()}>＋ Add expense</button></div>
      {notice&&<p role="status" className="success">{notice}</p>}
      {page==='overview'&&<><section className="hero"><div><span className="badge">ALL TOGETHER, ALL SQUARE</span><h2>Make room for the good stuff.</h2>
        <p>Log what you paid. Choose who it was for. Keep every shared moment easy.</p></div><div className="sun" aria-hidden="true">↗</div></section>
        <div className="stats"><section className="card"><span className="label">PAID FROM YOUR POCKET</span><div className="amount">{money(paid)}</div><small>Personal payments, including friends’ shares</small></section>
        <section className="card"><span className="label">YOU ARE OWED</span><div className="amount">{money(balances.filter(t=>t.to===userId).reduce((s,t)=>s+t.amountPaise,0))}</div><small>After offsetting payments in both directions</small></section>
        <section className="card"><span className="label">YOU OWE</span><div className="amount">{money(balances.filter(t=>t.from===userId).reduce((s,t)=>s+t.amountPaise,0))}</div><small>Your share of friends’ payments</small></section></div>
        <section className="card"><h2>Recent activity</h2>{expenseRows(data.expenses.slice(0,8))}</section></>}
      {page==='personal'&&<><section className="card"><h2>{money(paid)} paid from your pocket</h2>{expenseRows(data.expenses.filter(e=>e.recordedBy===userId))}</section>
        <section className="card spaced"><h2>Your group purse contributions</h2>{expenseRows(data.purseEntries.filter(e=>e.kind==='contribution'&&e.recordedBy===userId))}</section></>}
      {page==='balances'&&<section className="card"><h2>Direct balances between travelers</h2><p className="muted">Group purse entries and self-only expenses do not create personal debts.</p>
        {data.transactions.length?data.transactions.map(t=><div className="row" key={t.from+t.to}><div className="row-body"><strong>{name(t.from)} → {name(t.to)}</strong><small>Remaining amount owed</small></div><strong>{money(t.amountPaise)}</strong></div>):<p className="empty">Everyone is square.</p>}</section>}
      {page==='purse'&&lead&&<><section className="hero"><div><span className="badge">GROUP LEADS ONLY</span><h2>Available in the group purse</h2><div className="amount">{money(data.trip.purseBalancePaise)}</div></div><button className="primary" onClick={()=>openEntry('expense')}>＋ Group expense</button></section>
        <section className="card spaced"><h2>Contributions and group spending</h2>{expenseRows(data.purseEntries)}</section></>}
      <p className="disclaimer">Records payments already made. No money is transferred through this app.</p>
      <button className="text-button" onClick={()=>refresh().then(()=>{setNotice('Up to date.');setError('')}).catch(e=>setError(e.message))}>Refresh trip</button>
      </>}
    </main>
    <dialog ref={dialog} onCancel={e=>{if(saving)e.preventDefault();else setShowForm(false)}} onClose={()=>setShowForm(false)}>
      <form onSubmit={save}><div className="dialog-heading"><h2>Add expense</h2><button type="button" aria-label="Close expense form" disabled={saving} onClick={()=>setShowForm(false)}>×</button></div>
        <fieldset disabled={saving} className="entry-fields"><label>What are you recording?<select value={kind} onChange={e=>setKind(e.target.value)}>
        <option value="personal">Expense for myself or friends</option><option value="contribution">Contribution to group purse</option>{lead&&<option value="expense">Payment from group purse</option>}</select></label>
        <p className="payer-note">{kind==='expense'?'From the group purse':'Paid by '+session?.user.displayName}</p>
        {kind!=='contribution'&&<label>Description<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Dinner by the beach"/></label>}
        <label>Amount (₹)<input required type="number" min="0.01" max="10000000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
        {kind==='personal'&&<fieldset><legend>Who was this for?</legend><div className="people">{data?.members.map(m=><label className="person-choice" key={m._id}><input type="checkbox" checked={people.includes(m._id)}
          onChange={e=>setPeople(e.target.checked?[...people,m._id]:people.filter(id=>id!==m._id))}/>{m.displayName}{m._id===userId?' (you)':''}</label>)}</div></fieldset>}
        <div className="impact">{kind==='personal'?people.length===1&&people[0]===userId?'Only for you. This expense stays private.':'Split equally among '+people.length+' selected travelers.':
          kind==='contribution'?'This increases the group purse without changing personal debts.':'This reduces the group purse without creating a debt to you.'}
          {kind==='personal'&&people.length>0&&Number(amount)>0&&Number.isFinite(Number(amount))&&people.map((id,index)=>{
            const paise=Math.round(Number(amount)*100),share=Math.floor(paise/people.length)+(index<paise%people.length?1:0);
            return <small key={id}>{name(id)}: {money(share)}{id===userId?' (your share)':''}</small>;
          })}</div></fieldset>
        {formError&&<p className="error" role="alert">{formError}</p>}<button className="primary full" disabled={saving}>{saving?'Saving…':kind==='contribution'?'Save contribution':'Save expense'}</button>
      </form></dialog></div>;
}
