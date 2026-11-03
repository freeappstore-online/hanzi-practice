import { useEffect, useRef, useState } from 'react'
import { Avatar, PageHeader, ProfilePage, ThemeToggle, TextSizeToggle, useDocumentTitle } from '@freeappstore/sdk/ui'
import { useAuth } from '@freeappstore/sdk/hooks'
import type { FreeAppStore } from '@freeappstore/sdk'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { SOURCE_NAMES, useAudioSettings, type AudioSource } from './audio-settings'
import { mandarinVoices, playPronunciation, stopPlayback } from './playback'
const descriptions:Record<AudioSource,string>={
  recordings:'400 characters · 263 word examples',
  kokoro:'400 character clips · experimental; some readings may be inaccurate',
  browser:'Mandarin voice on this device; some voices need internet',
}
function Arrow({down=false}:{down?:boolean}) {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={down?'M12 4v16m-7-7 7 7 7-7':'M12 20V4m-7 7 7-7 7 7'} /></svg>
}
export function Profile({app}:{app:FreeAppStore}) {
  useDocumentTitle('Profile — Hanzi')
  const {user,signIn,signOut}=useAuth(app)
  const {settings,save,error}=useAudioSettings()
  const player=useRef<HTMLAudioElement>(null)
  const [status,setStatus]=useState('')
  const [voice,setVoice]=useState('')
  useEffect(()=>{
    const refresh=()=>setVoice(mandarinVoices()[0]?.name ?? 'No Mandarin browser voice available')
    refresh()
    if('speechSynthesis' in globalThis) speechSynthesis.addEventListener('voiceschanged',refresh)
    return ()=>{if('speechSynthesis' in globalThis)speechSynthesis.removeEventListener('voiceschanged',refresh);stopPlayback(player)}
  },[])
  useEffect(()=>{stopPlayback(player);setStatus('')},[settings])
  const move=(index:number,delta:number)=>{
    const order=[...settings.order];[order[index],order[index+delta]]=[order[index+delta],order[index]]
    save({...settings,order})
  }
  return <div className="mx-auto max-w-xl">
    <PageHeader title="Profile" />
    <div className="mb-5 flex items-center gap-3">
      <Avatar user={user} size={36} /><span className="min-w-0 flex-1 truncate font-bold">{user?.login ?? 'On this device'}</span>
      <Button iconOnly aria-label={user ? 'Sign out' : 'Sign in'} title={user ? 'Sign out' : 'Sign in'} onClick={user ? signOut : signIn}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4" /></svg></Button>
    </div>
    <section aria-labelledby="audio-heading" className="rounded border border-line-strong bg-panel p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="audio-heading" className="text-lg font-bold">Pronunciation</h2>
        <Button iconOnly aria-label="Preview pronunciation" title="Preview: 一 · yī" onClick={()=>{
          if(!player.current)return
          setStatus('')
          playPronunciation(player.current,player,{kind:'character',text:'一'},settings,{
            started:source=>setStatus(`Playing: ${SOURCE_NAMES[source]}`),ended:()=>setStatus(''),failed:setStatus,
          })
        }}><PracticeIcon name="play" /></Button>
      </div>
      <p className="mt-1 text-sm text-muted">Top first. Missing or failed audio uses the next enabled source.</p>
      <ol aria-label="Audio fallback order" className="mt-4 space-y-3">
        {settings.order.map((source,index)=>{
          const enabled=!settings.disabled.includes(source)
          return <li key={source} data-source={source} className="rounded border border-line p-3">
            <label className="flex items-center gap-3 font-bold">
              <input type="checkbox" className="h-5 w-5 accent-accent" checked={enabled} disabled={enabled && settings.disabled.length===settings.order.length-1} aria-label={`Use ${SOURCE_NAMES[source]}`} onChange={()=>save({...settings,disabled:enabled?[...settings.disabled,source]:settings.disabled.filter(s=>s!==source)})} />
              <span>{index+1}. {SOURCE_NAMES[source]}</span>
            </label>
            <p className="mt-1 text-sm text-muted">{descriptions[source]}</p>
            <div className="mt-2 flex justify-end gap-2">
              <Button iconOnly aria-label={`Move ${SOURCE_NAMES[source]} up`} disabled={index===0} onClick={()=>move(index,-1)}><Arrow /></Button>
              <Button iconOnly aria-label={`Move ${SOURCE_NAMES[source]} down`} disabled={index===settings.order.length-1} onClick={()=>move(index,1)}><Arrow down /></Button>
            </div>
          </li>
        })}
      </ol>
      <p className="mt-3 text-xs text-muted">{voice}</p>
      <p role="status" className="mt-2 text-sm">{status}</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <audio ref={player} preload="none" />
    </section>
    {user && <details className="mt-4 rounded border border-line p-3"><summary className="cursor-pointer font-bold">Account</summary><ProfilePage app={app} showThemeToggle={false} /></details>}
    <div className="mt-4 flex items-center gap-3"><span className="flex-1 font-bold">Appearance</span><TextSizeToggle /><ThemeToggle /></div>
  </div>
}
