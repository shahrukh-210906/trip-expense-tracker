import {calculateSettlement} from './settlement.mjs';
import {calculateKittySettlement} from './kittySettlement.mjs';
export function paymentBalances(expenses,entries,trip,payments=[]){
  const accepted=payments.filter(p=>p.state==='accepted');
  const transactions=calculateSettlement([...expenses,...accepted.filter(p=>p.ledger==='personal').map(p=>({recordedBy:p.from,splitAmong:[p.to],amountPaise:p.amountPaise}))],trip.participants);
  const kittySettlement=calculateKittySettlement(entries,trip),lead=kittySettlement.leadId;
  const credits=new Map(kittySettlement.balances.map(b=>[b.userId,b.amountPaise]));
  for(const p of accepted.filter(p=>p.ledger==='kitty')){
    const from=String(p.from),to=String(p.to);
    if(from!==lead)credits.set(from,credits.get(from)+p.amountPaise);
    if(to!==lead)credits.set(to,credits.get(to)-p.amountPaise);
  }
  if([...credits.values()].some(n=>!Number.isSafeInteger(n)))throw new Error('Settlement amount exceeds supported range.');
  kittySettlement.balances=kittySettlement.balances.map(b=>({...b,amountPaise:credits.get(b.userId)}));
  kittySettlement.transactions=[...credits].filter(([id,n])=>id!==lead&&n!==0).map(([id,n])=>({from:n>0?lead:id,to:n>0?id:lead,amountPaise:Math.abs(n)}));
  return {transactions,kittySettlement};
}
export async function loadPaymentBalances(models,trip,session=null){
  const query={tripId:trip._id};
  const expenses=await models.PersonalExpense.find(query).session(session);
  const entries=await models.PurseEntry.find(query).session(session);
  const payments=await models.SettlementPayment.find(query).session(session);
  return {...paymentBalances(expenses,entries,trip,payments),payments};
}
