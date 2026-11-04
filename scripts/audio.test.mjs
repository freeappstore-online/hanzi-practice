import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {CHARACTERS} from '../web/src/characters.ts'
import {toneFor} from '../web/src/tones.ts'
import {EXAMPLES} from '../web/src/examples.ts'
import {audioPath, exampleAudioPath} from '../web/src/audio.ts'
const manifest=JSON.parse(readFileSync('web/public/audio/v2/manifest.json','utf8'))
const numbered=pinyin=>pinyin.split(' ').map(s=>s.normalize('NFD').replace(/u\u0308/g,'v').replace(/[\u0300-\u036f]/g,'')+toneFor(s).number).join('')
const spoken=reading=>reading.replace(/3(?=[a-zv]+3)/g,'2')
function intact(clip) {
  assert.ok(clip.seconds > .3 && clip.seconds < (clip.kind==='word' ? 6 : 4))
  const data=readFileSync('web/public/audio/v2/'+clip.file)
  assert.ok(data.length>1000)
  assert.equal(createHash('sha256').update(data).digest('hex'),clip.sha256)
  if(clip.provider==='human') {
    assert.match(clip.source.license,/^CC-BY/)
    assert.match(clip.source.sourceSha256,/^[a-f0-9]{64}$/)
    assert.ok(clip.source.author)
    assert.match(clip.source.entry,/\.(flac|mp3)$/)
  }
}
test('all character audio has source provenance and matches displayed reading metadata', () => {
  assert.equal(manifest.clips.length,CHARACTERS.length)
  assert.equal(new Set(manifest.clips.map(c=>c.hanzi)).size,CHARACTERS.length)
  assert.equal(manifest.clips.filter(c=>c.provider==='human').length,480)
  for(const character of CHARACTERS) {
    const clip=manifest.clips.find(c=>c.hanzi===character.hanzi)
    assert.equal(clip.pinyin,character.pinyin)
    assert.equal(clip.tone,toneFor(character.pinyin).number)
    assert.equal(audioPath(character.hanzi),'/audio/v2/'+clip.file)
    if(clip.provider==='human') {
      assert.equal(clip.source.reading,numbered(character.pinyin))
      if(clip.source.match==='syllable') {
        assert.equal(clip.sha256,clip.source.sourceSha256,'syllable recordings are unchanged')
        assert.ok(['ma1','mei4','zuo2','min2','er3','bi2','wa4','chong2','nao3','sen1'].includes(clip.source.reading))
      } else {
        assert.equal([...clip.source.text].length,1,'never cut a syllable from a word')
        assert.equal(clip.source.match,clip.source.text===character.hanzi ? 'exact' : 'homophone')
      }
      if(clip.source.originalPinyin) assert.equal(numbered(clip.source.originalPinyin),numbered(character.pinyin))
    } else assert.fail('Only human recordings belong in the production catalog')
    intact(clip)
  }
})
test('word playback only uses complete recordings with matching readings, allowing third-tone sandhi',()=>{
  assert.equal(manifest.words.length,246)
  assert.equal(new Set(manifest.words.map(c=>c.word)).size,manifest.words.length)
  for(const clip of manifest.words) {
    assert.equal(clip.provider,'human')
    assert.equal(clip.source.text,clip.word)
    assert.equal(spoken(clip.source.reading),spoken(numbered(clip.pinyin)))
    intact(clip)
  }
  for(const example of Object.values(EXAMPLES)) {
    const path=exampleAudioPath(example)
    if(path) assert.ok(manifest.words.some(c=>c.word===example.word && c.pinyin===example.pinyin && path==='/audio/v2/'+c.file))
  }
  assert.equal(exampleAudioPath({word:'学生',pinyin:'xué shēng',meaning:'student'}),undefined)
  assert.ok(exampleAudioPath(EXAMPLES['学']))
  assert.equal(manifest.words.find(c=>c.word==='你好').source.reading,'ni2hao3')
})
test('polyphonic source readings cannot replace the selected character pronunciation',()=>{
  for(const [char,pinyin] of [['了','le5'],['长','chang2'],['干','gan1'],['数','shu4'],['相','xiang4'],['还','hai2']]) {
    assert.equal(manifest.clips.find(c=>c.hanzi===char).source.reading,pinyin)
  }
})
