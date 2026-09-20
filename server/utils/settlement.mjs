// All amounts are integer paise. Settle net balances directly, removing intermediaries.
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
  const direct = [...pairs.values()].filter(p=>p.amountPaise!==0).map(p=>({
    from:p.amountPaise>0?p.a:p.b, to:p.amountPaise>0?p.b:p.a, amountPaise:Math.abs(p.amountPaise)
  }));
  const balances = new Map([...members].map(id=>[id,0]));
  for (const t of direct) {
    balances.set(t.from,balances.get(t.from)-t.amountPaise);
    balances.set(t.to,balances.get(t.to)+t.amountPaise);
    if (!Number.isSafeInteger(balances.get(t.from)) || !Number.isSafeInteger(balances.get(t.to)))
      throw new Error('Settlement exceeds supported amount.');
  }
  const debtors=[...balances].filter(([,n])=>n<0).map(([id,n])=>({id,amount:-n}));
  const creditors=[...balances].filter(([,n])=>n>0).map(([id,n])=>({id,amount:n}));
  const result=[];
  let i=0,j=0;
  while(i<debtors.length && j<creditors.length){
    const amountPaise=Math.min(debtors[i].amount,creditors[j].amount);
    result.push({from:debtors[i].id,to:creditors[j].id,amountPaise});
    debtors[i].amount-=amountPaise; creditors[j].amount-=amountPaise;
    if(!debtors[i].amount)i++;
    if(!creditors[j].amount)j++;
  }
  return result;
}
