// Development-only screenshot fixture. No API calls, login, or real trip data.
import React from 'react';
import { createRoot } from 'react-dom/client';
import Onboarding from './components/Onboarding.jsx';
import { Overview } from './components/TripViews.jsx';
import ExpenseDialog from './components/ExpenseDialog.jsx';
import Balances from './components/Balances.jsx';
import InstallApp from './components/InstallApp.jsx';
import { Icon } from './components/ui.jsx';
import './index.css';
import './app.css';
import './mobile.css';
const members=[{_id:'demo-a',displayName:'Alex',googleLinked:true},{_id:'demo-b',displayName:'Sam'},{_id:'demo-c',displayName:'Riya'}];
const trip={_id:'demo-trip',name:'Weekend in Goa',status:'active',groupLeads:['demo-a'],participants:members.map(m=>m._id),purseBalancePaise:240000,joinCode:'DEMO42'};
const data={trip,members,expenses:[{_id:'demo-expense',recordedBy:'demo-a',title:'Lunch by the beach',amountPaise:120000,splitAmong:members.map(m=>m._id),clientCreatedAt:'2026-09-20T08:30:00Z'}],purseEntries:[],transactions:[{from:'demo-b',to:'demo-a',amountPaise:40000},{from:'demo-c',to:'demo-a',amountPaise:40000}],kittySettlement:{leadId:'demo-a',transactions:[]}};
const noop=()=>{};
function Capture(){
 const screen=new URLSearchParams(location.search).get('screen')||'trips';
 const expense=screen==='expense'||screen==='kitty';
 const name=id=>members.find(m=>m._id===id)?.displayName;
 return <div className="mobile-app"><header className="mobile-header"><Icon name="trip"/><strong>{screen==='trips'?'triproam.':trip.name}</strong><span className="connection-label">Demo</span></header><main className="mobile-main">
 {screen==='trips'||screen==='install'?<><Onboarding session={{user:members[0]}} trips={[trip]} onSession={noop} onJoinSuccess={noop}/>{screen==='install'&&<InstallApp/>}</>:<><div className="mobile-page-heading"><span className="eyebrow">TRIP DETAILS</span><h1>{screen==='settlement'?'Settlement':'Overview'}</h1></div>{screen==='settlement'?<Balances data={data} userId="demo-a" name={name}/>:<Overview data={data} userId="demo-a" name={name} lead manage={noop} history={noop} feed={noop}/>}</>}
 </main>{!['trips','install'].includes(screen)&&<><button className="expense-fab"><Icon name="plus"/>Add expense</button><nav className="bottom-nav">{[['trip','Overview'],['expenses','Live Feed'],['balances','Settlement']].map(([icon,label])=><button key={label} aria-current={label===(screen==='settlement'?'Settlement':'Overview')?'page':undefined}><Icon name={icon}/><span>{label}</span></button>)}</nav></>}{expense&&<ExpenseDialog initialKind={screen==='kitty'?'contribution':'personal'} data={data} user={members[0]} onClose={noop} onSaved={noop} enqueue={noop}/>}</div>;
}
if(import.meta.env.DEV)createRoot(document.getElementById('root')).render(<Capture/>);
