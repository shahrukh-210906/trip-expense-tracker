import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentBalances} from '../server/utils/paymentBalances.mjs';
import {validSubscription} from '../server/push.mjs';
const trip={participants:['a','b','c'],groupLeads:['a']};
test('pending and rejected payments do not change debt; accepted partial payments do',()=>{
 const expenses=[{recordedBy:'a',splitAmong:['b'],amountPaise:10000}];
 const payment={from:'b',to:'a',amountPaise:4000,ledger:'personal'};
 for(const state of ['pending','rejected','cancelled'])assert.equal(paymentBalances(expenses,[],trip,[{...payment,state}]).transactions[0].amountPaise,10000);
 assert.equal(paymentBalances(expenses,[],trip,[{...payment,state:'accepted'}]).transactions[0].amountPaise,6000);
});
test('approved repayments preserve money paid even if expenses subsequently change',()=>{
 const result=paymentBalances([],[],trip,[{from:'b',to:'a',amountPaise:4000,ledger:'personal',state:'accepted'}]);
 assert.deepEqual(result.transactions,[{from:'a',to:'b',amountPaise:4000}]);
});
test('Kitty refunds and contributions settle independently from personal payments',()=>{
 const entries=[{recordedBy:'b',kind:'contribution',amountPaise:5000}];
 const payments=[{from:'a',to:'b',amountPaise:2000,ledger:'kitty',state:'accepted'}];
 const result=paymentBalances([],entries,trip,payments);
 assert.deepEqual(result.transactions,[]);
 assert.deepEqual(result.kittySettlement.transactions,[{from:'a',to:'b',amountPaise:3000}]);
});
test('push subscriptions reject local, arbitrary, insecure and lookalike endpoints',()=>{
 const keys={auth:'a'.repeat(22),p256dh:'b'.repeat(87)};
 assert.equal(validSubscription({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys}),true);
 for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.example/x','https://web.push.apple.com:8443/x','https://user@web.push.apple.com/x'])assert.equal(validSubscription({endpoint,keys}),false);
});
