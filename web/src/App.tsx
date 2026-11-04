import { useCallback, useEffect, useMemo, useState } from 'react'
import { initApp } from '@freeappstore/sdk'
import { PageHeader, Shell, type NavItem } from '@freeappstore/sdk/ui'
import { Profile } from './Profile'
import { About } from './About'
import { StudyLibrary } from './StudyLibrary'
import { StudyProgress } from './StudyProgress'
import { PracticeSession } from './PracticeSession'
import { useStudyProgress } from './useStudyProgress'
import { CATALOG, EMPTY_FILTERS, ITEM_BY_ID, studyStats, type StudyItem } from './catalog'
import { DEFAULT_SELECTION, SESSION_KEY, STUDY_KEY, advanceSession, createSession, parseSession, readStudyPreferences, type Session, type StudyPreferences } from './study-state'
import { PREFERENCES_KEY, readPreferences, savePreferences } from './preferences'
import { Button } from './Button'
const fas=initApp({appId:'hanzi-practice'})
const NAV:NavItem[]=[{label:'Practice',href:'/',title:'Practice — Hanzi'},{label:'Progress',href:'/progress',title:'Progress — Hanzi'},{label:'About',href:'/about',title:'About — Hanzi'}]
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
  const [session,setSession]=useState<Session|null>(()=>{
    try {
      const raw=localStorage.getItem(SESSION_KEY)
      if(raw)return parseSession(raw)
      if(localStorage.getItem(PREFERENCES_KEY))return createSession(CATALOG.filter(i=>i.kind==='character'),`char:${readPreferences().character}`)
    }catch{/* Start from the library if storage is unavailable. */}
    return null
  })
  useEffect(()=>{try{localStorage.setItem(STUDY_KEY,JSON.stringify(study))}catch{setWarning('Device storage is unavailable. Selections are kept only in this tab.')}},[study])
  useEffect(()=>{try{if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY)}catch{setWarning('Device storage is unavailable. The current queue will not survive a reload.')}},[session])
  useEffect(()=>{if(!savePreferences(preferences))setWarning('Device storage is unavailable. Preferences are kept only in this tab.')},[preferences])
  // Old links become filters in the same library.
  useEffect(()=>{
    if(!['/characters','/words','/review'].includes(path))return
    setStudy(s=>({...s,...DEFAULT_SELECTION,filters:{...EMPTY_FILTERS,...(path==='/review'?{status:['status:due']}:{kind:[path==='/words'?'kind:word':'kind:character']})},sort:path==='/review'?'due':'catalog'}))
    navigate('/',true)
  },[path,navigate])
  const stats=useMemo(()=>studyStats(data.progress,data.wordCounts,data.reviews,data.characterTotals),[data.progress,data.wordCounts,data.reviews,data.characterTotals])
  const start=(items:StudyItem[],id?:string)=>{
    const next=createSession(items,id,study.filters.status.includes('status:due')?'recall':'guided')
    if(!next)return
    setSession(next);navigate('/session')
  }
  const next=useCallback(()=>setSession(s=>s?advanceSession(s):null),[])
  const autoplay=useCallback((value:boolean)=>setPreferences(p=>({...p,autoplay:value})),[])
  const selectStatus=(status:string)=>{setStudy(s=>({...s,...DEFAULT_SELECTION,filters:{...EMPTY_FILTERS,status:[`status:${status}`]},sort:status==='due'?'due':'catalog'}));navigate('/')}
  const queue=session?.ids.map(id=>ITEM_BY_ID.get(id)!)??[]
  const item=session?queue[session.index]:null
  const updateStudy=(value:StudyPreferences)=>setStudy(value)
  return <div className="mx-auto w-full max-w-5xl p-4 sm:p-7">
    {(warning||data.warning)&&<p role="alert" className="mb-4 rounded border border-warning bg-warning-soft p-3 text-sm">{warning||data.warning}</p>}
    {path==='/session' ? (session&&item ? <>
      <div className="sr-only"><PageHeader title="Practice session"/></div>
      <PracticeSession key={item.id} item={item} queue={queue} index={session.index} mode={session.mode} completed={session.completed} autoplay={preferences.autoplay} onAutoplay={autoplay} onMode={mode=>setSession(s=>s?{...s,mode,completed:false}:null)} onCharacterComplete={data.complete} onReviewEvent={data.reviewEvent} onCompleted={()=>{
        if(item.kind==='word')data.completeWord(item.text)
        else setPreferences(p=>({...p,character:item.text}))
        setSession(s=>s?{...s,completed:true}:null)
      }} onRestart={()=>setSession(s=>s?{...s,completed:false}:null)} onJump={index=>setSession(s=>s?{...s,index,completed:false}:null)} onNext={next} onBack={()=>navigate('/')} />
    </> : <><PageHeader title="Practice"/><Button onClick={()=>navigate('/')}>Choose practice</Button></>)
      : path==='/progress'?<StudyProgress progress={data.progress} stats={stats} practice={start} selectStatus={selectStatus}/>
      : path==='/profile'?<Profile app={fas}/>
      : path==='/about'?<About/>
      : <StudyLibrary preferences={study} onChange={updateStudy} stats={stats} start={start} resume={()=>navigate('/session')} canResume={!!session&&!(session.completed&&session.index===session.ids.length-1)}/>
    }
  </div>
}
