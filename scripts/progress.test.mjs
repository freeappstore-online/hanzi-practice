import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseProgress, appendAttempt, characterStats } from '../web/src/progress.ts'
import { CHARACTERS, LEVELS, charactersForLevel } from '../web/src/characters.ts'
const attempt = {character:'一',mode:'recall',mistakes:0,hints:0,at:'2026-01-01T10:00:00Z'}
test('only unaided, error-free recall counts as recalled', () => {
  const progress = [attempt, {...attempt,mode:'guided'}, {...attempt,hints:1}, {...attempt,mistakes:1}]
  assert.deepEqual(characterStats(progress,'一'), {total:4,recalled:1})
})
test('untrusted storage rejects corrupt payloads and drops invalid attempts', () => {
  assert.throws(() => parseProgress('{'))
  assert.throws(() => parseProgress('{}'))
  assert.deepEqual(parseProgress(JSON.stringify([null,{},attempt,{...attempt,mistakes:-1},{...attempt,character:'xxx'},{...attempt,at:'bad'}])), [attempt])
  assert.deepEqual(parseProgress(null), [])
})
test('bounded history retains newest result', () => {
  const next = appendAttempt(Array.from({length:2000}, () => attempt), {...attempt,character:'二'})
  assert.equal(next.length,2000)
  assert.equal(next.at(-1).character,'二')
})
test('every curated character has complete local stroke and median data', () => {
  assert.equal(new Set(CHARACTERS.map(c => c.hanzi)).size,480)
  for (const c of CHARACTERS) {
    const data = JSON.parse(readFileSync(`web/public/characters/${c.hanzi}.json`,'utf8'))
    assert.ok(data.strokes.length > 0)
    assert.equal(data.strokes.length, data.medians.length)
    assert.ok(data.medians.every(points => points.length >= 2))
  }
  assert.ok(readFileSync('web/public/licenses/ARPHICPL.txt','utf8').includes('Arphic'))
})

test('legacy study sets partition the collection', () => {
  for (const level of LEVELS) assert.equal(charactersForLevel(level.id).length,40)
  assert.equal(LEVELS.length,12)
})

test('old practice results still load after the collection expands', () => {
  assert.deepEqual(parseProgress(JSON.stringify([attempt])),[attempt])
})

test('interleaved tab histories stay chronological before trimming old attempts',async()=>{
  const {mergeProgress}=await import('../web/src/progress.ts')
  const first={...attempt,at:'2026-01-01T00:00:00Z'},middle={...attempt,at:'2026-01-02T00:00:00Z'},last={...attempt,at:'2026-01-03T00:00:00Z'}
  assert.deepEqual(mergeProgress([middle,last],[first,middle]),[first,middle,last])
  const older=Array.from({length:2000},(_,i)=>({...attempt,at:new Date(Date.UTC(2025,0,1)+i*1000).toISOString()}))
  const retained=appendAttempt(mergeProgress([middle],older),last)
  assert.deepEqual(retained.slice(-2),[middle,last])
})

test('character totals migrate once and outlive the bounded recent history',async()=>{
  const {parseCharacterTotals,totalsFromProgress,mergeCharacterTotals}=await import('../web/src/progress.ts')
  const {studyStats,ITEM_BY_ID,itemTags}=await import('../web/src/catalog.ts')
  const old=[attempt,{...attempt,mode:'guided',at:'2026-01-02T00:00:00Z'}]
  const totals=totalsFromProgress(old)
  assert.deepEqual(totals,{'一':{total:2,recalled:1}})
  assert.deepEqual(mergeCharacterTotals(totals,totalsFromProgress(old)),totals)
  const stats=studyStats([],{}, {},totals)
  assert.equal(stats.counts['一'],2)
  assert.ok(itemTags(ITEM_BY_ID.get('char:一'),stats).some(tag=>tag.id==='status:practiced'))
  assert.ok(itemTags(ITEM_BY_ID.get('char:一'),stats).some(tag=>tag.id==='status:recalled'))
  assert.deepEqual(parseCharacterTotals(JSON.stringify({...totals,'不存在':{total:4,recalled:0},'二':{total:1,recalled:2}})),totals)
  assert.throws(()=>parseCharacterTotals('{'))
})
