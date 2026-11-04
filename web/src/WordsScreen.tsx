import { useCallback, useRef, useState } from 'react'
import { EmptyState, Modal, PageHeader, SearchInput } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { WordDetails } from './WordDetails'
import { WordPractice } from './WordPractice'
import { WORDS, WORDS_KEY, WORD_TAGS, EMPTY_FILTERS, filterWords, groupWords, wordTags, parseWordProgress, type Dimension, type Grouping, type PracticeWord, type WordProgress } from './words'
import type { Attempt } from './progress'
import type { ReviewEvent } from './review'
export function Words({autoplay,setAutoplay,onComplete,onReviewEvent}:{
  autoplay:boolean;setAutoplay:(value:boolean)=>void;onComplete:(attempt:Attempt)=>void;onReviewEvent:(event:ReviewEvent)=>void
}) {
  const [saved,setSaved]=useState(()=>{
    try{return parseWordProgress(localStorage.getItem(WORDS_KEY))}catch{return parseWordProgress(null)}
  })
  const memory=useRef(saved)
  const [error,setError]=useState('')
  const [search,setSearch]=useState('')
  const [info,setInfo]=useState(false)
  const [session,setSession]=useState<{words:PracticeWord[];index:number}|null>(null)
  const persist=(value:WordProgress)=>{
    memory.current=value;setSaved(value)
    try {localStorage.setItem(WORDS_KEY,JSON.stringify(value));setError('')}
    catch {setError('Word progress is kept only until this page closes. Device storage is unavailable.')}
  }
  const completeWord=()=>{
    if(!session)return
    let latest=memory.current
    try {latest=parseWordProgress(localStorage.getItem(WORDS_KEY))}catch{/* Keep this session's progress. */}
    const word=session.words[session.index].word
    persist({...memory.current,counts:{...latest.counts,...memory.current.counts,[word]:Math.max(latest.counts[word]??0,memory.current.counts[word]??0)+1}})
  }
  const next=useCallback(()=>setSession(s=>s && s.index+1<s.words.length ? {...s,index:s.index+1}:s),[])
  const visible=filterWords(saved.filters,search)
  const groups=groupWords(visible,saved.groupBy)
  const labels:Record<Dimension,string>={hsk:'HSK 3.0 (2026)',topic:'Topic',type:'Word type',audio:'Audio',tone:'Tone pair'}
  const setFilter=(dimension:Dimension,id:string)=>persist({...saved,filters:{...saved.filters,[dimension]:id}})
  return <>
    {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
    {session ? <>
      <div className="sr-only"><PageHeader title="Word practice" /></div>
      <WordPractice word={session.words[session.index]} next={session.words[session.index+1]??null} autoplay={autoplay} setAutoplay={setAutoplay} onComplete={onComplete} onReviewEvent={onReviewEvent} onWordComplete={completeWord} onNext={next} onBack={()=>setSession(null)} />
    </> : <>
      <PageHeader title="Words" />
      <div className="mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search words" />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(Object.keys(labels) as Dimension[]).map(dimension=><select key={dimension} aria-label={labels[dimension]} value={saved.filters[dimension]} onChange={e=>setFilter(dimension,e.target.value)} className="min-h-11 min-w-0 rounded-sm border border-line-strong bg-panel px-2 text-sm">
          <option value="">{labels[dimension]}</option>
          {WORD_TAGS.filter(tag=>tag.dimension===dimension).map(tag=><option key={tag.id} value={tag.id}>{tag.label}</option>)}
        </select>)}
        <select aria-label="Group words by" value={saved.groupBy} onChange={e=>persist({...saved,groupBy:e.target.value as Grouping})} className="min-h-11 min-w-0 rounded-sm border border-line-strong bg-panel px-2 text-sm">
          <option value="none">No grouping</option><option value="hsk">Group by HSK</option><option value="topic">Group by topic</option>
        </select>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm text-muted" role="status">{visible.length} / {WORDS.length}</span>
        {(Object.values(saved.filters).some(Boolean)||search) && <Button onClick={()=>{setSearch('');persist({...saved,filters:{...EMPTY_FILTERS}})}}>Clear</Button>}
        <Button iconOnly aria-label="About word tags" title="About word tags" onClick={()=>setInfo(true)}><span aria-hidden="true">i</span></Button>
        <Button primary iconOnly aria-label={`Practice ${visible.length} matching words`} title="Practice matching words" disabled={!visible.length} onClick={()=>setSession({words:visible,index:0})}><PracticeIcon name="play" /></Button>
      </div>
      {groups.map(group=><section key={group.label} className="mb-4">
        {group.label && <div className="mb-2 flex items-center justify-between gap-3"><h2 className="font-bold">{group.label} <span className="text-muted">{group.words.length}</span></h2><Button iconOnly aria-label={`Practice group ${group.label}`} title={`Practice ${group.label}`} onClick={()=>setSession({words:group.words,index:0})}><PracticeIcon name="play" /></Button></div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.words.map(word=><div key={word.word} className="min-w-0 rounded border border-line-strong bg-panel p-4">
          <WordDetails word={word} />
          <div className="mt-2 flex flex-wrap gap-1">{wordTags(word).filter(tag=>tag.dimension!=='tone').map(tag=><button key={tag.id} aria-label={`Filter ${labels[tag.dimension]}: ${tag.label}`} onClick={()=>setFilter(tag.dimension,tag.id)} className="min-h-9 rounded border border-line px-2 text-xs text-muted hover:border-accent hover:text-accent-deep">{tag.label}</button>)}</div>
          <div className="mt-3 flex items-center justify-between gap-2">
            {(saved.counts[word.word]??0)>0 && <span className="text-sm font-bold text-success" aria-label={`${saved.counts[word.word]} completed word practices`}>✓ {saved.counts[word.word]}</span>}
            <Button iconOnly className="ml-auto" aria-label={`Practice word ${word.word}`} title={`Practice ${word.word}`} onClick={()=>setSession({words:group.words,index:group.words.indexOf(word)})}><PracticeIcon name="play" /></Button>
          </div>
        </div>)}
        </div>
      </section>)}
      {!visible.length && <EmptyState title="No words found" message="Try another word or clear a filter." />}
      <Modal open={info} onClose={()=>setInfo(false)} title="Word tags"><div className="space-y-3 text-sm">
        <p>HSK tags use the 2026 HSK 3.0 vocabulary syllabus, mapped through <a className="text-accent underline" href="https://github.com/drkameleon/complete-hsk-vocabulary/tree/7ac65bf1a6387d35f1ade478906172a19311c7f9">Complete HSK Vocabulary</a> with corrections checked against the official syllabus. Unlisted means no match in that source; it does not mean advanced. HSK measures vocabulary proficiency, not stroke count.</p>
        <p>Topics are curated. Word types come from the vocabulary dataset; a word can have several uses. Tone pairs show the displayed pinyin; spoken tones can change in context.</p>
        <p>Combine filters to narrow practice. Group by topic or HSK and tap a group’s play icon to practice that group. Words can appear in more than one topic.</p>
        <p>Two-character practice currently includes {WORDS.length} words with both characters in the bundled writing library. <a className="text-accent underline" href="/licenses/HSK-VOCABULARY-MIT.txt">Dataset license</a>.</p>
      </div></Modal>
    </>}
  </>
}
