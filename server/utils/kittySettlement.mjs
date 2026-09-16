// The first group lead holds the Kitty. Positive member credit is refunded
// by that lead; negative credit is paid to that lead. Personal debts stay separate.
export function calculateKittySettlement(entries,trip){
  const members=trip.participants.map(String),lead=String(trip.groupLeads[0]);
  const balances=new Map(members.map(id=>[id,0]));
  for(const entry of entries){
    const amount=entry.amountPaise;
    if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Invalid Kitty amount.');
    if(entry.kind==='expense'){
      // Entries recorded before beneficiary selection existed were shared by the trip.
      const people=(entry.splitAmong?.length?entry.splitAmong:trip.participants).map(String);
      if(!people.length||new Set(people).size!==people.length||people.some(id=>!balances.has(id)))throw new Error('Invalid Kitty beneficiaries.');
      people.forEach((id,index)=>balances.set(id,balances.get(id)-Math.floor(amount/people.length)-(index<amount%people.length?1:0)));
    }else{
      const owner=String(entry.recordedBy);
      if(!balances.has(owner))throw new Error('Invalid Kitty contributor.');
      balances.set(owner,balances.get(owner)+amount);
    }
    if([...balances.values()].some(value=>!Number.isSafeInteger(value)))throw new Error('Kitty settlement exceeds supported amount.');
  }
  return {leadId:lead,balances:members.map(userId=>({userId,amountPaise:balances.get(userId)})),
    transactions:members.filter(id=>id!==lead&&balances.get(id)!==0).map(id=>({from:balances.get(id)>0?lead:id,to:balances.get(id)>0?id:lead,amountPaise:Math.abs(balances.get(id))}))};
}
