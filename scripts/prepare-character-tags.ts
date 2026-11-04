// Use the pinned complete.json documented in docs/words.md.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { CHARACTERS } from '../web/src/characters'
import topics from './character-topics.json'

const source = readFileSync(process.argv[2])
const checksum = 'c869a0ce353279c9333d9b42c31fc3549785e8b40673dab57ee42bc99cd14131'
if (createHash('sha256').update(source).digest('hex') !== checksum) throw new Error('Expected the pinned HSK vocabulary source')
type Entry = { simplified: string; level: string[]; pos: string[]; forms: { transcriptions: { pinyin: string } }[] }
const entries = new Map<string, Entry>(JSON.parse(source.toString()).map((e: Entry) => [e.simplified, e]))
const types: Record<string, string> = {
  n:'Noun',nr:'Proper noun',ns:'Place name',nt:'Proper noun',nz:'Proper noun',
  v:'Verb',vn:'Verb',vd:'Verb',a:'Adjective',ad:'Adjective',an:'Adjective',b:'Adjective',z:'Adjective',
  d:'Adverb',r:'Pronoun',m:'Number',q:'Measure word',p:'Preposition',c:'Conjunction',
  u:'Particle',y:'Particle',e:'Interjection',o:'Interjection',t:'Time word',s:'Location',f:'Location',i:'Expression',l:'Expression',
}
const result = Object.fromEntries(CHARACTERS.map(character => {
  const candidate = entries.get(character.hanzi)
  // A glyph match alone cannot confirm the selected reading of a polyphonic character.
  const entry = candidate?.forms.some(form => form.transcriptions.pinyin === character.pinyin) ? candidate : undefined
  const levels = entry?.level.filter(level => level.startsWith('newest-')).map(level => Number(level.split('-')[1])) ?? []
  const topic = (topics as Record<string, string>)[character.group]
  if (!topic) throw new Error(`Missing curated topic for ${character.group}`)
  const strokes = JSON.parse(readFileSync(`web/public/characters/${character.hanzi}.json`, 'utf8')).strokes.length
  return [character.hanzi, {
    hsk: levels.length ? Math.min(...levels) : null,
    types: [...new Set((entry?.pos ?? []).map(pos => types[pos]).filter(Boolean))].sort(),
    topic,
    strokes,
  }]
}))
writeFileSync('web/src/character-tags.json', JSON.stringify(result, null, 2) + '\n')
console.log(`Tagged ${Object.keys(result).length} characters.`)
