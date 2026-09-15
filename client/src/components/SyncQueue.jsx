import { Icon, money } from './ui.jsx';

export default function SyncQueue({ rows, busy, retry, sync, cached }) {
  const failed = rows.filter(row => row.state === 'failed').length;
  return <section className="sync-queue" aria-label="Payments saved on this device">
    <div className="sync-queue-heading"><div><Icon name={failed ? 'expenses' : 'refresh'} size={18}/><strong>{failed ? 'Some payments need attention' : rows.length ? busy ? 'Syncing your payments…' : 'Payments saved on this device' : 'Showing your last saved trip'}</strong></div>
      <button className="text-button" disabled={busy} onClick={sync}>Sync now</button></div>
    <p>{rows.length ? 'These entries are kept in this browser. Balances change only after the server confirms them.' : 'You can record payments here while disconnected. They will sync when the app reconnects.'}</p>
    {rows.map(row => <div className="queued-payment" key={row.key}><div><strong>{row.entry.title}</strong><small>{row.entry.ledger === 'personal' ? 'Personal expense' : row.entry.kind === 'expense' ? 'Purse spending' : 'Contribution'} · {row.state === 'failed' ? 'Not accepted' : row.state === 'synced' ? 'Saved online · updating your view' : 'Waiting to sync'}</small>
      {row.error && row.state !== 'synced' && <small className={row.state === 'failed' ? 'sync-failure' : ''}>{row.error}</small>}</div><strong>{money(row.entry.amountPaise)}</strong>
      {row.state === 'failed' && <button className="secondary" disabled={busy} onClick={() => retry(row.entry.clientId)}>Retry</button>}</div>)}
    {cached && rows.length > 0 && <small>Displayed trip balances are from your last successful refresh.</small>}
  </section>;
}
