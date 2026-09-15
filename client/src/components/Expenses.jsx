import { useState } from 'react';
import { EmptyState, Icon, money, isPrivate, entryDate } from './ui.jsx';

export default function Expenses({ data, userId, name }) {
  const [scope, setScope] = useState('mine');
  const [query, setQuery] = useState('');
  const mine = data.expenses.filter(e => e.recordedBy === userId);
  const contributions = data.purseEntries.filter(e => e.recordedBy === userId && e.kind === 'contribution');
  const entries = scope === 'mine' ? [...mine, ...contributions] : data.expenses.filter(e => !isPrivate(e));
  const filtered = entries.filter(e => (e.title + ' ' + name(e.recordedBy)).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => new Date(b.clientCreatedAt) - new Date(a.clientCreatedAt));
  return <>
    <div className="spending-summary"><div><span>You paid for expenses</span><strong>{money(mine.reduce((s, e) => s + e.amountPaise, 0))}</strong><small>For yourself and people you paid for</small></div>
      <div className="contribution-summary"><Icon name="purse"/><div><span>You contributed to the purse</span><strong>{money(contributions.reduce((s, e) => s + e.amountPaise, 0))}</strong></div></div>
    </div>
    <section className="ledger" aria-label="Expense history">
      <div className="ledger-toolbar"><div className="view-switch" role="group" aria-label="Expense view">
        <button aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>My payments</button>
        <button aria-pressed={scope === 'shared'} onClick={() => setScope('shared')}>Shared expenses</button></div>
        <label className="search-field"><Icon name="search" size={17}/><input aria-label="Search expenses" placeholder="Search payments" value={query} onChange={e => setQuery(e.target.value)}/></label>
      </div>
      <p className="ledger-caption">{scope === 'mine' ? 'Everything you paid personally, including your purse contributions.' : 'Payments made for others on this trip. Private expenses are excluded.'}</p>
      <div className="list-heading"><span>PAYMENT DETAILS</span><span>AMOUNT</span></div>
      {filtered.length ? filtered.map(e => <details className="payment-item" key={e._id}>
        <summary><span className={'payment-icon ' + (e.kind ? 'funding' : '')}><Icon name={e.kind ? 'purse' : 'expenses'}/></span>
          <span className="payment-description"><strong>{e.kind === 'contribution' ? 'Added to group purse' : e.title}</strong>
            <span>{entryDate(e)} · {e.recordedBy === userId ? 'You paid' : name(e.recordedBy) + ' paid'}{isPrivate(e) && <span className="privacy-label"><Icon name="lock" size={11}/>Only you</span>}{e.kind && <span className="type-label">Contribution</span>}</span></span>
          <strong className="payment-amount">{money(e.amountPaise)}</strong><Icon name="down" size={16}/></summary>
        <div className="payment-detail">{e.kind ? <p>Added to shared trip funds. This does not change what you owe friends.</p> : <><p><strong>Split breakdown</strong></p>
          {e.splitAmong.map((id, index) => <div className="split-line" key={id}><span>{name(id)}{id === userId ? ' (you)' : ''}</span><span>{money(Math.floor(e.amountPaise / e.splitAmong.length) + (index < e.amountPaise % e.splitAmong.length ? 1 : 0))}</span></div>)}</>}
        </div></details>) : <EmptyState title={query ? 'No matching payments' : scope === 'mine' ? 'Your first payment starts here' : 'No shared expenses yet'}>{query ? 'Try another description or traveler name.' : scope === 'mine' ? 'Use Add expense to record a purchase or contribute to the group purse.' : 'Payments for friends will appear here once someone records them.'}</EmptyState>}
    </section>
  </>;
}
