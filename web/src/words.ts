import { CHARACTERS } from './characters'
import { EXAMPLES, type WordExample } from './examples'
import metadata from './word-tags.json'
import { exampleAudioPath } from './audio'
import { toneFor } from './tones'
export type PracticeWord = WordExample
const tags:Record<string,{hsk:number|null;topics:string[];types:string[]}> = metadata
const known = new Map(CHARACTERS.map(c => [c.hanzi,c]))
export const WORDS: PracticeWord[] = [...new Map(Object.values(EXAMPLES).map(e => [e.word,e])).values()]
  .filter(e => [...e.word].length === 2 && [...e.word].every(c => known.has(c)))
  .sort((a,b) => (tags[a.word].hsk??99)-(tags[b.word].hsk??99))
export const WORDS_KEY = 'hanzi-practice:words:v1'
export type Dimension = 'hsk'|'topic'|'type'|'audio'|'tone'
export type WordTag = {id:string;label:string;dimension:Dimension}
export type WordFilters = Record<Dimension,string>
export const EMPTY_FILTERS: WordFilters = {hsk:'',topic:'',type:'',audio:'',tone:''}
export type Grouping = 'none'|'hsk'|'topic'
export type WordProgress = {filters:WordFilters;groupBy:Grouping;counts:Record<string,number>}
export function wordTags(word:WordExample):WordTag[] {
  const info=tags[word.word]
  const hsk=info.hsk===7?'7–9':String(info.hsk)
  const tones=word.pinyin.split(' ').map(p=>toneFor(p).number).join('·')
  return [
    {dimension:'hsk',id:`hsk:${info.hsk??'unlisted'}`,label:info.hsk ? `HSK ${hsk}`:'Unlisted'},
    ...info.topics.map(topic=>({dimension:'topic' as const,id:`topic:${topic}`,label:topic})),
    ...info.types.map(type=>({dimension:'type' as const,id:`type:${type}`,label:type})),
    {dimension:'audio',id:exampleAudioPath(word)?'audio:human':'audio:tts',label:exampleAudioPath(word)?'Human audio':'TTS only'},
    {dimension:'tone',id:`tone:${tones}`,label:tones},
  ]
}
export const WORD_TAGS = [...new Map(WORDS.flatMap(wordTags).map(tag=>[tag.id,tag])).values()]
  .sort((a,b)=>a.id.localeCompare(b.id,'en',{numeric:true}))
export function parseWordProgress(raw: string | null): WordProgress {
  try {
    const data = JSON.parse(raw || 'null')
    const counts: Record<string,number> = {}
    for (const word of WORDS) {
      const count = data?.counts?.[word.word]
      if (Number.isSafeInteger(count) && count > 0) counts[word.word] = count
    }
    const filters={...EMPTY_FILTERS}
    for(const dimension of Object.keys(filters) as Dimension[]) {
      if(WORD_TAGS.some(tag=>tag.dimension===dimension && tag.id===data?.filters?.[dimension]))filters[dimension]=data.filters[dimension]
    }
    return {filters,groupBy:['hsk','topic'].includes(data?.groupBy)?data.groupBy:'none',counts}
  } catch { return {filters:{...EMPTY_FILTERS},groupBy:'none',counts:{}} }
}
