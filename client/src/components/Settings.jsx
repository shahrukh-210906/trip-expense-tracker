import {Icon} from './ui.jsx';
import {PaymentProfile} from './PaymentTools.jsx';
import NotificationInbox from './NotificationInbox.jsx';
import InstallApp from './InstallApp.jsx';

export default function Settings({session,disconnected,status,queued,busy,onSync,onOpenTrip,onLogout}){
 const pending=queued.filter(row=>row.state!=='synced').length;
 return <><section className="sync-status-card"><div className="section-heading"><h2>Cloud sync</h2><span className="connection-label">{disconnected?'Offline':status==='live'?'Live':'Connecting'}</span></div><Icon name={disconnected?"cloud":"cloud-sync"} size={48}/><strong>{pending?`${pending} payments waiting to sync`:disconnected?'Saved on this device':status==='live'?'Your trip is up to date':'Connecting to your trip…'}</strong><p>{disconnected?'Saved payments stay on this device until you reconnect.':'Payments are shared with your group after syncing.'}</p><button className="secondary" disabled={busy} onClick={onSync}>Sync now<Icon name="refresh" size={16}/></button></section><NotificationInbox session={session} onOpenTrip={onOpenTrip}/><PaymentProfile/><InstallApp/><section className="settings-account"><span>Signed in as</span><strong>{session.user.displayName}</strong><button className="text-button" onClick={onLogout}>Sign out</button></section></>;
}

