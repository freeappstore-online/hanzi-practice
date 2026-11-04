import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {parseAudioSettings,DEFAULT_AUDIO_SETTINGS} from '../web/src/audio-settings.ts'
import {playbackSources} from '../web/src/playback.ts'
test('audio preferences preserve an explicit order, reject unknown/duplicate sources, and keep one enabled',()=>{
  assert.deepEqual(parseAudioSettings(null),DEFAULT_AUDIO_SETTINGS)
  assert.deepEqual(parseAudioSettings('{'),DEFAULT_AUDIO_SETTINGS)
  assert.deepEqual(parseAudioSettings(JSON.stringify({order:['browser','fake','browser','recordings'],disabled:['kokoro','unknown']})),{order:['browser','recordings','kokoro'],disabled:['kokoro']})
  assert.deepEqual(parseAudioSettings(JSON.stringify({disabled:['recordings','kokoro','browser']})).disabled,[])
})
test('fallback candidates follow the saved order and skip disabled or missing clips',()=>{
  const settings={order:['kokoro','recordings','browser'],disabled:[]}
  assert.deepEqual(playbackSources({kind:'character',text:'一'},settings).map(c=>c.source),['kokoro','recordings','browser'])
  assert.deepEqual(playbackSources({kind:'word',text:'一个',example:{word:'一个',pinyin:'yí gè',meaning:'one'}},settings),[{source:'browser',path:null}])
  assert.deepEqual(playbackSources({kind:'character',text:'一'},{...settings,disabled:['kokoro']}),[{source:'recordings',path:'/audio/v2/4e00.mp3'},{source:'browser',path:null}])
})
test('the optional model files are genuine Kokoro clips with intact checksums',()=>{
  const manifest=JSON.parse(readFileSync('web/public/audio/kokoro/manifest.json','utf8'))
  assert.equal(manifest.model,'hexgrad/Kokoro-82M-v1.1-zh')
  assert.equal(manifest.clips.length,400)
  for(const c of manifest.clips)assert.equal(createHash('sha256').update(readFileSync('web/public/audio/kokoro/'+c.file)).digest('hex'),c.sha256)
})

test('new characters skip absent experimental model clips without requesting a missing file',()=>{
  assert.deepEqual(playbackSources({kind:'character',text:'个'},{order:['kokoro','recordings','browser'],disabled:[]}).map(c=>c.source),['recordings','browser'])
})
