import {useEffect,useState} from 'react';
import {api} from '../api.js';
import {money} from './ui.jsx';
export default function NotificationInbox({session,onOpenTrip}){
 const [items,setItems]=useState([]),[unread,setUnread]=useState(0),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[enabled,setEnabled]=useState(false);
 const [config,setConfig]=useState(null);
 const supported='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 async function load(){try{const result=await api('/notifications');setItems(result.items);setUnread(result.unread);}catch{/* Existing inbox stays usable during a brief disconnection. */}}
 useEffect(()=>{let active=true;void load();void api('/notifications/push/config').then(c=>{if(active)setConfig(c);}).catch(()=>{});const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);window.addEventListener('focus',load);if(supported)navigator.serviceWorker.getRegistration().then(r=>r?.pushManager.getSubscription()).then(async s=>{const result=s?await api('/notifications/push/status',{endpoint:s.endpoint}):{subscribed:false};if(active)setEnabled(result.subscribed);}).catch(()=>{});return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load);};},[session.token]);
 async function toggle(){
  setBusy(true);setMessage('');
  try{
   if(!enabled){
    if(!config?.enabled)throw new Error('Phone notifications are not ready yet. Reload to try again; your inbox still works.');
    const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Notifications were not enabled. You can change this in browser settings.');
   }
   const registration=await navigator.serviceWorker.getRegistration();if(!registration)throw new Error('Notifications are available in the installed or published app. Reload and try again.');
   const current=await registration.pushManager.getSubscription();
   if(enabled){if(current){await api('/notifications/push/unsubscribe',{endpoint:current.endpoint});await current.unsubscribe();}setEnabled(false);setMessage('Notifications disabled on this device.');return;}
   const bytes=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   const subscription=current||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
   try{await api('/notifications/push/subscribe',subscription.toJSON());}catch(e){await subscription.unsubscribe();throw e;}
   setEnabled(true);setMessage('Phone notifications enabled. Delivery depends on your device and connection.');
  }catch(e){setMessage(e.message);}finally{setBusy(false);}
 }
 return <details className="payment-settings notification-inbox" onToggle={e=>{if(e.currentTarget.open)void load();}}><summary>Notifications{unread>0?' · '+unread+' unread':''}</summary><p>Approval requests and reminders appear here. Phone alerts show a generic message to keep payment details off your lock screen.</p>{supported?<button className="secondary" disabled={busy} onClick={toggle}>{enabled?'Turn off phone notifications':'Enable phone notifications'}</button>:<p>For iPhone/iPad notifications, add TripRoam to your Home Screen and open it there (iOS 16.4+). Otherwise, try a browser that supports web push.</p>}{message&&<p role="status">{message}</p>}{!items.length?<p>No notifications yet.</p>:items.map(n=><button className={'inbox-item '+(!n.readAt?'unread':'')} key={n._id} onClick={async()=>{try{await api('/notifications/'+n._id+'/read',{});onOpenTrip(n.tripId);void load();}catch(e){setMessage(e.message);}}}><strong>{n.tripName}</strong><span>{n.actorName}{n.kind==='request'?' asks you to confirm receipt of ':n.kind==='accepted'?' confirmed your payment of ':n.kind==='rejected'?' has not confirmed your payment of ':' reminds you about '}{money(n.amountPaise)} · {n.ledger==='kitty'?'Kitty':'Personal'}</span><small>{new Date(n.createdAt).toLocaleString()} · Open settlement</small></button>)}</details>;
}
