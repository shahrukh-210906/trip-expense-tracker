import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';

test('production login requires Google and config never exposes admin credentials',async()=>{
  const app=createApp({},null,{verifyToken:async()=>{throw new Error('Invalid token');}});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    for(const path of ['/session','/session/recover']){
      const response=await fetch(base+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      assert.equal(response.status,403);
    }
    const response=await fetch(base+'/api/session/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:'forged'})});
    assert.equal(response.status,401);
    const config=await (await fetch(base+'/api/auth/config')).json();
    assert.ok(Object.keys(config).every(key=>['apiKey','authDomain','projectId','appId'].includes(key)));
  }finally{await new Promise(resolve=>server.close(resolve));}
});
