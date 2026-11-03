import { useEffect, useState } from 'react'
export const AUDIO_SETTINGS_KEY = 'hanzi-practice:audio:v1'
export const AUDIO_SOURCES = ['recordings', 'kokoro', 'browser'] as const
export type AudioSource = typeof AUDIO_SOURCES[number]
export type AudioSettings = {order: AudioSource[]; disabled: AudioSource[]}
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {order: [...AUDIO_SOURCES], disabled: []}
export const SOURCE_NAMES: Record<AudioSource,string> = {recordings:'Human recordings',kokoro:'Kokoro model',browser:'Browser TTS'}
export function parseAudioSettings(raw: string | null): AudioSettings {
  try {
    const data = JSON.parse(raw || 'null')
    const order = Array.isArray(data?.order) ? [...new Set<AudioSource>(data.order.filter((x: AudioSource) => AUDIO_SOURCES.includes(x)))] : []
    for (const source of AUDIO_SOURCES) if (!order.includes(source)) order.push(source)
    const disabled = AUDIO_SOURCES.filter(source => Array.isArray(data?.disabled) && data.disabled.includes(source))
    return {order, disabled: disabled.length < AUDIO_SOURCES.length ? disabled : []}
  } catch { return {order:[...AUDIO_SOURCES],disabled:[]} }
}
let unsavedSettings: AudioSettings | null = null
export function readAudioSettings() {
  if (unsavedSettings) return unsavedSettings
  try { return parseAudioSettings(localStorage.getItem(AUDIO_SETTINGS_KEY)) }
  catch { return {order:[...AUDIO_SOURCES],disabled:[]} }
}
export function useAudioSettings() {
  const [settings,setSettings] = useState(readAudioSettings)
  const [error,setError] = useState('')
  useEffect(() => {
    const update = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== AUDIO_SETTINGS_KEY && event.key !== null) return
      if (event instanceof CustomEvent) setSettings(event.detail)
      else setSettings(readAudioSettings())
    }
    addEventListener('hanzi-audio-change',update); addEventListener('storage',update)
    return () => {removeEventListener('hanzi-audio-change',update);removeEventListener('storage',update)}
  }, [])
  const save = (next: AudioSettings) => {
    next = parseAudioSettings(JSON.stringify(next))
    setSettings(next)
    try { localStorage.setItem(AUDIO_SETTINGS_KEY,JSON.stringify(next)); unsavedSettings=null; setError('') }
    catch { unsavedSettings=next; setError('Audio settings are kept only until this page closes. Device storage is unavailable.') }
    dispatchEvent(new CustomEvent('hanzi-audio-change',{detail:next}))
  }
  return {settings,save,error}
}
