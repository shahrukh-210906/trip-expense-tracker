import { useEffect, useRef, useState } from 'react';
import { Icon, money } from './ui.jsx';

export default function ExpenseDialog({ initialKind, data, user, onClose, onSaved, enqueue }) {
  const [kind, setKind] = useState(initialKind);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [people, setPeople] = useState(initialKind==='expense'?data.members.map(m=>m._id):[user._id]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [keypad,setKeypad]=useState(false);
  const dialog = useRef(null), pending = useRef(null);
  const lead = data.trip.groupLeads.includes(user._id);
  const amountPaise = Math.round(Number(amount) * 100);
  const validAmount = Number.isSafeInteger(amountPaise) && amountPaise > 0 && amountPaise <= 1000000000;
  const selfOnly = people.length === 1 && people[0] === user._id;

  useEffect(() => { const focused=document.activeElement; const overflow=document.body.style.overflow; document.body.style.overflow='hidden'; dialog.current.showModal(); return()=>{document.body.style.overflow=overflow;focused?.focus();}; }, []);
  async function save(event) {
    event.preventDefault();
    setError('');
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || !validAmount) return setError('Enter an amount between ₹0.01 and ₹1,00,00,000, with at most two decimal places.');
    if (kind !== 'contribution' && !people.length) return setError('Choose at least one person this expense was for.');
    const body = { tripId: data.trip._id, ledger: kind === 'personal' ? 'personal' : 'purse', amountPaise,
      title: kind === 'contribution' ? 'Contribution to group purse' : title.trim(),
      ...(kind === 'personal' ? { splitAmong: people } : { kind,...(kind==='expense'?{splitAmong:people}:{}) }) };
    if (!body.title) return setError('Add a short description of the expense.');
    const signature = JSON.stringify(body);
    if (!pending.current || pending.current.signature !== signature) pending.current = { signature,
      entry: { ...body, clientId: crypto.randomUUID(), clientCreatedAt: new Date().toISOString() } };
    setSaving(true);
    try {
      await enqueue(pending.current.entry);
      onSaved('Saved on this device. It will sync automatically.');
    } catch { setError('Could not save this payment on your device. Keep the form open and check browser storage before trying again.'); setSaving(false); }
  }
  return <dialog ref={dialog} className="expense-dialog" aria-labelledby="entry-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={save}><div className="dialog-heading"><div><span className="eyebrow">RECORD A PAYMENT</span><h2 id="entry-title">{kind === 'expense' ? 'Kitty spending' : 'Add expense'}</h2></div>
      <button type="button" className="icon-button" aria-label="Close expense form" disabled={saving} onClick={onClose}><Icon name="close"/></button></div>
      <div className="dialog-body"><fieldset disabled={saving} className="form-fields"><legend className="sr-only">Payment details</legend>
        <div className="pocket-toggle" role="group" aria-label="Payment source"><button type="button" aria-pressed={kind==='personal'} onClick={()=>setKind('personal')}><Icon name="expenses"/>Personal Pocket</button><button type="button" aria-pressed={kind!=='personal'} onClick={()=>setKind(lead?'expense':'contribution')}><Icon name="purse"/>Kitty</button></div>
        {kind!=='personal'&&<div className="kitty-choice"><label>Kitty action<select value={kind} onChange={e=>setKind(e.target.value)}><option value="contribution">Add my contribution</option>{lead&&<option value="expense">Record Kitty spending</option>}</select></label>{!lead&&<small>Only the group lead can record Kitty spending.</small>}</div>}
        <div className="source-note"><Icon name={kind === 'expense' ? 'purse' : 'users'} size={17}/>{kind === 'expense' ? 'Paid from the group purse' : 'Paid by you · ' + user.displayName}</div>
        <label className="amount-input">{kind === 'contribution' ? 'How much did you contribute?' : 'How much was paid?'}<span><span aria-hidden="true">₹</span><input aria-label="Amount in rupees" required type="text" pattern="[0-9]+([.][0-9]{1,2})?" inputMode="decimal" placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value)}/></span></label>
        <button type="button" className="text-button keypad-toggle" aria-expanded={keypad} onClick={()=>setKeypad(!keypad)}>{keypad?'Hide keypad':'Show keypad'}</button>{keypad&&<div className="keypad" role="group" aria-label="Amount keypad">{['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(key=><button type="button" key={key} aria-label={key==='⌫'?'Delete last digit':key==='.'?'Decimal point':key} onClick={()=>setAmount(value=>key==='⌫'?value.slice(0,-1):key==='.'?(value.includes('.')?value:(value||'0')+'.'):value.length<11?value+key:value)}>{key}</button>)}</div>}
        {kind !== 'contribution' && <label>What was it for?<input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Dinner, taxi, or train tickets"/></label>}
        {kind !== 'contribution' && <fieldset className="beneficiary-picker"><legend>Split between</legend><div className="beneficiary-help"><span>{people.length} selected</span><button type="button" className="text-button" onClick={() => setPeople(data.members.map(m=>m._id))}>Everyone</button><button type="button" className="text-button" onClick={() => setPeople([user._id])}>Only me</button></div>
          <div className="people">{data.members.map(member => <label className="person-choice" key={member._id}><input type="checkbox" checked={people.includes(member._id)} onChange={event => setPeople(event.target.checked ? [...people, member._id] : people.filter(id => id !== member._id))}/><span>{member.displayName}{member._id === user._id ? ' (you)' : ''}</span></label>)}</div></fieldset>}
        <div className={'payment-preview ' + (kind === 'expense' ? 'purse-preview' : '')} aria-live="polite">
          <strong>{kind === 'personal' ? selfOnly ? 'Just for you' : 'Split equally' : kind === 'contribution' ? 'Added to shared funds' : 'Deducted from shared funds'}</strong>
          <p>{kind === 'personal' ? selfOnly ? 'Only you can see this expense. It creates no debt.' : 'Your own share creates no debt. Friends’ shares are added to their balance with you.' : kind === 'contribution' ? 'Your contribution increases the group purse. Personal balances stay the same.' : 'Charged to the selected people. Their Kitty contributions are deducted when settling with the lead.'}</p>
          {validAmount && kind !== 'contribution' && people.map((id, index) => <div className="split-line" key={id}><span>{data.members.find(m => m._id === id)?.displayName}{id === user._id ? ' (you)' : ''}</span><strong>{money(Math.floor(amountPaise / people.length) + (index < amountPaise % people.length ? 1 : 0))}</strong></div>)}
          {validAmount && kind === 'expense' && <div className="split-line"><span>Estimated purse after sync</span><strong>{money(data.trip.purseBalancePaise - amountPaise)}</strong></div>}
          {kind === 'expense' && <small>A negative Kitty balance means the lead has advanced money.</small>}
        </div>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}</div>
      <div className="dialog-footer"><small>This records a payment already made.</small><button className="primary" disabled={saving}>{saving ? 'Saving…' : kind === 'contribution' ? 'Save contribution' : kind === 'expense' ? 'Save purse payment' : 'Save expense'}<Icon name="check" size={17}/></button></div>
    </form>
  </dialog>;
}
