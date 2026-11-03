import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parseProgress, appendAttempt, characterStats } from '../web/src/progress.ts'
import { CHARACTERS, LEVELS, charactersForLevel, nextCharacter } from '../web/src/characters.ts'
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
  assert.equal(new Set(CHARACTERS.map(c => c.hanzi)).size,200)
  for (const c of CHARACTERS) {
    const data = JSON.parse(readFileSync(`web/public/characters/${c.hanzi}.json`,'utf8'))
    assert.ok(data.strokes.length > 0)
    assert.equal(data.strokes.length, data.medians.length)
    assert.ok(data.medians.every(points => points.length >= 2))
  }
  assert.ok(readFileSync('web/public/licenses/ARPHICPL.txt','utf8').includes('Arphic'))
})

test('levels partition the collection and next follows levels without wrapping', () => {
  for (const level of LEVELS) assert.equal(charactersForLevel(level.id).length,40)
  assert.equal(nextCharacter(CHARACTERS[39]).level,2)
  assert.equal(nextCharacter(CHARACTERS.at(-1)),null)
})

test('old practice results still load after the collection expands', () => {
  assert.deepEqual(parseProgress(JSON.stringify([attempt])),[attempt])
})
