import { audioPath, exampleAudioPath } from './audio'
import { type AudioSettings, type AudioSource } from './audio-settings'
import type { WordExample } from './examples'
import modelCharacters from './model-characters.json'
export const MODEL_CHARACTERS=new Set(modelCharacters)
export type SpeechItem = {kind:'character'; text:string} | {kind:'word'; text:string; example:WordExample}
export function playbackSources(item: SpeechItem, settings: AudioSettings) {
  return settings.order.filter(source=>!settings.disabled.includes(source)).flatMap<{source:AudioSource;path:string|null}>(source=> {
    if(source==='browser') return [{source,path:null}]
    const path = source==='recordings' ? (item.kind==='character' ? audioPath(item.text) : exampleAudioPath(item.example))
      : item.kind==='character' && MODEL_CHARACTERS.has(item.text) ? `/audio/kokoro/${item.text.codePointAt(0)!.toString(16)}.mp3` : undefined
    return path ? [{source,path}] : []
  })
}
export function mandarinVoices() {
  if (!('speechSynthesis' in globalThis)) return []
  try {
    return speechSynthesis.getVoices().filter(v=> /^(cmn|zh)(-|_|$)/i.test(v.lang) && !/(?:-|_)(HK|MO|yue|wuu|nan|hak|gan)(?:-|_|$)/i.test(v.lang))
      .sort((a,b)=>Number(b.localService)-Number(a.localService) || Number(/^zh[-_]CN$/i.test(b.lang))-Number(/^zh[-_]CN$/i.test(a.lang)))
  } catch {return []}
}
let active: {owner:object;cancel:()=>void} | null = null
export function stopPlayback(owner?:object) {
  if(active && (!owner || active.owner===owner)) { const previous=active; active=null;previous.cancel() }
}
/** One app-wide playback session. Cancellation prevents delayed fallback from speaking. */
export function playPronunciation(player: HTMLAudioElement, owner: object, item: SpeechItem, settings: AudioSettings,
  callbacks: {started:(source:AudioSource)=>void; ended:()=>void; failed:(message:string)=>void}) {
  stopPlayback()
  let stopped=false
  let clearCurrent=()=>{}
  const session={owner,cancel:()=>{stopped=true;clearCurrent();player.pause();callbacks.ended()}}
  active=session
  const finish=()=>{if(stopped)return;stopped=true;clearCurrent();if(active===session)active=null;callbacks.ended()}
  const sources=playbackSources(item,settings)
  const next=(index:number)=>{
    if(stopped)return
    clearCurrent(); player.pause()
    const candidate=sources[index]
    if(!candidate) {finish();callbacks.failed('Audio unavailable. Check your Mandarin browser voice or try again.');return}
    let settled=false
    const fail=()=>{if(settled || stopped)return;settled=true;clearCurrent();next(index+1)}
    if(candidate.path) {
      const began=()=>{if(stopped)return;clearTimeout(timer);timer=setTimeout(fail,15000);callbacks.started(candidate.source)}
      const ended=()=>finish()
      let timer=setTimeout(fail,5000)
      clearCurrent=()=>{clearTimeout(timer);player.removeEventListener('playing',began);player.removeEventListener('ended',ended);player.removeEventListener('error',fail);player.removeEventListener('stalled',fail)}
      player.addEventListener('playing',began);player.addEventListener('ended',ended);player.addEventListener('error',fail);player.addEventListener('stalled',fail)
      player.setAttribute('src',candidate.path);player.load();player.currentTime=0
      void player.play().catch(fail)
    } else {
      if(!('speechSynthesis' in globalThis) || !('SpeechSynthesisUtterance' in globalThis)) {fail();return}
      let utterance:SpeechSynthesisUtterance | null=null
      let timer:ReturnType<typeof setTimeout>
      let voiceTimer:ReturnType<typeof setTimeout>
      const speak=()=>{
        if(stopped || settled || utterance)return
        const voice=mandarinVoices()[0]
        if(!voice)return
        clearTimeout(voiceTimer);speechSynthesis.removeEventListener('voiceschanged',speak)
        utterance=new SpeechSynthesisUtterance(item.text);utterance.voice=voice;utterance.lang=voice.lang
        utterance.onstart=()=>{clearTimeout(timer);timer=setTimeout(fail,15000);if(!stopped)callbacks.started('browser')}
        utterance.onend=()=>finish();utterance.onerror=()=>fail()
        timer=setTimeout(fail,5000)
        try {speechSynthesis.speak(utterance)} catch {fail()}
      }
      clearCurrent=()=>{
        clearTimeout(timer);clearTimeout(voiceTimer);speechSynthesis.removeEventListener('voiceschanged',speak)
        if(utterance){utterance.onstart=null;utterance.onend=null;utterance.onerror=null;speechSynthesis.cancel()}
      }
      voiceTimer=setTimeout(fail,1000)
      speechSynthesis.addEventListener('voiceschanged',speak);speak()
    }
  }
  next(0)
}
