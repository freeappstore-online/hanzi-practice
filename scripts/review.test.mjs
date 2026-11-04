import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { CHARACTERS } from '../web/src/characters.ts'
import { REVIEW_KEY, recordReview, migrateReview, parseReview, dueReviews, mergeReview } from '../web/src/review.ts'
const now = Date.parse('2026-10-01T12:00:00Z')
const day = 86_400_000
const event = (overrides = {}) => ({id:'first',character:'一',mode:'recall',mistakes:0,hints:0,at:new Date(now).toISOString(),completed:true,...overrides})
test('recall intervals grow only when due, and mistakes reset them', () => {
  let state = recordReview({},event())
  assert.equal(state['一'].due,now+day)
  state=recordReview(state,event({id:'early',at:new Date(now+1000).toISOString()}))
  assert.equal(state['一'].stage,1)
  assert.equal(state['一'].due,now+day)
  state=recordReview(state,event({id:'due',at:new Date(now+day).toISOString()}))
  assert.equal(state['一'].stage,2)
  assert.equal(state['一'].due,now+4*day)
  state=recordReview(state,event({id:'weak',mistakes:2,at:new Date(now+4*day).toISOString()}))
  assert.equal(state['一'].stage,0)
  assert.equal(state['一'].due,now+4*day+600000)
})
test('unfinished mistakes save immediately, incremental hints do not double count', () => {
  let state=recordReview({},event({completed:false,mistakes:1}))
  assert.equal(dueReviews(state,now).length,1)
  state=recordReview(state,event({completed:false,mistakes:2,hints:1}))
  state=recordReview(state,event({mistakes:2,hints:1}))
  assert.equal(state['一'].totalMistakes,2)
  assert.equal(state['一'].totalHints,1)
  assert.equal(dueReviews(state,now).length,0)
  assert.deepEqual(recordReview(state,event({mistakes:2,hints:1})),state)
})
test('old attempts migrate once, review state survives bounded history, guided practice returns soon', () => {
  const attempts=[event({mode:'guided'})].map(({id,completed,...a}) => a)
  const state=migrateReview({},attempts)
  assert.equal(state['一'].due,now+600000)
  assert.deepEqual(migrateReview(state,attempts),state)
  assert.deepEqual(migrateReview(state,[]),state)
  assert.deepEqual(parseReview(JSON.stringify(state)),state)
  assert.equal(typeof REVIEW_KEY,'string')
})
test('queue orders difficult characters first and excludes future reviews', () => {
  let state=recordReview({},event({character:'二',id:'two'}))
  state=recordReview(state,event({character:'三',id:'three',mistakes:3,completed:false}))
  state=recordReview(state,event({character:'一',id:'one',mistakes:1,completed:false}))
  assert.deepEqual(dueReviews(state,now).map(e=>e.character),['三','一'])
  assert.equal(dueReviews(state,now+day).length,3)
  assert.deepEqual(mergeReview(state,{}),state)
})
test('corrupt review entries cannot create characters or invalid due dates', () => {
  assert.throws(()=>parseReview('{'))
  assert.throws(()=>parseReview('[]'))
  assert.deepEqual(parseReview(JSON.stringify({'fake':event(),'一':{...event(),due:-1}})),{})
})
test('every character has a matching word example, and illustrations are bundled', () => {
  const examples=JSON.parse(readFileSync('web/src/examples.json','utf8'))
  assert.equal(Object.keys(examples).length,480)
  for(const c of CHARACTERS){
    const e=examples[c.hanzi]
    assert.ok(e.word.includes(c.hanzi),c.hanzi)
    assert.equal(e.pinyin.split(' ').length,[...e.word].length,c.hanzi)
    assert.ok(e.meaning.length>0)
    if(e.image) assert.ok(existsSync(`web/public/examples/${e.image}.png`))
  }
  assert.equal(examples['照'].pinyin,'zhào piàn')
  assert.equal(examples['教'].pinyin,'jiāo shū')
  assert.equal(examples['地'].pinyin,'dì tiě')
})

test('guided practice cannot use a short retry interval to inflate an established recall stage', () => {
  let state=recordReview({},event())
  state=recordReview(state,event({id:'second',at:new Date(now+day).toISOString()}))
  assert.equal(state['一'].stage,2)
  state=recordReview(state,event({id:'guided',mode:'guided',at:new Date(now+day+1000).toISOString()}))
  assert.equal(state['一'].stage,0)
  state=recordReview(state,event({id:'recall',at:new Date(now+day+601000).toISOString()}))
  assert.equal(state['一'].stage,1)
  assert.equal(state['一'].due,now+2*day+601000)
})
