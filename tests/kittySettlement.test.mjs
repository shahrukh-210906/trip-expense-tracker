import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateKittySettlement} from '../server/utils/kittySettlement.mjs';
const trip={participants:['lead','a','b'],groupLeads:['lead']};
test('selected Kitty beneficiaries owe the lead; excluded members owe nothing',()=>{
  const result=calculateKittySettlement([{kind:'expense',recordedBy:'lead',amountPaise:901,splitAmong:['a','lead']}],trip);
  assert.deepEqual(result.transactions,[{from:'a',to:'lead',amountPaise:451}]);
});
test('unused contributions are refunded by the lead, with each share deducted',()=>{
  const result=calculateKittySettlement([{kind:'contribution',recordedBy:'a',amountPaise:1000},{kind:'expense',amountPaise:300,splitAmong:['lead','a','b']}],trip);
  assert.deepEqual(result.transactions,[{from:'lead',to:'a',amountPaise:900},{from:'b',to:'lead',amountPaise:100}]);
  assert.equal(result.balances.reduce((sum,b)=>sum+b.amountPaise,0),700);
});
test('legacy Kitty expenses split across members and invalid beneficiaries are rejected',()=>{
  assert.equal(calculateKittySettlement([{kind:'expense',amountPaise:300}],trip).transactions.length,2);
  assert.throws(()=>calculateKittySettlement([{kind:'expense',amountPaise:1,splitAmong:['outsider']}],trip));
});
