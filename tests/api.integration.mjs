import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { attachRealtime } from '../server/realtime.mjs';
const { io: connectSocket } = createRequire(new URL('../client/package.json', import.meta.url))('socket.io-client');
const eventOnce = (socket, name) => new Promise((resolve, reject) => {
  const handler = value => { clearTimeout(timer); resolve(value); };
  const timer = setTimeout(() => { socket.off(name, handler); reject(new Error('Timed out waiting for ' + name)); }, 5000);
  socket.once(name, handler);
});
import { connectDatabase,disconnectDatabase } from '../server/database.mjs';
import { createModels } from '../server/models.mjs';
import { createApp } from '../server/app.mjs';

test('live MongoDB API workflow in an isolated disposable database',async t=>{
  const databaseName='ttest_'+randomUUID().replaceAll('-','');
  let database,server,live; const sockets=[];
  try{
    const connection=await connectDatabase();
    database=connection.useDb(databaseName,{useCache:true});
    const models=createModels(database);
    for(const model of Object.values(models))await model.createIndexes();
    const app=createApp(models,database);
    server=createServer(app);live=attachRealtime(server,models);app.set('live',live);
    server.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    async function request(path,token,body){
      const response=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{
        'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      return {status:response.status,...await response.json()};
    }
    const lead=await request('/session',null,{displayName:'Lead'}),member=await request('/session',null,{displayName:'Member'}),
      outsider=await request('/session',null,{displayName:'Outsider'});
    let trip;
    await t.test('authentication, creation, and joining use separate server identities',async()=>{
      assert.equal((await request('/trips')).status,401);
      assert.notEqual(lead.user._id,member.user._id);
      const created=await request('/trips/create',lead.token,{name:'Integration trip',userId:outsider.user._id});
      assert.equal(created.status,201);trip=created.trip;
      assert.deepEqual(trip.groupLeads,[lead.user._id]);
      const joined=await request('/trips/join',member.token,{joinCode:trip.joinCode.toLowerCase()});
      assert.equal(joined.status,200);assert.equal(joined.trip.purseBalancePaise,undefined);
      await request('/trips/join',member.token,{joinCode:trip.joinCode});
      assert.equal((await request('/trips/'+trip._id,lead.token)).members.length,2);
      assert.equal((await request('/trips/'+trip._id,outsider.token)).status,404);
      assert.equal((await request('/trips/join',member.token,{})).status,400);
    });
    const entry=fields=>({tripId:trip._id,ledger:'personal',title:'Lunch',amountPaise:60000,
      splitAmong:[member.user._id],clientId:randomUUID(),clientCreatedAt:new Date().toISOString(),...fields});
    const sync=(token,e)=>request('/expenses/sync',token,{offlineExpenses:[e]});
    await t.test('personal expenses, private visibility, ownership, and retry protection',async()=>{
      const shared=entry({});
      const results=await Promise.all([sync(lead.token,shared),sync(lead.token,shared)]);
      assert.ok(results.every(r=>r.syncedCount===1));
      assert.equal((await sync(lead.token,{...shared,amountPaise:70000})).errors.length,1);
      assert.equal((await sync(member.token,entry({title:'Private coffee',amountPaise:100}))).syncedCount,1);
      assert.equal((await sync(member.token,entry({recordedBy:lead.user._id}))).errors.length,1);
      assert.equal((await sync(outsider.token,entry({}))).errors.length,1);
      const leadView=await request('/trips/'+trip._id,lead.token),memberView=await request('/trips/'+trip._id,member.token);
      assert.equal(leadView.expenses.length,1);assert.equal(memberView.expenses.length,2);
      assert.deepEqual(leadView.transactions,[{from:member.user._id,to:lead.user._id,amountPaise:60000}]);
    });
    await t.test('purse contributions retry once, spending is atomic and restricted',async()=>{
      const contribution=entry({ledger:'purse',kind:'contribution',title:'Contribution',amountPaise:1000});
      const contributions=await Promise.all([sync(member.token,contribution),sync(member.token,contribution)]);
      assert.ok(contributions.every(r=>r.syncedCount===1));
      assert.equal((await request('/trips/'+trip._id,lead.token)).trip.purseBalancePaise,1000);
      assert.equal((await sync(member.token,entry({ledger:'purse',kind:'expense',amountPaise:100}))).errors.length,1);
      const spent=await Promise.all([sync(lead.token,entry({ledger:'purse',kind:'expense',amountPaise:700})),
        sync(lead.token,entry({ledger:'purse',kind:'expense',amountPaise:700}))]);
      assert.equal(spent.reduce((sum,r)=>sum+r.syncedCount,0),1);
      const leadView=await request('/trips/'+trip._id,lead.token),memberView=await request('/trips/'+trip._id,member.token);
      assert.equal(leadView.trip.purseBalancePaise,300);
      assert.equal(leadView.purseEntries.length,2);assert.equal(memberView.purseEntries.length,1);
      assert.equal(memberView.trip.purseBalancePaise,undefined);
      assert.equal(leadView.transactions[0].amountPaise,60000);
      assert.equal(await models.PurseEntry.countDocuments(),2);
    });
    const openSocket=async(token,tripId,expected='connect')=>{
      const socket=connectSocket(base,{auth:{token,tripId},transports:['websocket'],autoConnect:false,reconnection:false});
      sockets.push(socket);const event=eventOnce(socket,expected);socket.connect();await event;return socket;
    };
    await t.test('socket subscriptions reject missing tokens, outsiders, and invalid trip IDs',async()=>{
      for(const [token,id] of [[null,trip._id],[outsider.token,trip._id],[lead.token,'bad']]){
        const socket=await openSocket(token,id,'connect_error');assert.equal(socket.connected,false);
      }
    });
    const leadSocket=await openSocket(lead.token,trip._id),memberSocket=await openSocket(member.token,trip._id);
    const otherTrip=(await request('/trips/create',outsider.token,{name:'Unrelated trip'})).trip;
    const otherSocket=await openSocket(outsider.token,otherTrip._id);
    const observations=[[],[],[]],watchers=[leadSocket,memberSocket,otherSocket];
    watchers.forEach((socket,index)=>socket.on('trip:changed',event=>observations[index].push(event)));
    const drain=async()=>{
      // A barrier queued after notifications verifies absence without arbitrary sleeps.
      const waits=watchers.filter(s=>s.connected).map(s=>eventOnce(s,'test:barrier'));
      live.io.emit('test:barrier');await Promise.all(waits);
    };
    const clear=()=>observations.forEach(events=>events.splice(0));
    const verify=async counts=>{
      await drain();assert.deepEqual(observations.map(events=>events.length),counts);
      observations.flat().forEach(event=>assert.deepEqual(event,{tripId:trip._id}));clear();
    };
    await t.test('private notifications stay with their owner; shared expenses notify only their trip',async()=>{
      await sync(member.token,entry({title:'Secret',amountPaise:1}));await verify([0,1,0]);
      const shared=entry({amountPaise:10});
      await sync(lead.token,shared);await verify([1,1,0]);
      await sync(lead.token,shared);await verify([0,0,0]);
      await sync(outsider.token,entry({}));await verify([0,0,0]);
    });
    await t.test('purse visibility and failed spending apply equally to live notifications',async()=>{
      await sync(lead.token,entry({ledger:'purse',kind:'contribution',amountPaise:100}));await verify([1,0,0]);
      await sync(member.token,entry({ledger:'purse',kind:'contribution',amountPaise:100}));await verify([1,1,0]);
      await sync(lead.token,entry({ledger:'purse',kind:'expense',amountPaise:1}));await verify([1,0,0]);
      await sync(lead.token,entry({ledger:'purse',kind:'expense',amountPaise:100000}));await verify([0,0,0]);
      memberSocket.emit('joinTripRoom',otherTrip._id);
      await sync(outsider.token,{...entry({}),tripId:otherTrip._id,splitAmong:[outsider.user._id]});
      await drain();assert.deepEqual(observations.map(events=>events.length),[0,0,1]);clear();
    });
    await t.test('joining refreshes member lists and reconnects recheck authorization',async()=>{
      await request('/trips/join',outsider.token,{joinCode:trip.joinCode});await verify([1,1,0]);
      memberSocket.disconnect();
      const missed=entry({title:'While disconnected',amountPaise:1});await sync(lead.token,missed);await verify([1,0,0]);
      const connected=eventOnce(memberSocket,'connect');memberSocket.connect();await connected;
      const snapshot=await request('/trips/'+trip._id,member.token);
      assert.ok(snapshot.expenses.some(e=>e.clientId===missed.clientId));
      assert.equal(snapshot.members.length,3);
      memberSocket.disconnect();
      await models.Trip.updateOne({_id:trip._id},{$pull:{participants:member.user._id}});
      const denied=eventOnce(memberSocket,'connect_error');memberSocket.connect();await denied;
      assert.equal(memberSocket.connected,false);
    });
  }finally{
    sockets.forEach(socket=>socket.disconnect());
    if(live)await new Promise(resolve=>live.io.close(resolve));
    else if(server)await new Promise(resolve=>server.close(resolve));
    // Only delete the fresh UUID database created by this test, never the configured application database.
    try {
      if(database&&database.name===databaseName&&/^ttest_[a-f0-9]{32}$/.test(databaseName))await database.dropDatabase();
    } finally { await disconnectDatabase(); }
  }
});
