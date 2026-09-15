import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Icon, money } from './ui.jsx';

export default function ExpenseDialog({ initialKind, data, user, onClose, onSaved }) {
  const [kind, setKind] = useState(initialKind);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [people, setPeople] = useState([user._id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null), pending = useRef(null);
  const lead = data.trip.groupLeads.includes(user._id);
  const amountPaise = Math.round(Number(amount) * 100);
  const validAmount = Number.isSafeInteger(amountPaise) && amountPaise > 0 && amountPaise <= 1000000000;
  const selfOnly = people.length === 1 && people[0] === user._id;
  const choices = [
    { id: 'personal', icon: 'expenses', title: 'An expense', detail: 'I paid for myself or friends' },
    { id: 'contribution', icon: 'purse', title: 'A contribution', detail: 'I added money to the purse' },
    ...(lead ? [{ id: 'expense', icon: 'balances', title: 'Purse spending', detail: 'Paid from shared funds' }] : []),
  ];
  useEffect(() => { dialog.current.showModal(); }, []);
  async function save(event) {
    event.preventDefault();
    setError('');
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || !validAmount) return setError('Enter an amount between ₹0.01 and ₹1,00,00,000, with at most two decimal places.');
    if (kind === 'personal' && !people.length) return setError('Choose at least one person this expense was for.');
    const body = { tripId: data.trip._id, ledger: kind === 'personal' ? 'personal' : 'purse', amountPaise,
      title: kind === 'contribution' ? 'Contribution to group purse' : title.trim(),
      ...(kind === 'personal' ? { splitAmong: people } : { kind }) };
    if (!body.title) return setError('Add a short description of the expense.');
    const signature = JSON.stringify(body);
    if (!pending.current || pending.current.signature !== signature) pending.current = { signature,
      entry: { ...body, clientId: crypto.randomUUID(), clientCreatedAt: new Date().toISOString() } };
    setSaving(true);
    try {
      const result = await api('/expenses/sync', { offlineExpenses: [pending.current.entry] });
      if (result.errors.length) throw new Error(result.errors[0].error);
      onSaved(kind === 'contribution' ? 'Contribution saved.' : kind === 'expense' ? 'Purse spending saved.' : 'Expense saved.');
    } catch (error) { setError(error.message); setSaving(false); }
  }
  return <dialog ref={dialog} className="expense-dialog" aria-labelledby="entry-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={save}><div className="dialog-heading"><div><span className="eyebrow">RECORD A PAYMENT</span><h2 id="entry-title">{kind === 'expense' ? 'Record purse spending' : 'Add expense'}</h2></div>
      <button type="button" className="icon-button" aria-label="Close expense form" disabled={saving} onClick={onClose}><Icon name="close"/></button></div>
      <div className="dialog-body"><fieldset disabled={saving} className="form-fields"><legend className="sr-only">Payment details</legend>
        <div className="payment-types" role="group" aria-label="Payment type">{choices.map(choice => <button type="button" key={choice.id} aria-pressed={kind === choice.id} onClick={() => { setKind(choice.id); setError(''); }}>
          <Icon name={choice.icon}/><strong>{choice.title}</strong><small>{choice.detail}</small></button>)}</div>
        <div className="source-note"><Icon name={kind === 'expense' ? 'purse' : 'users'} size={17}/>{kind === 'expense' ? 'Paid from the group purse' : 'Paid by you · ' + user.displayName}</div>
        <label className="amount-input">{kind === 'contribution' ? 'How much did you contribute?' : 'How much was paid?'}<span><span aria-hidden="true">₹</span><input aria-label="Amount in rupees" required type="number" min="0.01" max="10000000" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value)}/></span></label>
        {kind !== 'contribution' && <label>What was it for?<input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Dinner, taxi, or train tickets"/></label>}
        {kind === 'personal' && <fieldset className="beneficiary-picker"><legend>Who was it for?</legend><div className="beneficiary-help"><span>Select everyone who shares the cost.</span><button type="button" className="text-button" onClick={() => setPeople([user._id])}>Only me</button></div>
          <div className="people">{data.members.map(member => <label className="person-choice" key={member._id}><input type="checkbox" checked={people.includes(member._id)} onChange={event => setPeople(event.target.checked ? [...people, member._id] : people.filter(id => id !== member._id))}/><span>{member.displayName}{member._id === user._id ? ' (you)' : ''}</span></label>)}</div></fieldset>}
        <div className={'payment-preview ' + (kind === 'expense' ? 'purse-preview' : '')} aria-live="polite">
          <strong>{kind === 'personal' ? selfOnly ? 'Just for you' : 'Split equally' : kind === 'contribution' ? 'Added to shared funds' : 'Deducted from shared funds'}</strong>
          <p>{kind === 'personal' ? selfOnly ? 'Only you can see this expense. It creates no debt.' : 'Your own share creates no debt. Friends’ shares are added to their balance with you.' : kind === 'contribution' ? 'Your contribution increases the group purse. Personal balances stay the same.' : 'This comes out of the group purse. Nobody owes you personally for it.'}</p>
          {validAmount && kind === 'personal' && people.map((id, index) => <div className="split-line" key={id}><span>{data.members.find(m => m._id === id)?.displayName}{id === user._id ? ' (you)' : ''}</span><strong>{money(Math.floor(amountPaise / people.length) + (index < amountPaise % people.length ? 1 : 0))}</strong></div>)}
          {validAmount && kind === 'expense' && <div className="split-line"><span>Purse after this payment</span><strong>{money(data.trip.purseBalancePaise - amountPaise)}</strong></div>}
        </div>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}</div>
      <div className="dialog-footer"><small>This records a payment already made.</small><button className="primary" disabled={saving}>{saving ? 'Saving…' : kind === 'contribution' ? 'Save contribution' : kind === 'expense' ? 'Save purse payment' : 'Save expense'}<Icon name="check" size={17}/></button></div>
    </form>
  </dialog>;
}
