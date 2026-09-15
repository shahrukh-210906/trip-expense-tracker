import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSettlement } from '../server/utils/settlement.mjs';
const expense=(recordedBy,amountPaise,splitAmong)=>({recordedBy,amountPaise,splitAmong});
test('personal payments for friends create direct debts and opposite payments offset',()=>{
  assert.deepEqual(calculateSettlement([expense('a',60000,['b']),expense('b',10000,['a']),expense('a',900,['a'])],['a','b']),
    [{from:'b',to:'a',amountPaise:50000}]);
});
test('remainders stay in integer paise and selection order',()=>{
  assert.deepEqual(calculateSettlement([expense('a',100,['b','c','a'])],['a','b','c']),
    [{from:'b',to:'a',amountPaise:34},{from:'c',to:'a',amountPaise:33}]);
});
test('does not redirect debt through unrelated travelers',()=>{
  assert.deepEqual(calculateSettlement([expense('a',100,['b']),expense('b',100,['c'])],['a','b','c']),
    [{from:'b',to:'a',amountPaise:100},{from:'c',to:'b',amountPaise:100}]);
});
test('rejects malformed expenses instead of corrupting balances',()=>{
  for(const e of [expense('a',1,[]),expense('a',1,['b','b']),expense('a',0.5,['b']),expense('x',100,['b'])])
    assert.throws(()=>calculateSettlement([e],['a','b']));
});
