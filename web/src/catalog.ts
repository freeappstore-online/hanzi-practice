import { CHARACTERS, LEVELS, type Character } from './characters'
import { WORDS, wordTags } from './words'
import characterMetadata from './character-tags.json'
import { toneFor } from './tones'
import type { WordExample } from './examples'
import type { CharacterTotals, Progress } from './progress'
import type { ReviewState } from './review'

export type Dimension = 'kind'|'hsk'|'topic'|'type'|'tone'|'audio'|'strokes'|'set'|'status'
export type Tag = {id:string;label:string;dimension:Dimension}
export type StudyItem = {id:string;text:string;pinyin:string;meaning:string;kind:'character'|'word';character?:Character;word?:WordExample;tags:Tag[];strokes:number}
export type Filters = Record<Dimension,string[]>
export type Grouping = 'none'|Dimension
export type Sort = 'catalog'|'hsk'|'strokes'|'due'
export const DIMENSIONS:Record<Dimension,string>={kind:'Content',hsk:'HSK 3.0 (2026)',topic:'Topic',type:'Word type',tone:'Tone pattern',audio:'Audio',strokes:'Stroke count',set:'Study set',status:'Progress'}
export const EMPTY_FILTERS:Filters={kind:[],hsk:[],topic:[],type:[],tone:[],audio:[],strokes:[],set:[],status:[]}
const meta:Record<string,{hsk:number|null;types:string[];topic:string;strokes:number}>=characterMetadata
const tag=(dimension:Dimension,value:string,label:string):Tag=>({id:`${dimension}:${value}`,dimension,label})
const hskTag=(hsk:number|null)=>tag('hsk',String(hsk??'unlisted'),hsk ? `HSK ${hsk===7?'7–9':hsk}`:'Unlisted')
const strokeTag=(count:number)=>tag('strokes',count<=5?'1-5':count<=10?'6-10':count<=20?'11-20':'21+',count<=5?'1–5 strokes':count<=10?'6–10 strokes':count<=20?'11–20 strokes':'21+ strokes')
export const CATALOG:StudyItem[]=[
  ...CHARACTERS.map(c=>({id:`char:${c.hanzi}`,text:c.hanzi,pinyin:c.pinyin,meaning:c.meaning,kind:'character' as const,character:c,strokes:meta[c.hanzi].strokes,tags:[
    tag('kind','character','Characters'),hskTag(meta[c.hanzi].hsk),tag('topic',meta[c.hanzi].topic,meta[c.hanzi].topic),
    ...(meta[c.hanzi].types.length?meta[c.hanzi].types:['Unclassified']).map(t=>tag('type',t,t)),
    tag('tone',String(toneFor(c.pinyin).number),`Tone ${toneFor(c.pinyin).number}`),tag('audio','human','Human audio'),strokeTag(meta[c.hanzi].strokes),
    tag('set',String(c.level),`Set ${c.level} · ${LEVELS.find(l=>l.id===c.level)!.name}`),
  ]})),
  ...WORDS.map(w=>{
    const strokes=[...w.word].reduce((sum,c)=>sum+meta[c].strokes,0)
    return {id:`word:${w.word}`,text:w.word,pinyin:w.pinyin,meaning:w.meaning,kind:'word' as const,word:w,strokes,tags:[tag('kind','word','Words'),...wordTags(w),strokeTag(strokes)]}
  }),
]
export const ITEM_BY_ID=new Map(CATALOG.map(item=>[item.id,item]))
export const ITEM_BY_TEXT=new Map(CATALOG.map(item=>[item.text,item]))
const STATUS_TAGS=[tag('status','new','New'),tag('status','practiced','Practised'),tag('status','due','Ready to review'),tag('status','weak','Needs work'),tag('status','recalled','Recalled')]
export const TAGS=[...new Map([...CATALOG.flatMap(item=>item.tags),...STATUS_TAGS].map(t=>[t.id,t])).values()].sort((a,b)=>a.id.localeCompare(b.id,'en',{numeric:true}))
export type StudyStats={counts:Record<string,number>;reviews:ReviewState;recalled:Set<string>}
export function studyStats(progress:Progress,wordCounts:Record<string,number>,reviews:ReviewState,totals:CharacterTotals={}):StudyStats {
  const counts:Record<string,number>={...wordCounts},recalled=new Set<string>()
  for(const attempt of progress){counts[attempt.character]=(counts[attempt.character]??0)+1;if(attempt.mode==='recall' && !attempt.hints && !attempt.mistakes)recalled.add(attempt.character)}
  for(const [character,count] of Object.entries(totals)){counts[character]=Math.max(counts[character]??0,count.total);if(count.recalled)recalled.add(character)}
  for(const entry of Object.values(reviews))if(entry.completed && entry.mode==='recall' && !entry.mistakes && !entry.hints)recalled.add(entry.character)
  return {counts,reviews,recalled}
}
export function itemTags(item:StudyItem,stats:StudyStats,now=Date.now()):Tag[] {
  const review=stats.reviews[item.text]
  const status=[stats.counts[item.text]?'practiced':'new',...(review?.due<=now?['due']:[]),...(review && (review.mistakes||review.hints||!review.completed)?['weak']:[]),...(stats.recalled.has(item.text)?['recalled']:[])]
  return [...item.tags,...STATUS_TAGS.filter(t=>status.includes(t.id.slice(7)))]
}
const normalizeSearch=(text:string)=>text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ')
const compactPinyin=(text:string)=>normalizeSearch(text).replace(/\s/g,'')
export function filterCatalog(filters:Filters,search:string,stats:StudyStats,now=Date.now(),sort:Sort='catalog'):StudyItem[] {
  const query=normalizeSearch(search),compact=compactPinyin(query)
  const items=CATALOG.filter(item=>(normalizeSearch(`${item.text} ${item.pinyin} ${item.meaning}`).includes(query)||compactPinyin(item.pinyin).includes(compact)) && Object.values(filters).every(ids=>!ids.length || itemTags(item,stats,now).some(t=>ids.includes(t.id))))
  if(sort==='strokes')items.sort((a,b)=>a.strokes-b.strokes)
  if(sort==='hsk')items.sort((a,b)=>Number(a.tags.find(t=>t.dimension==='hsk')!.id.slice(4).replace('unlisted','99'))-Number(b.tags.find(t=>t.dimension==='hsk')!.id.slice(4).replace('unlisted','99')))
  if(sort==='due')items.sort((a,b)=>(stats.reviews[a.text]?.due??Infinity)-(stats.reviews[b.text]?.due??Infinity))
  return items
}
export function groupCatalog(items:StudyItem[],dimension:Grouping,stats:StudyStats,now=Date.now()) {
  if(dimension==='none')return [{id:'all',label:'',items}]
  const groups=TAGS.filter(t=>t.dimension===dimension).map(t=>({id:t.id,label:t.label,items:items.filter(item=>itemTags(item,stats,now).some(tag=>tag.id===t.id))})).filter(g=>g.items.length)
  const missing=items.filter(item=>!itemTags(item,stats,now).some(t=>t.dimension===dimension))
  if(missing.length)groups.push({id:'unassigned',label:'Not assigned',items:missing})
  return groups
}
export function parseFilters(value:unknown):Filters {
  const data=value as Partial<Filters>|null
  return Object.fromEntries(Object.keys(DIMENSIONS).map(dimension=>[dimension,TAGS.filter(t=>t.dimension===dimension && Array.isArray(data?.[dimension as Dimension]) && data![dimension as Dimension]!.includes(t.id)).map(t=>t.id)])) as Filters
}

// Lookup prioritizes exact matches without changing the order of practice packs.
export function lookupCatalog(search:string,stats:StudyStats):StudyItem[] {
  const query=normalizeSearch(search),compact=compactPinyin(query)
  if(!query)return []
  const rank=(item:StudyItem)=>normalizeSearch(item.text)===query?0:compactPinyin(item.pinyin)===compact?1:normalizeSearch(item.meaning)===query?2:3
  return filterCatalog(EMPTY_FILTERS,search,stats).sort((a,b)=>rank(a)-rank(b))
}
