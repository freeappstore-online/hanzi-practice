import { useState } from 'react'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { runPreview, runStats, type PracticeRun } from './practice-history'

export function PracticeHistory({runs,resume}:{runs:PracticeRun[];resume:(id:string)=>void}) {
  const [expanded,setExpanded]=useState(false)
  if(!runs.length)return null
  return <section aria-label="Recent practice" className="mb-4">
    <div className="mb-2 flex items-center justify-between gap-2"><h2 className="font-bold">Recent practice</h2>{runs.length>1&&<button className="min-h-11 px-2 text-sm text-accent" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':`All ${runs.length}`}</button>}</div>
    <div className="grid gap-2 sm:grid-cols-2">{runs.slice(0,expanded?runs.length:1).map(run=>{
      const stats=runStats(run)
      return <article key={run.id} aria-label={run.name} className="min-w-0 rounded border border-line-strong bg-panel p-3">
        <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-bold" title={run.name}>{run.name}</h3><p className="truncate text-xs text-muted">{runPreview(run)}</p></div><Button iconOnly aria-label={`${stats.done===stats.total?'Open':'Resume'} ${run.name}`} title={stats.done===stats.total?'Open completed practice':'Resume practice'} onClick={()=>resume(run.id)}><PracticeIcon name="play" /></Button></div>
        <div className="my-2 h-1 overflow-hidden rounded bg-accent-soft" role="progressbar" aria-label={`${run.name} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent}><div className="h-full bg-accent" style={{width:`${stats.percent}%`}} /></div>
        <div className="flex flex-wrap justify-between gap-x-2 text-xs tabular-nums"><span>{stats.percent}% · {stats.done}/{stats.total}</span><span className="text-success" title="Completed items with no mistakes or hints, in either mode">{stats.success===null?'—':`${stats.success}%`} clean</span></div>
        <details className="mt-1 text-xs text-muted"><summary className="min-h-11 cursor-pointer py-2">{new Date(run.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {new Date(run.updatedAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</summary><p>{stats.clean} clean · {stats.mistakes} retries · {stats.hints} hints. Results use each item’s latest completion; clean means no mistakes or hints in either mode.</p></details>
      </article>
    })}</div>
  </section>
}
