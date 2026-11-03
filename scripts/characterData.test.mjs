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
  fetch.mock.mockImplementation(async()=>new Response(JSON.stringify({strokes:[],medians:[]})))
  assert.deepEqual(await loadCharacterData('二'),{strokes:[],medians:[]})
  assert.equal(fetch.mock.callCount(),2)
})
