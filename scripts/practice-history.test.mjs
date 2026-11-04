import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ITEM_BY_ID,EMPTY_FILTERS} from '../web/src/catalog.ts'
import {createSession,DEFAULT_SELECTION} from '../web/src/study-state.ts'
import {newRun,runStats,resumeRun,parseHistory,mergeHistory,selectionName,advanceRun} from '../web/src/practice-history.ts'
const items=['char:一','char:二','word:妈妈'].map(id=>ITEM_BY_ID.get(id))
const result={mode:'guided',mistakes:0,hints:0,at:'2026-11-04T00:00:00.000Z'}
test('pack completion counts finished targets, not position; clean rate excludes missing legacy results',()=>{
  const run=newRun(createSession(items),'Numbers')
  run.session.index=2
  assert.equal(runStats(run).percent,0)
  run.results[items[0].id]=result
  assert.deepEqual(runStats(run),{done:1,total:3,percent:33,clean:1,success:100,mistakes:0,hints:0})
  run.results[items[1].id]={...result,mistakes:2,hints:1}
  assert.equal(runStats(run).success,50)
  run.results[items[2].id]=null
  assert.equal(runStats(run).percent,100)
  assert.equal(runStats(run).success,50)
  run.results[items[1].id]=result
  assert.equal(runStats(run).done,3)
  assert.equal(runStats(run).success,100)
})
test('resume retains an unfinished position, advances a completed checkpoint, and revisits skipped targets',()=>{
  const run=newRun(createSession(items),'Numbers')
  assert.equal(resumeRun(run).session.index,0)
  run.results[items[0].id]=result
  assert.equal(resumeRun(run).session.index,1)
  run.session.index=2;run.results[items[2].id]=result
  assert.equal(resumeRun(run).session.index,1)
  run.results[items[1].id]=result
  assert.deepEqual(resumeRun(run).session,{...run.session,index:2,completed:true})
})
test('history validates storage and migrates only the known completed legacy checkpoint',()=>{
  const run=newRun({...createSession(items),index:2,completed:true},'Old queue')
  const history={activeId:run.id,runs:[run]}
  assert.deepEqual(parseHistory(JSON.stringify(history)),history)
  assert.equal(runStats(run).done,1)
  assert.equal(runStats(run).success,null)
  const parsed=parseHistory(JSON.stringify({...history,runs:[{...run,results:{'char:一':{...result,hints:-1},'char:二':{...result,mistakes:'0'},'char:三':result}},run,{...run,id:'bad',session:{}}]}))
  assert.equal(parsed.runs.length,1)
  assert.deepEqual(Object.keys(parsed.runs[0].results),['word:妈妈'])
  assert.deepEqual(parseHistory('{'),{activeId:null,runs:[]})
})
test('multiple tabs merge distinct packs and per-item outcomes without losing current selection',()=>{
  const a=newRun(createSession(items),'A'),b=newRun(createSession(items),'B')
  const updated={...a,updatedAt:'2099-01-01T00:00:00.000Z',results:{'char:一':result}}
  a.results['char:二']={...result,hints:1}
  const merged=mergeHistory({activeId:a.id,runs:[a]},{activeId:b.id,runs:[updated,b]})
  assert.equal(merged.activeId,a.id)
  assert.equal(merged.runs.length,2)
  assert.equal(runStats(merged.runs.find(r=>r.id===a.id)).done,2)
  assert.deepEqual(mergeHistory(merged,merged),merged)
})
test('pack labels describe the selection without freezing saved filter rules',()=>{
  assert.equal(selectionName(DEFAULT_SELECTION),'All practice')
  assert.equal(selectionName({...DEFAULT_SELECTION,search:'你好',filters:{...EMPTY_FILTERS,kind:['kind:word']}}),'你好 · Words')
})

test('advancing skips previously completed targets and stops rather than recording them again',()=>{
  const run=newRun(createSession(items),'Skipped items')
  run.results[items[1].id]=result
  assert.equal(advanceRun(run).session.index,2)
  run.results[items[2].id]=result
  assert.equal(advanceRun(run),run)
})
