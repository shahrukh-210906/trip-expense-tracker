import Settings from './components/Settings.jsx';
// Development-only interactive payment preview. All API responses are in-memory fixtures.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Balances from './components/Balances.jsx';
import {PaymentProfile} from './components/PaymentTools.jsx';
import NotificationInbox from './components/NotificationInbox.jsx';
import './index.css';import './app.css';import './mobile.css';
const members=[{_id:'alex',displayName:'Alex'},{_id:'sam',displayName:'Sam'}];
let payments=[],upiId='demo@bank',user='sam';
if(import.meta.env.DEV){
 window.fetch=async(input,options={})=>{
  const path=String(input),body=options.body?JSON.parse(options.body):{};
  let result={ok:true};
  if(path==='/api/payments/profile'){if(options.method==='POST')upiId=body.upiId;result={upiId};}
  else if(path.includes('/recipient/'))result={displayName:'Alex',upiId};
  else if(path.endsWith('/requests')){payments.push({_id:'demo-'+payments.length,from:'sam',to:'alex',ledger:body.ledger,amountPaise:body.amountPaise,state:'pending',createdAt:new Date().toISOString()});}
  else if(path.includes('/requests/')){const parts=path.split('/');const p=payments.find(p=>p._id===parts.at(-2));if(p){p.state={accept:'accepted',reject:'rejected',cancel:'cancelled'}[parts.at(-1)];p.resolvedAt=new Date().toISOString();}}
  else if(path==='/api/notifications')result={items:payments.filter(p=>p.state==='pending'&&user==='alex').map(p=>({...p,actorName:'Sam',tripName:'Demo weekend',kind:'request',tripId:'demo'})),unread:payments.filter(p=>p.state==='pending').length};
  else if(path==='/api/notifications/push/config')result={enabled:false};
  return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
 };
 function Preview(){const [person,setPerson]=useState('sam'),[version,setVersion]=useState(0);const remaining=120000-payments.filter(p=>p.state==='accepted'&&p.ledger==='personal').reduce((n,p)=>n+p.amountPaise,0);
  const data={trip:{_id:'demo',name:'Demo weekend',participants:['alex','sam'],groupLeads:['alex']},members,transactions:remaining?[{from:'sam',to:'alex',amountPaise:remaining}]:[],kittySettlement:{leadId:'alex',transactions:[]},payments:[...payments]};
  return <div className="mobile-app"><header className="mobile-header"><strong>Payment preview · demo only</strong></header><main className="mobile-main"><div className="payment-buttons">{members.map(m=><button className="secondary" key={m._id} onClick={()=>{user=m._id;setPerson(user);}}>{m.displayName}{m._id===person?' (current)':''}</button>)}</div><div className="mobile-page-heading"><h1>{location.search.includes("settings")?"Settings & sync":"Settlement"}</h1></div>{location.search.includes("settings")?<Settings session={{token:"demo",user:members.find(m=>m._id===person)}} status="live" disconnected={false} queued={[]} busy={false} onSync={()=>{}} onOpenTrip={()=>{}} onLogout={()=>{}}/>:<><Balances data={data} userId={person} name={id=>members.find(m=>m._id===id)?.displayName} reload={async()=>setVersion(version+1)}/><PaymentProfile key={person}/><NotificationInbox key={person+version} session={{token:'demo'}} onOpenTrip={()=>{}}/></>}</main></div>;
 }
 createRoot(document.getElementById('root')).render(<Preview/>);
}

import './reference.css';
