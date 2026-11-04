import { useCallback, useEffect, useMemo, useState } from 'react'
import { initApp } from '@freeappstore/sdk'
import { PageHeader, Shell, type NavItem } from '@freeappstore/sdk/ui'
import { Profile } from './Profile'
import { About } from './About'
import { CharacterLookup } from './CharacterLookup'
import { PracticeDashboard } from './PracticeDashboard'
import { PracticeHistory as RecentPractice } from './PracticeHistory'
import { PracticeIcon } from './PracticeIcon'
import { StudyLibrary } from './StudyLibrary'
import { StudyProgress } from './StudyProgress'
import { PracticeSession } from './PracticeSession'
import { useStudyProgress } from './useStudyProgress'
import { CATALOG, EMPTY_FILTERS, ITEM_BY_ID, filterCatalog, studyStats, type StudyItem } from './catalog'
import { DEFAULT_SELECTION, SESSION_KEY, STUDY_KEY, createSession, parseSession, readStudyPreferences, type Session, type Selection, type StudyPreferences } from './study-state'
import { PREFERENCES_KEY, readPreferences, savePreferences } from './preferences'
import type { Mode } from './progress'
import { Button } from './Button'
import { HISTORY_KEY, emptyHistory, mergeHistory, newRun, parseHistory, resumeRun, runStats, advanceRun, type PracticeHistory } from './practice-history'
const fas=initApp({appId:'hanzi-practice'})
const NAV:NavItem[]=[{label:'Packs',href:'/',title:'Packs — Hanzi'},{label:'Lookup',href:'/lookup',title:'Lookup — Hanzi'},{label:'Progress',href:'/progress',title:'Progress — Hanzi'},{label:'About',href:'/about',title:'About — Hanzi'}]
export default function App() {
  const [path,setPath]=useState(location.pathname)
  const navigate=useCallback((href:string,replace=false)=>{
    if(replace)history.replaceState(null,'',href);else history.pushState(null,'',href)
    setPath(href);dispatchEvent(new PopStateEvent('popstate'))
  },[])
  useEffect(()=>{const sync=()=>setPath(location.pathname);addEventListener('popstate',sync);return()=>removeEventListener('popstate',sync)},[])
  return <Shell app={fas} appName="Hanzi" nav={NAV} onNavigate={navigate} profileHref="/profile"><Screens path={path} navigate={navigate}/></Shell>
}
function Screens({path,navigate}:{path:string;navigate:(href:string,replace?:boolean)=>void}) {
  const data=useStudyProgress()
  const [study,setStudy]=useState(readStudyPreferences)
  const [preferences,setPreferences]=useState(readPreferences)
  const [warning,setWarning]=useState('')
  const [now,setNow]=useState(Date.now)
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer)},[])
  const [returnTo,setReturnTo]=useState(()=>{try{const saved=sessionStorage.getItem('hanzi-practice:return-to');return saved&&['/','/pack','/lookup','/progress'].includes(saved)?saved:'/pack'}catch{return '/pack'}})
  const rememberReturn=(value:string)=>{setReturnTo(value);try{sessionStorage.setItem('hanzi-practice:return-to',value)}catch{/* Navigation still works. */}}
  const [practiceHistory,setPracticeHistory]=useState<PracticeHistory>(()=>{
    try {
      const saved=localStorage.getItem(HISTORY_KEY)
      if(saved!==null)return parseHistory(saved)
      const raw=localStorage.getItem(SESSION_KEY)
      const legacy=raw?parseSession(raw):localStorage.getItem(PREFERENCES_KEY)?createSession(CATALOG.filter(i=>i.kind==='character'),`char:${readPreferences().character}`):null
      if(legacy){const run=newRun(legacy,'Previous practice');return {activeId:run.id,runs:[run]}}
    }catch{/* Start from the library if storage is unavailable. */}
    return emptyHistory()
  })
  const activeRun=practiceHistory.runs.find(r=>r.id===practiceHistory.activeId)
  const session=activeRun?.session??null
  const setSession=useCallback((update:(session:Session)=>Session)=>setPracticeHistory(h=>({...h,runs:h.runs.map(run=>run.id===h.activeId?{...run,updatedAt:new Date().toISOString(),session:update(run.session)}:run)})),[])
  useEffect(()=>{
    try {
      const merged=mergeHistory(practiceHistory,parseHistory(localStorage.getItem(HISTORY_KEY)))
      localStorage.setItem(HISTORY_KEY,JSON.stringify(merged))
      if(JSON.stringify(merged)!==JSON.stringify(practiceHistory))setPracticeHistory(merged)
    }catch{setWarning('Device storage is unavailable. Practice history is kept only in this tab.')}
  },[practiceHistory])
  useEffect(()=>{
    const sync=(event:StorageEvent)=>{if(event.key===HISTORY_KEY)setPracticeHistory(h=>{const merged=mergeHistory(h,parseHistory(event.newValue));return JSON.stringify(merged)===JSON.stringify(h)?h:merged})}
    addEventListener('storage',sync);return()=>removeEventListener('storage',sync)
  },[])
  useEffect(()=>{try{localStorage.setItem(STUDY_KEY,JSON.stringify(study))}catch{setWarning('Device storage is unavailable. Selections are kept only in this tab.')}},[study])
  useEffect(()=>{try{if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY)}catch{setWarning('Device storage is unavailable. The current queue will not survive a reload.')}},[session])
  useEffect(()=>{if(!savePreferences(preferences))setWarning('Device storage is unavailable. Preferences are kept only in this tab.')},[preferences])
  // Old links become filters in the same library.
  useEffect(()=>{
    if(!['/characters','/words','/review'].includes(path))return
    setStudy(s=>({...s,...DEFAULT_SELECTION,filters:{...EMPTY_FILTERS,...(path==='/review'?{status:['status:due']}:{kind:[path==='/words'?'kind:word':'kind:character']})},sort:path==='/review'?'due':'catalog'}))
    navigate('/pack',true)
  },[path,navigate])
  const stats=useMemo(()=>studyStats(data.progress,data.wordCounts,data.reviews,data.characterTotals),[data.progress,data.wordCounts,data.reviews,data.characterTotals])
  const start=(items:StudyItem[],id?:string,name?:string,mode?:Mode)=>{
    const next=createSession(items,id,mode??(study.filters.status.includes('status:due')?'recall':'guided'))
    if(!next)return
    rememberReturn(path==='/lookup'||path==='/progress'?path:'/pack')
    const run=newRun(next,name||items.slice(0,3).map(i=>i.text).join(' · '))
    setPracticeHistory(h=>({activeId:run.id,runs:[run,...h.runs].slice(0,100)}));navigate('/session')
  }
  const next=useCallback(()=>setPracticeHistory(h=>({...h,runs:h.runs.map(r=>r.id===h.activeId?advanceRun(r):r)})),[])
  const resume=(id=practiceHistory.activeId,destination='/')=>{
    rememberReturn(destination)
    setPracticeHistory(h=>({...h,activeId:id,runs:h.runs.map(r=>r.id===id?resumeRun(r):r)}));navigate('/session')
  }
  const autoplay=useCallback((value:boolean)=>setPreferences(p=>({...p,autoplay:value})),[])
  const selectStatus=(status:string)=>{setStudy(s=>({...s,...DEFAULT_SELECTION,filters:{...EMPTY_FILTERS,status:[`status:${status}`]},sort:status==='due'?'due':'catalog'}));navigate('/pack')}
  const queue=session?.ids.map(id=>ITEM_BY_ID.get(id)!)??[]
  const item=session?queue[session.index]:null
  const openSelection=(selection:Selection)=>{setStudy({...selection,saved:study.saved});navigate('/pack')}
  const due=filterCatalog({...EMPTY_FILTERS,status:['status:due']},'',stats,now).length
  const updateStudy=(value:StudyPreferences)=>setStudy(value)
  return <div className="mx-auto w-full max-w-5xl p-4 sm:p-7">
    {(warning||data.warning)&&<p role="alert" className="mb-4 rounded border border-warning bg-warning-soft p-3 text-sm">{warning||data.warning}</p>}
    {path==='/session' ? (session&&item ? <>
      <div className="sr-only"><PageHeader title="Practice session"/></div>
      <PracticeSession key={`${activeRun!.id}:${item.id}`} item={item} queue={queue} index={session.index} mode={session.mode} completed={session.completed} autoplay={preferences.autoplay} onAutoplay={autoplay} onMode={mode=>setSession(s=>({...s,mode,completed:false}))} onCharacterComplete={data.complete} onReviewEvent={data.reviewEvent} onCompleted={result=>{
        if(item.kind==='word')data.completeWord(item.text)
        else setPreferences(p=>({...p,character:item.text}))
        setPracticeHistory(h=>({...h,runs:h.runs.map(r=>r.id===h.activeId?{...r,updatedAt:result.at,session:{...r.session,completed:true},results:{...r.results,[item.id]:result}}:r)}))
      }} onRestart={()=>setSession(s=>({...s,completed:false}))} onJump={index=>setSession(s=>({...s,index,completed:false}))} finishedIds={Object.keys(activeRun!.results)} doneCount={runStats(activeRun!).done} onRemaining={()=>resume(practiceHistory.activeId,returnTo)} onNext={next} backLabel={returnTo==='/progress'?'Back to progress':returnTo==='/lookup'?'Back to lookup':returnTo==='/'?'Back to packs':'Back to filters'} onBack={()=>navigate(returnTo)} />
    </> : <><PageHeader title="Practice"/><Button onClick={()=>navigate('/')}>Choose practice</Button></>)
      : path==='/progress'?<StudyProgress progress={data.progress} stats={stats} practice={(items,mode)=>start(items,undefined,undefined,mode)} selectStatus={selectStatus}/>
      : path==='/lookup'?<CharacterLookup stats={stats} practice={item=>start([item],undefined,item.text,'guided')}/>
      : path==='/pack'?<StudyLibrary preferences={study} onChange={updateStudy} stats={stats} start={start} onBack={()=>navigate('/')}/>
      : path==='/profile'?<Profile app={fas}/>
      : path==='/about'?<About/>
      : <>
        <div className="flex items-center justify-between gap-3"><PageHeader title="Packs"/><Button iconOnly aria-label="Character lookup" title="Character lookup" onClick={()=>navigate('/lookup')}><PracticeIcon name="search"/></Button></div>
        <RecentPractice runs={practiceHistory.runs} resume={resume}/>
        {due>0&&<button className="mb-4 flex min-h-11 w-full items-center justify-between rounded border border-accent bg-accent-soft px-3 text-sm font-bold" onClick={()=>selectStatus('due')}><span>Ready to review</span><span>{due} →</span></button>}
        <PracticeDashboard preferences={study} stats={stats} now={now} open={openSelection} start={start}/>
      </>
    }
  </div>
}
