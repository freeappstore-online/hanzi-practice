import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import type { Character } from './characters'
import { toneFor } from './tones'

let activePlayer: HTMLAudioElement | null = null

export const audioPath = (hanzi: string) => `/audio/${hanzi.codePointAt(0)!.toString(16)}.mp3`
export function ToneMarker({pinyin}: {pinyin: string}) {
  const tone = toneFor(pinyin)
  return <span role="img" aria-label={`Tone ${tone.number}: ${tone.label}`} className="inline-block rounded border border-accent bg-accent-soft px-3 py-2 text-accent-deep">
    <span aria-hidden="true" className="flex items-center gap-2 text-3xl font-extrabold leading-none"><span>{tone.number}</span><span>{tone.contour}</span></span>
    <span aria-hidden="true" className="mt-1 block text-xs font-bold">{tone.number === 5 ? 'Neutral' : `Tone ${tone.number}`}</span>
  </span>
}
export function Pronunciation({character, active = true}: {character: Character; active?: boolean}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(0)
  useEffect(() => {
    request.current++
    const player = audio.current
    player?.pause()
    if (player) player.currentTime = 0
    setPlaying(false); setError('')
    return () => { request.current++; player?.pause(); if (activePlayer === player) activePlayer = null }
  }, [character.hanzi, active])
  async function play() {
    const player = audio.current
    if (!player || !active) return
    const token = ++request.current
    activePlayer?.pause()
    activePlayer = player
    player.pause(); player.currentTime = 0
    if (player.error) player.load()
    setError('')
    try { await player.play() }
    catch (error) { if (request.current === token && activePlayer === player && !(error instanceof DOMException && error.name === 'AbortError')) { setPlaying(false); setError('Audio could not play. Tap Listen to retry; reconnect if it has not been downloaded yet.') } }
  }
  return <div>
    <audio ref={audio} src={audioPath(character.hanzi)} preload="none" onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); if (activePlayer === audio.current) activePlayer = null }} />
    <Button aria-label={`Listen to ${character.pinyin}`} onClick={() => void play()}>
      <span aria-hidden="true">♪ </span>{playing ? 'Play again' : 'Listen'}
    </Button>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </div>
}
