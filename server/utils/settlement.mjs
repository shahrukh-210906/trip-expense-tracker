// All amounts are integer paise. Offset only direct debts between each pair.
export function calculateSettlement(expenses, participants) {
  const members = new Set(participants.map(String)), pairs = new Map();
  for (const expense of expenses) {
    const payer = String(expense.recordedBy), people = expense.splitAmong.map(String), amount = expense.amountPaise;
    if (!Number.isSafeInteger(amount) || amount <= 0 || !members.has(payer) ||
        !people.length || new Set(people).size !== people.length || people.some(id => !members.has(id)))
      throw new Error('Invalid personal expense in settlement.');
    const base = Math.floor(amount / people.length), remainder = amount % people.length;
    people.forEach((person, index) => {
      if (person === payer) return;
      const [a,b] = [person,payer].sort(), key = a + ':' + b, share = base + (index < remainder ? 1 : 0);
      const next = (pairs.get(key)?.amountPaise || 0) + (person === a ? share : -share);
      if (!Number.isSafeInteger(next)) throw new Error('Settlement exceeds supported amount.');
      pairs.set(key, { a,b,amountPaise:next });
    });
  }
  return [...pairs.values()].filter(p=>p.amountPaise!==0).map(p=>({
    from:p.amountPaise>0?p.a:p.b, to:p.amountPaise>0?p.b:p.a, amountPaise:Math.abs(p.amountPaise)
  }));
}
