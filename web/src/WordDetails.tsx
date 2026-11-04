import { useEffect, useRef, useState } from 'react'
import { Modal } from '@freeappstore/sdk/ui'
import { ToneGuide, ToneMarker } from './Pronunciation'
import { useAudioSettings } from './audio-settings'
import { playPronunciation, stopPlayback } from './playback'
import type { WordExample } from './examples'
export function WordDetails({word,conceal=false}:{word:WordExample;conceal?:boolean}) {
  const audio = useRef<HTMLAudioElement>(null)
  const {settings} = useAudioSettings()
  const [error,setError] = useState('')
  const [guide,setGuide] = useState(false)
  useEffect(() => {setError('');return () => stopPlayback(audio)},[word.word,settings])
  const play = () => {
    if(!audio.current)return
    setError('')
    playPronunciation(audio.current,audio,{kind:'word',text:word.word,example:word},settings,{
      started:()=>{},ended:()=>{},failed:setError,
    })
  }
  return <div className="min-w-0">
    <audio ref={audio} preload="none" />
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-4xl leading-tight">
      <button lang="zh-Hans" aria-label={`Pronounce word ${conceal ? 'from memory' : word.word}`} title="Play word pronunciation" onClick={play} className="min-h-11 rounded-sm hover:text-accent-deep">{conceal ? '??' : word.word}</button>
      <button aria-label={`Pronounce word ${word.pinyin}`} title="Play word pronunciation" onClick={play} className="min-h-11 max-w-full break-words rounded-sm text-left hover:text-accent-deep">{word.pinyin}</button>
      <button aria-label="Word tone guide" title="Tone guide" onClick={()=>{stopPlayback(audio);setGuide(true)}} className="flex min-h-11 items-center rounded-sm hover:bg-accent-soft">{word.pinyin.split(' ').map((p,i)=><ToneMarker key={i} pinyin={p} />)}</button>
      <span className="max-w-full break-words">{word.meaning}</span>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    <Modal open={guide} onClose={()=>setGuide(false)} title="Mandarin tones"><ToneGuide /></Modal>
  </div>
}
