import { ITEM_BY_ID, TAGS } from './catalog'
import { parseSession, type Selection, type Session } from './study-state'
import type { Mode } from './progress'

export const HISTORY_KEY='hanzi-practice:history:v1'
export type PracticeResult={mode:Mode;mistakes:number;hints:number;at:string}
export type PracticeRun={id:string;name:string;startedAt:string;updatedAt:string;session:Session;results:Record<string,PracticeResult|null>}
export type PracticeHistory={activeId:string|null;runs:PracticeRun[]}
export const emptyHistory=():PracticeHistory=>({activeId:null,runs:[]})
export function selectionName(selection:Selection):string {
  return [selection.search.trim(),...TAGS.filter(t=>selection.filters[t.dimension].includes(t.id)).map(t=>t.label)].filter(Boolean).join(' · ').slice(0,160)||'All practice'
}
export function newRun(session:Session,name:string):PracticeRun {
  const at=new Date().toISOString()
  return {id:crypto.randomUUID(),name:name.trim().slice(0,160)||'Practice',startedAt:at,updatedAt:at,session,results:session.completed?{[session.ids[session.index]]:null}:{}}
}
export function runStats(run:PracticeRun) {
  const results=Object.values(run.results),known=results.filter((r):r is PracticeResult=>r!==null)
  const clean=known.filter(r=>r.mistakes===0&&r.hints===0).length
  return {done:results.length,total:run.session.ids.length,percent:Math.floor(results.length/run.session.ids.length*100),clean,success:known.length?Math.round(clean/known.length*100):null,mistakes:known.reduce((n,r)=>n+r.mistakes,0),hints:known.reduce((n,r)=>n+r.hints,0)}
}
export function resumeRun(run:PracticeRun):PracticeRun {
  let index=run.session.index
  // Keep an unfinished checkpoint; otherwise continue with the next unfinished target.
  if(Object.hasOwn(run.results,run.session.ids[index])) {
    const remaining=run.session.ids.findIndex((id,i)=>i>index&&!Object.hasOwn(run.results,id))
    const first=run.session.ids.findIndex(id=>!Object.hasOwn(run.results,id))
    index=remaining>=0?remaining:first>=0?first:run.session.ids.length-1
  }
  return {...run,updatedAt:new Date().toISOString(),session:{...run.session,index,completed:Object.hasOwn(run.results,run.session.ids[index])}}
}
export function parseHistory(raw:string|null):PracticeHistory {
  try {
    const data=JSON.parse(raw||'null'),runs:PracticeRun[]=[]
    if(!Array.isArray(data?.runs))return emptyHistory()
    for(const value of data.runs.slice(0,100)) {
      const session=parseSession(JSON.stringify(value?.session))
      if(!session||typeof value.id!=='string'||!value.id||value.id.length>100||runs.some(r=>r.id===value.id)||typeof value.name!=='string'||!value.name.trim()||typeof value.startedAt!=='string'||!Number.isFinite(Date.parse(value.startedAt))||typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt)))continue
      const results:PracticeRun['results']={}
      for(const id of session.ids) {
        if(!Object.hasOwn(value.results??{},id))continue
        const result=value.results[id]
        if(result===null){results[id]=null;continue}
        if(result&&['guided','recall'].includes(result.mode)&&Number.isSafeInteger(result.mistakes)&&result.mistakes>=0&&Number.isSafeInteger(result.hints)&&result.hints>=0&&typeof result.at==='string'&&Number.isFinite(Date.parse(result.at)))results[id]={mode:result.mode,mistakes:result.mistakes,hints:result.hints,at:result.at}
      }
      // An old completed checkpoint is still valid even without detailed results.
      if(session.completed&&!Object.hasOwn(results,session.ids[session.index]))results[session.ids[session.index]]=null
      runs.push({id:value.id,name:value.name.trim().slice(0,160),startedAt:value.startedAt,updatedAt:value.updatedAt,session,results})
    }
    return {activeId:runs.some(r=>r.id===data.activeId)?data.activeId:runs[0]?.id??null,runs}
  }catch{return emptyHistory()}
}
export function mergeHistory(local:PracticeHistory,disk:PracticeHistory):PracticeHistory {
  const runs=new Map(disk.runs.map(r=>[r.id,r]))
  for(const run of local.runs) {
    const previous=runs.get(run.id)
    if(!previous){runs.set(run.id,run);continue}
    const newer=run.updatedAt>=previous.updatedAt?run:previous
    const results={...previous.results}
    for(const [id,result] of Object.entries(run.results))if(!Object.hasOwn(results,id)||(result&&(!results[id]||result.at>=results[id]!.at)))results[id]=result
    runs.set(run.id,{...newer,results})
  }
  return {activeId:local.activeId,runs:[...runs.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100)}
}
export function runPreview(run:PracticeRun):string {
  return run.session.ids.slice(0,5).map(id=>ITEM_BY_ID.get(id)!.text).join(' · ')
}

export function advanceRun(run:PracticeRun):PracticeRun {
  const index=run.session.ids.findIndex((id,i)=>i>run.session.index&&!Object.hasOwn(run.results,id))
  return index<0?run:{...run,updatedAt:new Date().toISOString(),session:{...run.session,index,completed:false}}
}
