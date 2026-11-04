import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {WORDS,wordTags,EMPTY_FILTERS,parseWordProgress} from '../web/src/words.ts'
import {EXAMPLES} from '../web/src/examples.ts'
import {exampleAudioPath} from '../web/src/audio.ts'
test('every example is tagged; every practice word has exactly two bundled writing tiles',()=>{
  const tags=JSON.parse(readFileSync('web/src/word-tags.json'))
  assert.equal(Object.keys(tags).length,new Set(Object.values(EXAMPLES).map(e=>e.word)).size)
  assert.equal(WORDS.length,272)
  assert.equal(new Set(WORDS.map(w=>w.word)).size,272)
  assert.equal(WORDS.filter(exampleAudioPath).length,169)
  for(const example of Object.values(EXAMPLES)) {
    assert.ok(tags[example.word].topics.length)
    assert.ok(tags[example.word].types.length)
    assert.ok(tags[example.word].hsk===null || [1,2,3,4,5,6,7].includes(tags[example.word].hsk))
  }
  for(const word of WORDS) {
    assert.equal([...word.word].length,2)
    assert.equal(word.pinyin.split(' ').length,2)
    for(const c of word.word)assert.ok(existsSync(`web/public/characters/${c}.json`))
  }
})
test('HSK difficulty, topic, word type, human audio and tone filters intersect',()=>{
  assert.equal(wordTags(WORDS.find(w=>w.word==='学生')).find(t=>t.dimension==='hsk').label,'HSK 1')
  assert.equal(wordTags(WORDS.find(w=>w.word==='五天')).find(t=>t.dimension==='hsk').label,'Unlisted')

})
test('word preferences preserve valid filters and counts without accepting corrupted values',()=>{
  const data=parseWordProgress(JSON.stringify({filters:{hsk:'hsk:1',topic:'topic:fake'},groupBy:'topic',counts:{'妈妈':2,'不存在':9,'爸爸':-1}}))
  assert.equal(data.filters.hsk,'hsk:1');assert.equal(data.filters.topic,'')
  assert.equal(data.groupBy,'topic');assert.deepEqual(data.counts,{'妈妈':2})
  assert.deepEqual(parseWordProgress('{'),{filters:EMPTY_FILTERS,groupBy:'none',counts:{}})
})
