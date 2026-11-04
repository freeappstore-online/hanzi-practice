import { useMemo, useState } from 'react'
import { EmptyState, PageHeader, SearchInput } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { CharacterDetails } from './Pronunciation'
import { WordDetails } from './WordDetails'
import { lookupCatalog, type StudyItem, type StudyStats } from './catalog'

export function CharacterLookup({stats,practice}:{stats:StudyStats;practice:(item:StudyItem)=>void}) {
  const [query,setQuery]=useState(()=>{try{return sessionStorage.getItem('hanzi-practice:lookup')||''}catch{return ''}})
  const [limit,setLimit]=useState(12)
  const results=useMemo(()=>lookupCatalog(query,stats),[query,stats])
  const search=(value:string)=>{setQuery(value);setLimit(12);try{sessionStorage.setItem('hanzi-practice:lookup',value)}catch{/* Search works without storage. */}}
  return <>
    <PageHeader title="Lookup"/>
    <SearchInput value={query} onChange={search} placeholder="Character, pinyin, or English" />
    {!query.trim()?<p className="mt-4 text-sm text-muted">Search for a character or word, e.g. 水, shuǐ, or water.</p>:<>
      <p role="status" className="my-3 text-sm text-muted">{results.length} results</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.slice(0,limit).map(item=><article key={item.id} aria-label={item.text} className="min-w-0 rounded border border-line-strong bg-panel p-4">
        {item.character?<CharacterDetails character={item.character}/>:<WordDetails word={item.word!}/>}
        <div className="mt-3 flex items-center gap-2"><span className="text-xs text-muted">{item.strokes} strokes</span>{stats.counts[item.text]>0&&<span className="text-sm text-success" aria-label={`${stats.counts[item.text]} completed practices`}>✓ {stats.counts[item.text]}</span>}<Button iconOnly className="ml-auto" aria-label={`Practice ${item.text}`} title={`Practice ${item.text}`} onClick={()=>practice(item)}><PracticeIcon name="play"/></Button></div>
      </article>)}</div>
      {results.length>limit&&<Button className="mt-3" onClick={()=>setLimit(n=>n+12)}>Show more</Button>}
      {!results.length&&<EmptyState title="No matches" message="Try a character, pinyin without tone marks, or an English meaning."/>}
    </>}
  </>
}
