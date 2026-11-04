import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState, Modal, PageHeader, SearchInput } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { CharacterDetails } from './Pronunciation'
import { WordDetails } from './WordDetails'
import { DIMENSIONS, EMPTY_FILTERS, TAGS, filterCatalog, groupCatalog, itemTags, type Dimension, type Grouping, type Sort, type StudyItem, type StudyStats } from './catalog'
import { PracticeDashboard } from './PracticeDashboard'
import type { Mode } from './progress'
import { PracticeHistory } from './PracticeHistory'
import { selectionName, type PracticeRun } from './practice-history'
import { DEFAULT_SELECTION, type Selection, type StudyPreferences } from './study-state'

export function StudyLibrary({preferences,onChange,stats,start,runs,resumeRun}:{preferences:StudyPreferences;onChange:(value:StudyPreferences)=>void;stats:StudyStats;start:(items:StudyItem[],id?:string,name?:string,mode?:Mode)=>void;runs:PracticeRun[];resumeRun:(id:string)=>void}) {
  const [view,setView]=useState<'packs'|'items'>(()=>{try{const saved=sessionStorage.getItem('hanzi-practice:library-view');return saved==='packs'||saved==='items'?saved:'packs'}catch{return 'packs'}})
  const changeView=(value:'packs'|'items')=>{setView(value);try{sessionStorage.setItem('hanzi-practice:library-view',value)}catch{/* Navigation still works without storage. */}}
  const openSelection=(selection:Selection)=>{onChange({...selection,saved:preferences.saved});changeView('items')}
  const [filtersOpen,setFiltersOpen]=useState(false),[saveOpen,setSaveOpen]=useState(false),[infoOpen,setInfoOpen]=useState(false),[name,setName]=useState('')
  const [limits,setLimits]=useState<Record<string,number>>({}),[now,setNow]=useState(Date.now)
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer)},[])
  const {filters,search,groupBy,sort}=preferences
  const results=useMemo(()=>filterCatalog(filters,search,stats,now,sort),[filters,search,stats,now,sort])
  const groups=useMemo(()=>groupCatalog(results,groupBy,stats,now),[results,groupBy,stats,now])
  useEffect(()=>setLimits({}),[filters,search,groupBy,sort])
  const previousSelection=useRef({filters,search})
  useEffect(()=>{
    const changed=previousSelection.current.filters!==filters||previousSelection.current.search!==search
    previousSelection.current={filters,search}
    if(changed&&(search||Object.values(filters).some(ids=>ids.length)))changeView('items')
  },[filters,search])
  const active=TAGS.filter(tag=>filters[tag.dimension].includes(tag.id))
  const toggle=(dimension:Dimension,id:string)=>onChange({...preferences,filters:{...filters,[dimension]:filters[dimension].includes(id)?filters[dimension].filter(x=>x!==id):[...filters[dimension],id]}})
  const clear=()=>onChange({...preferences,...DEFAULT_SELECTION,filters:{...EMPTY_FILTERS}})
  const due=filterCatalog({...filters,status:['status:due']},search,stats,now).length
  const savedMatch=preferences.saved.find(s=>s.search===search&&JSON.stringify(s.filters)===JSON.stringify(filters))
  const title=savedMatch?.name||selectionName(preferences)
  const packName=(label:string)=>label?`${label}${title==='All practice'?'':` · ${title}`}`:title
  const reviewing=filters.status.length===1&&filters.status[0]==='status:due'
  return <>
    <PageHeader title="Practice" />
    <div className="mb-4 flex gap-1 rounded border border-line-strong bg-paper-deep p-1" aria-label="Practice browser">
      <button className="min-h-11 flex-1 rounded-sm text-sm font-bold aria-pressed:bg-panel aria-pressed:shadow-sm" aria-label="Browse packs" aria-pressed={view==='packs'} onClick={()=>changeView('packs')}>Packs</button>
      <button className="min-h-11 flex-1 rounded-sm text-sm font-bold aria-pressed:bg-panel aria-pressed:shadow-sm" aria-label="Browse items" aria-pressed={view==='items'} onClick={()=>changeView('items')}>Characters & words</button>
    </div>
    <PracticeHistory runs={runs} resume={resumeRun}/>
    {view==='packs'?<>
      {filterCatalog({...EMPTY_FILTERS,status:['status:due']},'',stats,now).length>0&&<button className="mb-4 flex min-h-11 w-full items-center justify-between rounded border border-accent bg-accent-soft px-3 py-2 text-left text-sm font-bold" onClick={()=>openSelection({...DEFAULT_SELECTION,filters:{...EMPTY_FILTERS,status:['status:due']},sort:'due'})}><span>Ready to review</span><span>{filterCatalog({...EMPTY_FILTERS,status:['status:due']},'',stats,now).length} →</span></button>}
      <PracticeDashboard preferences={preferences} stats={stats} now={now} open={openSelection} start={start}/>
    </>:<>
    {(active.length>0||search)&&<h2 className="mb-3 break-words text-lg font-bold">{title}</h2>}
    <SearchInput value={search} onChange={value=>onChange({...preferences,search:value})} placeholder="Search characters or words" />
    <div className="my-3 flex flex-wrap items-center gap-1">
      {(['character','word'] as const).map(kind=><Button key={kind} aria-pressed={filters.kind.includes(`kind:${kind}`)} className="!px-2 aria-pressed:border-accent aria-pressed:bg-accent-soft" onClick={()=>toggle('kind',`kind:${kind}`)}>{kind==='character'?'Characters':'Words'}</Button>)}
      <Button aria-pressed={reviewing} title="Items ready to practise again in this selection" className="!px-2 aria-pressed:border-accent aria-pressed:bg-accent-soft" onClick={()=>onChange({...preferences,filters:{...filters,status:reviewing?[]:['status:due']},sort:reviewing?sort:'due'})}>Review {due}</Button>
      <Button iconOnly className="ml-auto" aria-label="Filters" title="Filters" onClick={()=>setFiltersOpen(true)}><PracticeIcon name="filters" /></Button>
    </div>
    {active.length>0&&<div className="mb-3 flex flex-wrap gap-1" aria-label="Active filters">{active.map(tag=><button key={tag.id} aria-label={`Remove ${tag.label} filter`} className="min-h-9 rounded border border-accent bg-accent-soft px-2 text-xs" onClick={()=>toggle(tag.dimension,tag.id)}>{tag.label} ×</button>)}</div>}
    {preferences.saved.length>0&&<div className="mb-3 flex flex-wrap gap-2" aria-label="Saved selections">{preferences.saved.map(saved=><div key={saved.id} className="flex min-w-0 max-w-full overflow-hidden rounded border border-line-strong"><button className="min-h-11 min-w-0 break-words px-3 text-left text-sm" aria-label={`Use saved selection ${saved.name}`} onClick={()=>onChange({...saved,saved:preferences.saved})}>{saved.name}</button><button className="min-h-11 min-w-9 border-l border-line text-muted" aria-label={`Delete saved selection ${saved.name}`} onClick={()=>onChange({...preferences,saved:preferences.saved.filter(s=>s.id!==saved.id)})}>×</button></div>)}</div>}
    <div className="mb-3 grid grid-cols-2 gap-2">
      <select aria-label="Group by" className="min-h-11 min-w-0 rounded-sm border border-line-strong bg-panel px-2 text-sm" value={groupBy} onChange={e=>onChange({...preferences,groupBy:e.target.value as Grouping})}>
        <option value="none">No grouping</option>{Object.entries(DIMENSIONS).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select>
      <select aria-label="Sort by" className="min-h-11 min-w-0 rounded-sm border border-line-strong bg-panel px-2 text-sm" value={sort} onChange={e=>onChange({...preferences,sort:e.target.value as Sort})}><option value="catalog">Default order</option><option value="hsk">HSK level</option><option value="strokes">Fewest strokes</option><option value="due">Review first</option></select>
    </div>
    <div className="mb-4 flex items-center gap-2">
      <span className="mr-auto text-sm text-muted" role="status">{results.length} items</span>
      {(active.length>0||search)&&<Button iconOnly aria-label="Clear filters" title="Clear filters" onClick={clear}><PracticeIcon name="clear" /></Button>}
      <Button iconOnly aria-label="About labels" title="About labels" onClick={()=>setInfoOpen(true)}><span aria-hidden="true">i</span></Button>
      <Button iconOnly aria-label="Save selection" title="Save as a pack" onClick={()=>{setName([search,...active.map(t=>t.label)].filter(Boolean).join(' · ').slice(0,60)||'All practice');setSaveOpen(true)}}><PracticeIcon name="bookmark" /></Button>
      <Button primary iconOnly aria-label={`Practice ${results.length} matching items`} title={`Practice ${results.length} items`} disabled={!results.length} onClick={()=>start(results,undefined,title)}><PracticeIcon name="play" /></Button>
    </div>
    {groups.map((group,groupIndex)=>{
      const limit=limits[group.id]??(groupBy==='none'?24:groupIndex===0?6:0)
      const visible=group.items.slice(0,limit)
      return <section key={group.id} className="mb-4">
        {group.label&&<div className="mb-2 flex items-center justify-between gap-2"><h2 className="min-w-0 flex-1"><button className="flex min-h-11 w-full items-center gap-2 text-left font-bold" aria-label={`${limit?'Hide':'Show'} ${group.label} items`} aria-expanded={limit>0} onClick={()=>setLimits(previous=>({...previous,[group.id]:limit?0:12}))}><span aria-hidden="true">{limit?'▾':'▸'}</span><span>{group.label} <span className="text-muted">{group.items.length}</span></span></button></h2><Button iconOnly aria-label={`Practice group ${group.label}`} title={`Practice ${group.label}`} onClick={()=>start(group.items,undefined,packName(group.label))}><PracticeIcon name="play" /></Button></div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map(item=><div key={item.id} data-testid={`item-${item.id}`} className="min-w-0 rounded border border-line-strong bg-panel p-4">
          {item.character?<CharacterDetails character={item.character}/>:<WordDetails word={item.word!}/>}
          <div className="mt-2 flex flex-wrap gap-1">{itemTags(item,stats,now).filter(t=>['kind','hsk','topic','status'].includes(t.dimension)).map(tag=><button key={tag.id} className="min-h-9 rounded border border-line px-2 text-xs text-muted" aria-label={`Filter ${tag.label}`} onClick={()=>toggle(tag.dimension,tag.id)}>{tag.label}</button>)}</div>
          <div className="mt-3 flex items-center gap-2">{stats.counts[item.text]>0&&<span className="text-sm font-bold text-success" aria-label={`${stats.counts[item.text]} completed practices`}>✓ {stats.counts[item.text]}</span>}<span className="text-xs text-muted">{item.strokes} strokes</span><Button iconOnly className="ml-auto" aria-label={`Practice ${item.text}`} title={`Practice ${item.text}`} onClick={()=>start(group.items,item.id,packName(group.label))}><PracticeIcon name="play" /></Button></div>
        </div>)}</div>
        {limit>0&&group.items.length>limit&&<Button className="mt-3" aria-label={`Show more ${group.label||'items'}`} onClick={()=>setLimits(previous=>({...previous,[group.id]:limit+24}))}>Show more</Button>}
      </section>
    })}
    {!results.length&&<EmptyState title="No matching practice" message="Change a label or clear the filters." action={<Button onClick={clear}>Clear filters</Button>}/>}
    </>}
    <Modal open={filtersOpen} onClose={()=>setFiltersOpen(false)} title="Practice filters">
      <div className="max-h-[60svh] overflow-y-auto space-y-2">{Object.entries(DIMENSIONS).map(([key,label])=>{const dimension=key as Dimension;return <details key={key} className="rounded border border-line p-2" open={dimension==='kind'?true:undefined}>
        <summary className="min-h-9 cursor-pointer font-bold">{label}{filters[dimension].length?` · ${filters[dimension].length}`:''}</summary>
        <fieldset aria-label={label} className="flex flex-wrap gap-2 py-2">{TAGS.filter(t=>t.dimension===dimension).map(tag=><label key={tag.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line px-2 text-sm"><input type="checkbox" checked={filters[dimension].includes(tag.id)} onChange={()=>toggle(dimension,tag.id)} />{tag.label}</label>)}</fieldset>
      </details>})}</div>
      <div className="mt-4 flex items-center justify-between gap-2"><Button onClick={clear}>Clear</Button><Button primary onClick={()=>setFiltersOpen(false)}>Show {results.length}</Button></div>
    </Modal>
    <Modal open={saveOpen} onClose={()=>setSaveOpen(false)} title="Save as a pack"><form onSubmit={e=>{e.preventDefault();if(!name.trim())return;onChange({...preferences,saved:[...preferences.saved.filter(s=>s.name!==name.trim()),{filters,search,groupBy,sort,id:crypto.randomUUID(),name:name.trim()}].slice(-30)});setSaveOpen(false)}}>
      <label className="block text-sm">Name<input autoFocus maxLength={60} value={name} onChange={e=>setName(e.target.value)} className="mt-2 min-h-11 w-full rounded-sm border border-line-strong bg-panel px-3" /></label><Button primary className="mt-3" type="submit" disabled={!name.trim()}>Save</Button>
    </form></Modal>
    <Modal open={infoOpen} onClose={()=>setInfoOpen(false)} title="Practice labels"><div className="space-y-3 text-sm">
      <p>Selections combine dimensions. Several labels within one dimension mean “any of these”; different dimensions must all match. Saved selections store these rules and update as your progress changes.</p>
      <p>HSK vocabulary levels use the 2026 HSK 3.0 syllabus. Unlisted means no confirmed match for this entry. Stroke count measures writing load. Study sets are curated character groups; they are not HSK levels.</p>
      <p>Review counts the items in your selection that are ready to practise again. Hints, mistakes, or guided practice bring an item back sooner; correct recall spaces reviews farther apart. Characters and whole words have separate schedules.</p>
      <p>A word is complete only after both tiles. Review opens in From memory mode. Each queue visits its selected items once and stops.</p>
      <a className="text-accent underline" href="https://www.chinesetest.cn/syllabus">HSK syllabus</a> · <a className="text-accent underline" href="/licenses/HSK-VOCABULARY-MIT.txt">Vocabulary data license</a>
    </div></Modal>
  </>
}
