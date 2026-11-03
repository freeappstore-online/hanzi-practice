import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {CHARACTERS} from '../web/src/characters.ts'
import {toneFor} from '../web/src/tones.ts'
test('every character has a validated pronunciation clip matching its displayed reading', () => {
  const manifest=JSON.parse(readFileSync('web/public/audio/manifest.json','utf8'))
  assert.equal(manifest.clips.length,CHARACTERS.length)
  assert.equal(new Set(manifest.clips.map(c => c.hanzi)).size,CHARACTERS.length)
  assert.equal(manifest.model,'hexgrad/Kokoro-82M-v1.1-zh')
  for(const character of CHARACTERS) {
    const clip=manifest.clips.find(c=>c.hanzi===character.hanzi)
    assert.equal(clip.pinyin,character.pinyin)
    assert.equal(clip.tone,toneFor(character.pinyin).number)
    assert.deepEqual(clip.phonemes.match(/[1-5]/g),[String(clip.tone)])
    assert.ok(clip.seconds > .3 && clip.seconds < 4)
    assert.equal(clip.file,character.hanzi.codePointAt(0).toString(16)+'.mp3')
    const data=readFileSync('web/public/audio/'+clip.file)
    assert.ok(data.length>1000)
    assert.equal(createHash('sha256').update(data).digest('hex'),clip.sha256)
  }
})
