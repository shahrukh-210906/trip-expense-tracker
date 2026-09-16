import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionValid,SESSION_LIFETIME_MS} from '../server/auth.mjs';
test('HTTP and realtime reject expired, revoked, and undated sessions',()=>{
  const now=Date.now(),issued=new Date(now-1000);
  assert.equal(sessionValid({tokenCreatedAt:issued},now),true);
  assert.equal(sessionValid({},now),false);
  assert.equal(sessionValid(null,now),false);
  assert.equal(sessionValid({tokenCreatedAt:new Date(now-SESSION_LIFETIME_MS)},now),false);
  assert.equal(sessionValid({tokenCreatedAt:issued,tokenRevokedAt:issued},now),false);
  assert.equal(sessionValid({tokenCreatedAt:issued,tokenRevokedAt:new Date(now-2000)},now),true);
});
