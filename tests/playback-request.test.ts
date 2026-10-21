import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackRequest } from '../app/playback-request.ts';
test('rapid switching ignores old failures but reports a failure of the selected track', async () => {
  const player=new PlaybackRequest(); let rejectOld!: (e: Error)=>void; let errors=0;
  const old=player.run(()=>new Promise((_,reject)=>{rejectOld=reject;}),()=>errors++);
  await player.run(()=>Promise.resolve(),()=>errors++);
  rejectOld(new Error('old stream cancelled')); await old; assert.equal(errors,0);
  await player.run(()=>Promise.reject(Object.assign(new Error('interrupted'),{name:'AbortError'})),()=>errors++);
  assert.equal(errors,0);
  await player.run(()=>Promise.reject(new Error('network unavailable')),()=>errors++);
  assert.equal(errors,1);
});
test('pause invalidates pending playback failure', async () => {
  const player=new PlaybackRequest(); let reject!: (e:Error)=>void; let errors=0;
  const pending=player.run(()=>new Promise((_,r)=>{reject=r;}),()=>errors++);
  player.cancel(); reject(new Error('stopped')); await pending; assert.equal(errors,0);
});
