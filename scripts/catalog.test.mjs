import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {CATALOG,DIMENSIONS,EMPTY_FILTERS,ITEM_BY_ID,filterCatalog,lookupCatalog,groupCatalog,itemTags,studyStats} from '../web/src/catalog.ts'
import {createSession,parseSession,advanceSession,parseStudyPreferences} from '../web/src/study-state.ts'
import {parseReview,recordReview} from '../web/src/review.ts'
const empty=studyStats([],{},{}),word=ITEM_BY_ID.get('word:妈妈'),one=ITEM_BY_ID.get('char:一')
test('one catalog gives every character and word accurate tags and stroke totals',()=>{
  assert.equal(CATALOG.length,846);assert.equal(new Set(CATALOG.map(i=>i.id)).size,846)
  for(const item of CATALOG){
    const strokes=[...item.text].reduce((n,c)=>n+JSON.parse(readFileSync(`web/public/characters/${c}.json`)).strokes.length,0)
    assert.equal(item.strokes,strokes)
    for(const dimension of ['kind','hsk','topic','type','tone','audio','strokes'])assert.ok(item.tags.some(t=>t.dimension===dimension),item.id+dimension)
  }
})
test('multiple labels OR within a dimension and intersect across dimensions',()=>{
  const result=filterCatalog({...EMPTY_FILTERS,kind:['kind:word'],hsk:['hsk:1'],topic:['topic:Food & drink'],type:['type:Noun'],audio:['audio:human']},'',empty)
  assert.deepEqual(result.map(i=>i.text),['米饭','水果','鸡蛋','牛奶'])
  const both=filterCatalog({...EMPTY_FILTERS,kind:['kind:word','kind:character'],tone:['tone:1','tone:1·5']},'',empty)
  assert.ok(both.includes(one));assert.ok(both.includes(word))
  assert.ok(filterCatalog({...EMPTY_FILTERS,kind:['kind:character'],set:['set:2']},'',empty).length===40)
})
test('every dimension can group without dropping unassigned items',()=>{
  for(const dimension of Object.keys(DIMENSIONS)){
    const grouped=groupCatalog(CATALOG,dimension,empty)
    assert.equal(new Set(grouped.flatMap(g=>g.items.map(i=>i.id))).size,CATALOG.length,dimension)
  }
})
test('dynamic progress labels recalculate for words and characters',()=>{
  const at='2026-11-04T00:00:00Z'
  const event={id:'word-run',character:'妈妈',mode:'recall',mistakes:1,hints:0,at,completed:false}
  const reviews=recordReview({},event)
  assert.deepEqual(parseReview(JSON.stringify(reviews)),reviews)
  const stats=studyStats([],{妈妈:2},reviews)
  assert.ok(itemTags(word,stats,Date.parse(at)+1).some(t=>t.id==='status:due'))
  assert.ok(itemTags(word,stats).some(t=>t.id==='status:weak'))
  assert.deepEqual(filterCatalog({...EMPTY_FILTERS,status:['status:due'],kind:['kind:word']},'',stats,Date.parse(at)+1),[word])
  assert.ok(!itemTags(word,stats).some(t=>t.id==='status:new'))
})
test('sessions snapshot and rotate unique items, stop at the end, and validate persisted checkpoints',()=>{
  const session=createSession([one,word,one],word.id,'recall')
  assert.deepEqual(session.ids,[word.id,one.id])
  assert.deepEqual(parseSession(JSON.stringify(session)),session)
  const last=advanceSession(session)
  assert.equal(advanceSession(last),last)
  assert.equal(parseSession(JSON.stringify({...session,ids:['char:unknown']})),null)
  assert.equal(parseSession(JSON.stringify({...session,index:20})),null)
  assert.equal(parseSession(JSON.stringify({...session,ids:[one.id,one.id]})),null)
  assert.equal(parseSession('{'),null)
  assert.equal(createSession([]),null)
})
test('saved selections keep rules rather than copied item lists and sanitize invalid dimensions',()=>{
  const saved=parseStudyPreferences(JSON.stringify({filters:{hsk:['hsk:1','hsk:bad'],kind:['kind:word']},groupBy:'tone',saved:[{id:'x',name:'New words',filters:{status:['status:new'],kind:['kind:word']},ids:['fake']}]}))
  assert.equal(parseStudyPreferences(JSON.stringify({groupBy:'constructor'})).groupBy,'none')
  assert.deepEqual(saved.filters.hsk,['hsk:1']);assert.equal(saved.groupBy,'tone')
  assert.equal(saved.saved[0].ids,undefined)
  const initial=filterCatalog(saved.saved[0].filters,'',empty).length
  const updated=filterCatalog(saved.saved[0].filters,'',studyStats([],{妈妈:1},{})).length
  assert.equal(updated,initial-1)
})

test('search finds multi-syllable pinyin with or without spaces and keeps pack filters',()=>{
  for(const query of ['xuesheng','XUE SHENG','  xué   shēng  '])assert.ok(filterCatalog(EMPTY_FILTERS,query,empty).some(i=>i.id==='word:学生'),query)
  for(const query of ['mama','mā ma'])assert.ok(filterCatalog(EMPTY_FILTERS,query,empty).some(i=>i.id==='word:妈妈'),query)
  assert.deepEqual(filterCatalog({...EMPTY_FILTERS,kind:['kind:character']},'mama',empty),[])
  assert.ok(filterCatalog(EMPTY_FILTERS,'drink water',empty).some(i=>i.text==='喝水'))
})
test('lookup ranks exact matches first while pack order stays unchanged',()=>{
  assert.equal(lookupCatalog('学生',empty)[0].id,'word:学生')
  assert.equal(lookupCatalog('xuesheng',empty)[0].id,'word:学生')
  assert.equal(lookupCatalog('water',empty)[0].id,'char:水')
  assert.deepEqual(lookupCatalog('   ',empty),[])
  assert.deepEqual(filterCatalog(EMPTY_FILTERS,'',empty).map(i=>i.id),CATALOG.map(i=>i.id))
})
