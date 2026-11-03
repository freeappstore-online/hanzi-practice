import assert from 'node:assert/strict'
import {test} from 'node:test'
import {toneFor} from '../web/src/tones.ts'
test('tone display covers marked vowels, umlauts, decomposed pinyin, and neutral tones', () => {
  for (const [pinyin,number] of [['yī',1],['xué',2],['nǚ',3],['lǜ',4],['de',5],['ma',5],['cháng',2],['lǚ'.normalize('NFD'),3]]) {
    assert.equal(toneFor(pinyin).number,number)
  }
})
