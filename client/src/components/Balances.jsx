import { useState } from 'react';
import { EmptyState, Icon, money } from './ui.jsx';

export default function Balances({ data, userId, name }) {
  const [everyone, setEveryone] = useState(false);
  const owed = data.transactions.filter(t => t.to === userId);
  const owing = data.transactions.filter(t => t.from === userId);
  const total = rows => money(rows.reduce((sum, t) => sum + t.amountPaise, 0));
  return <>
    <div className="balance-columns">
      <section className="balance-panel receive"><span className="balance-direction"><Icon name="arrow"/>COMING BACK TO YOU</span><h2>{total(owed)}</h2><p>Friends owe you</p>
        {owed.length ? owed.map(t => <div className="person-balance" key={t.from}><span className="avatar">{name(t.from).slice(0, 1)}</span><div><strong>{name(t.from)}</strong><small>owes you</small></div><strong>{money(t.amountPaise)}</strong></div>) : <p className="balance-empty">Nobody owes you right now.</p>}
      </section>
      <section className="balance-panel owe"><span className="balance-direction"><Icon name="arrow"/>TO PAY BACK</span><h2>{total(owing)}</h2><p>You owe friends</p>
        {owing.length ? owing.map(t => <div className="person-balance" key={t.to}><span className="avatar">{name(t.to).slice(0, 1)}</span><div><strong>{name(t.to)}</strong><small>you owe</small></div><strong>{money(t.amountPaise)}</strong></div>) : <p className="balance-empty">You don’t owe anyone right now.</p>}
      </section>
    </div>
    <p className="explanation"><Icon name="balances" size={18}/>Payments between each pair are offset. Group purse money stays separate.</p>
    <section className="group-balances"><button className="disclosure" aria-expanded={everyone} onClick={() => setEveryone(!everyone)}>View balances for the whole trip <Icon name="down"/></button>
      {everyone && (data.transactions.length ? data.transactions.map(t => <div className="whole-trip-balance" key={t.from + t.to}><span>{name(t.from)} <span className="muted">owes</span> {name(t.to)}</span><strong>{money(t.amountPaise)}</strong></div>) : <EmptyState icon="check" title="Everyone is square">No outstanding debts between travelers.</EmptyState>)}
    </section>
  </>;
}
