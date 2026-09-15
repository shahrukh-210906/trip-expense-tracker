import test from 'node:test';
import assert from 'node:assert/strict';
import { createTripLoader } from '../client/src/tripLoader.mjs';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
test('coalesces updates and discards a response invalidated while in flight', async () => {
  const first = deferred(), second = deferred(), values = [];
  let calls = 0;
  const loader = createTripLoader(() => (++calls === 1 ? first.promise : second.promise), value => values.push(value), assert.fail);
  const completion = loader.request();
  loader.request(); loader.request();
  first.resolve('old'); await Promise.resolve();
  assert.deepEqual(values, []);
  second.resolve('new'); assert.equal(await completion, true);
  assert.equal(calls, 2); assert.deepEqual(values, ['new']);
});
test('trip changes dispose pending refreshes without updating the new screen', async () => {
  const request = deferred(), values = [];
  const loader = createTripLoader(() => request.promise, v => values.push(v), assert.fail);
  const completion = loader.request(); loader.stop(); request.resolve('previous trip');
  await completion; assert.deepEqual(values, []); assert.equal(await loader.request(), false);
});
test('failed refreshes recover on the next notification', async () => {
  let calls = 0; const errors = [], values = [];
  const loader = createTripLoader(async () => { if (++calls === 1) throw new Error('offline'); return 'reconnected'; }, v => values.push(v), e => errors.push(e.message));
  assert.equal(await loader.request(), false); assert.equal(await loader.request(), true);
  assert.deepEqual(errors, ['offline']); assert.deepEqual(values, ['reconnected']);
});
