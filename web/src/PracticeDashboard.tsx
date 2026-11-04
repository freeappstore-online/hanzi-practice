import { useMemo, useState } from 'react'
import { EmptyState, SearchInput } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { DIMENSIONS, EMPTY_FILTERS, TAGS, filterCatalog, type Dimension, type StudyItem, type StudyStats } from './catalog'
import { DEFAULT_SELECTION, type Selection, type StudyPreferences } from './study-state'
import type { Mode } from './progress'

type Pack={id:string;name:string;category:string;selection:Selection;items:StudyItem[]}
export function PracticeDashboard({preferences,stats,now,open,start}:{preferences:StudyPreferences;stats:StudyStats;now:number;open:(selection:Selection)=>void;start:(items:StudyItem[],id?:string,name?:string,mode?:Mode)=>void}) {
  const [dimension,setDimension]=useState<Dimension>('hsk'),[query,setQuery]=useState('')
  const packs=useMemo(()=>TAGS.map(tag=>{
    const selection={...DEFAULT_SELECTION,filters:{...EMPTY_FILTERS,[tag.dimension]:[tag.id]},sort:tag.id==='status:due'?'due' as const:'catalog' as const}
    return {id:tag.id,name:tag.label,category:DIMENSIONS[tag.dimension],selection,items:filterCatalog(selection.filters,'',stats,now)}
  }),[stats,now])
  const saved=preferences.saved.map(s=>({id:s.id,name:s.name,category:'Saved',selection:s,items:filterCatalog(s.filters,s.search,stats,now,s.sort)}))
  const search=query.trim().toLocaleLowerCase()
  const visible=search?[...saved,...packs].filter(p=>`${p.name} ${p.category}`.toLocaleLowerCase().includes(search)):packs.filter(p=>p.id.startsWith(`${dimension}:`))
  const card=(pack:Pack)=>{
    const characters=pack.items.filter(i=>i.kind==='character').length,words=pack.items.length-characters
    const practiced=pack.items.filter(i=>stats.counts[i.text]>0).length
    return <article key={pack.id} aria-label={`Pack ${pack.name}`} className="flex min-w-0 items-end gap-3 rounded border border-line-strong bg-panel p-3 sm:p-4">
      <button className="block min-h-11 min-w-0 flex-1 text-left" aria-label={`Open pack ${pack.name}`} onClick={()=>open(pack.selection)}>
        <span className="flex items-center justify-between gap-2 font-bold"><span className="break-words">{pack.name}</span><span aria-hidden="true" className="text-muted">›</span></span>
        <span className="mt-1 block text-xs text-muted">{search&&`${pack.category} · `}{[characters?`${characters} characters`:'',words?`${words} words`:''].filter(Boolean).join(' · ')||'No matching items'}</span>
        <span lang="zh-Hans" className="mt-3 block truncate text-2xl text-muted">{pack.items.slice(0,5).map(i=>i.text).join(' ')||'—'}</span>
        {practiced>0&&<span className="mt-2 block text-xs text-success" aria-label={`${practiced} of ${pack.items.length} items practised`}>✓ {practiced}/{pack.items.length}</span>}
      </button>
      <Button primary iconOnly aria-label={`Practice pack ${pack.name}`} title={`Practice ${pack.name}`} disabled={!pack.items.length} onClick={()=>{open(pack.selection);start(pack.items,undefined,pack.name,pack.selection.filters.status.includes('status:due')?'recall':'guided')}}><PracticeIcon name="play"/></Button>
    </article>
  }
  return <section aria-label="Find a practice pack" className="space-y-4">
    <SearchInput value={query} onChange={setQuery} placeholder="Find a pack: food, HSK 1, numbers…" />
    {!search&&saved.length>0&&<section aria-label="Saved packs"><h2 className="mb-2 font-bold">Saved packs</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{saved.map(card)}</div></section>}
    <div className="flex items-center gap-1" aria-label="Pack categories">
      {([['hsk','HSK'],['topic','Topics'],['set','Study sets']] as const).map(([id,label])=><Button key={id} aria-label={label} className="flex-1 !px-2 aria-pressed:border-accent aria-pressed:bg-accent-soft" aria-pressed={!search&&dimension===id} onClick={()=>{setDimension(id);setQuery('')}}>{id==='set'?'Sets':label}</Button>)}
      <select aria-label="More pack categories" value={['hsk','topic','set'].includes(dimension)?'':dimension} onChange={e=>{setDimension(e.target.value as Dimension);setQuery('')}} className="min-h-11 w-20 min-w-0 rounded-sm border border-line-strong bg-panel px-1 text-sm"><option value="" disabled>More</option>{Object.entries(DIMENSIONS).filter(([id])=>!['hsk','topic','set'].includes(id)).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
    </div>
    <div className="flex items-center justify-between gap-2"><h2 className="font-bold">{search?'Matching packs':dimension==='hsk'?'HSK 3.0':DIMENSIONS[dimension]}</h2><span className="text-xs text-muted">{visible.length} packs</span></div>
    {!search&&dimension==='set'&&<p className="text-xs text-muted">40 characters per set · curated practice, not HSK levels</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(card)}</div>
    {!visible.length&&<EmptyState title="No matching packs" message="Try a topic, HSK level, or saved pack name." action={<Button onClick={()=>setQuery('')}>Clear search</Button>}/>}
  </section>
}
