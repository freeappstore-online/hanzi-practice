import { CATALOG, DIMENSIONS, EMPTY_FILTERS, ITEM_BY_ID, parseFilters, type Filters, type Grouping, type Sort, type StudyItem } from './catalog'
import type { Mode } from './progress'
export const STUDY_KEY='hanzi-practice:study:v1'
export const SESSION_KEY='hanzi-practice:session:v1'
export type Selection={filters:Filters;search:string;groupBy:Grouping;sort:Sort}
export type SavedSelection=Selection&{id:string;name:string}
export type StudyPreferences=Selection&{saved:SavedSelection[]}
export type Session={ids:string[];index:number;mode:Mode;completed:boolean}
export const DEFAULT_SELECTION:Selection={filters:EMPTY_FILTERS,search:'',groupBy:'none',sort:'catalog'}
function parseSelection(data:any):Selection {
  return {filters:parseFilters(data?.filters),search:typeof data?.search==='string'?data.search.slice(0,200):'',groupBy:Object.hasOwn(DIMENSIONS,data?.groupBy) ? data.groupBy:'none',sort:['catalog','hsk','strokes','due'].includes(data?.sort)?data.sort:'catalog'}
}
export function parseStudyPreferences(raw:string|null):StudyPreferences {
  try {
    const data=JSON.parse(raw||'null')
    const saved:SavedSelection[]=[]
    if(Array.isArray(data?.saved))for(const s of data.saved.slice(0,30))if(typeof s?.id==='string' && typeof s?.name==='string' && s.name.trim() && !saved.some(x=>x.id===s.id))saved.push({...parseSelection(s),id:s.id.slice(0,100),name:s.name.trim().slice(0,60)})
    return {...parseSelection(data),saved}
  } catch {return {...DEFAULT_SELECTION,saved:[]}}
}
export function readStudyPreferences():StudyPreferences {
  try {
    const raw=localStorage.getItem(STUDY_KEY)
    if(raw)return parseStudyPreferences(raw)
    // Preserve existing word filter choices without turning them into fixed lists.
    const legacy=JSON.parse(localStorage.getItem('hanzi-practice:words:v1')||'null')
    const filters=Object.fromEntries(Object.entries(legacy?.filters??{}).map(([k,v])=>[k,v?[v]:[]]))
    return parseStudyPreferences(JSON.stringify({...legacy,filters}))
  }catch{return parseStudyPreferences(null)}
}
export function createSession(items:StudyItem[],startId=items[0]?.id,mode:Mode='guided'):Session|null {
  const ids=[...new Set(items.map(item=>item.id))]
  if(!ids.length)return null
  const index=Math.max(0,ids.indexOf(startId))
  return {ids:[...ids.slice(index),...ids.slice(0,index)],index:0,mode,completed:false}
}
export function parseSession(raw:string|null):Session|null {
  try {
    const data=JSON.parse(raw||'null')
    if(!data || !Array.isArray(data.ids) || data.ids.length>CATALOG.length || new Set(data.ids).size!==data.ids.length || !data.ids.length || !data.ids.every((id:unknown)=>typeof id==='string' && ITEM_BY_ID.has(id)) || !Number.isInteger(data.index) || data.index<0 || data.index>=data.ids.length || !['guided','recall'].includes(data.mode) || typeof data.completed!=='boolean')return null
    return {ids:data.ids,index:data.index,mode:data.mode,completed:data.completed}
  }catch{return null}
}
export function advanceSession(session:Session):Session {
  return session.index+1<session.ids.length?{...session,index:session.index+1,completed:false}:session
}
