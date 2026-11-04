import {test} from 'node:test'
import assert from 'node:assert/strict'
import {loadCharacterData} from '../web/src/characterData.ts'

test('preloading and writing share in-flight requests and parsed data',async t=>{
  let finish
  const response=new Promise(resolve=>{finish=resolve})
  const fetch=t.mock.method(globalThis,'fetch',()=>response)
  const preload=loadCharacterData('一')
  const writing=loadCharacterData('一')
  assert.equal(fetch.mock.callCount(),1)
  finish(new Response(JSON.stringify({strokes:['path'],medians:[[[0,0],[1,1]]]})))
  assert.deepEqual(await writing,await preload)
  await loadCharacterData('一')
  assert.equal(fetch.mock.callCount(),1)
})
test('failed speculative requests do not poison later loads',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}))
  await assert.rejects(loadCharacterData('二'))
  const valid={strokes:['path'],medians:[[[0,0],[1,1]]]}
  fetch.mock.mockImplementation(async()=>new Response(JSON.stringify(valid)))
  assert.deepEqual(await loadCharacterData('二'),valid)
  assert.equal(fetch.mock.callCount(),2)
})

test('malformed successful responses are evicted so retry can load corrected data',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({strokes:['path'],medians:[]})))
  await assert.rejects(loadCharacterData('三'),/Invalid character data/)
  const valid={strokes:['path'],medians:[[[0,0],[1,1]]]}
  fetch.mock.mockImplementation(async()=>new Response(JSON.stringify(valid)))
  assert.deepEqual(await loadCharacterData('三'),valid)
  assert.equal(fetch.mock.callCount(),2)
})

test('stalled character downloads time out and can be retried',async t=>{
  t.mock.timers.enable({apis:['setTimeout']})
  const fetch=t.mock.method(globalThis,'fetch',(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))))
  const result=assert.rejects(loadCharacterData('四'),/aborted/)
  t.mock.timers.tick(15000)
  await result
  const valid={strokes:['path'],medians:[[[0,0],[1,1]]]}
  fetch.mock.mockImplementation(async()=>new Response(JSON.stringify(valid)))
  assert.deepEqual(await loadCharacterData('四'),valid)
})
