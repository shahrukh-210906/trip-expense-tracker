import { useState } from 'react';
import { EmptyState, Icon, money, entryDate } from './ui.jsx';

export default function Purse({ data, name }) {
  const [filter, setFilter] = useState('all');
  const incoming = data.purseEntries.filter(e => e.kind !== 'expense').reduce((s, e) => s + e.amountPaise, 0);
  const outgoing = data.purseEntries.filter(e => e.kind === 'expense').reduce((s, e) => s + e.amountPaise, 0);
  const entries = data.purseEntries.filter(e => filter === 'all' || (filter === 'in' ? e.kind !== 'expense' : e.kind === 'expense'));
  return <>
    <section className="purse-summary"><div className="purse-available"><span><Icon name="purse"/>SHARED TRIP FUNDS</span><h2>{money(data.trip.purseBalancePaise)}</h2><p>Available to spend</p></div>
      <div className="purse-equation"><div><span>Total added</span><strong>+ {money(incoming)}</strong></div><div><span>Total spent</span><strong>− {money(outgoing)}</strong></div></div>
    </section>
    <p className="explanation"><Icon name="lock" size={18}/>All trip members can view the balance and history. Only group leads can record purse spending.</p>
    <section className="ledger"><div className="ledger-toolbar"><h2>Purse history</h2><div className="view-switch" role="group" aria-label="Purse history filter">
      {[['all', 'All'], ['in', 'Money in'], ['out', 'Money out']].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div></div>
      {entries.length ? entries.map(e => <div className="purse-row" key={e._id}><span className={'flow-icon ' + (e.kind === 'expense' ? 'out' : 'in')}><Icon name="arrow"/></span><div><strong>{e.kind === 'contribution' ? name(e.recordedBy) + ' contributed' : e.title}</strong><small>{entryDate(e)} · {e.kind === 'expense' ? 'Recorded by ' + name(e.recordedBy) : e.kind === 'opening' ? 'Opening balance' : 'Added to the purse'}</small></div>
        <strong className={e.kind === 'expense' ? 'out-text' : 'in-text'}>{e.kind === 'expense' ? '−' : '+'}{money(e.amountPaise)}</strong></div>) : <EmptyState icon="purse" title={filter === 'out' ? 'No purse spending yet' : filter === 'in' ? 'No funds added yet' : 'The purse is ready'}>Travelers can add funds using the contribution option in Add expense.</EmptyState>}
    </section>
  </>;
}
