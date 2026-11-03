import { useEffect, useRef, useState } from 'react'
import { Modal } from '@freeappstore/sdk/ui'
import type { Character } from './characters'
import { toneFor } from './tones'
import { EXAMPLES, SCENES } from './examples'
import { audioPath, exampleAudioPath } from './audio'

let activePlayer: HTMLAudioElement | null = null
export { audioPath } from './audio'
export function ToneMarker({pinyin}: {pinyin: string}) {
  const tone = toneFor(pinyin)
  return <span className="inline-flex shrink-0 align-middle text-4xl leading-none text-accent-deep">
    <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 40 40" fill="none">
      <path d="M5 8H35 M5 20H35 M5 32H35" stroke="currentColor" opacity="0.12" strokeWidth="1" />
      {tone.path ? <path d={tone.path} stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /> : <circle cx="20" cy="20" r="3.5" fill="currentColor" />}
    </svg>
  </span>
}
const GUIDE = [
  ['yī', '1. High and level', 'Keep your pitch steady and high.'],
  ['rén', '2. Rising', 'Start in the middle and raise your pitch.'],
  ['hǎo', '3. Dipping', 'Lower your pitch, then let it rise. In speech, it often stays low.'],
  ['dà', '4. Falling', 'Start high and drop your pitch sharply.'],
]
export function CharacterDetails({character, active = true, concealCharacter = false, onExampleOpen}: {character: Character; active?: boolean; concealCharacter?: boolean; onExampleOpen?: () => void}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState<'character' | 'word' | null>(null)
  const requestedSource = useRef<'character' | 'word'>('character')
  const [guideOpen, setGuideOpen] = useState(false)
  const [exampleOpen, setExampleOpen] = useState(false)
  const example = EXAMPLES[character.hanzi]
  const wordAudio = exampleAudioPath(example)
  const request = useRef(0)
  const tone = toneFor(character.pinyin)
  useEffect(() => {
    request.current++
    const player = audio.current
    player?.pause()
    if (player) player.currentTime = 0
    setError(''); setPlaying(null); setGuideOpen(false); setExampleOpen(false)
    return () => { request.current++; player?.pause(); if (activePlayer === player) activePlayer = null }
  }, [character.hanzi, active])
  function stop() {
    request.current++
    activePlayer?.pause()
    audio.current?.pause()
    setPlaying(null); setError('')
    if (activePlayer === audio.current) activePlayer = null
  }
  async function play(source: 'character' | 'word' = 'character') {
    const player = audio.current
    const path = source === 'word' ? wordAudio : audioPath(character.hanzi)
    if (!player || !active || !path) return
    const token = ++request.current
    activePlayer?.pause(); activePlayer = player
    player.pause()
    requestedSource.current = source
    if (player.getAttribute('src') !== path) player.src = path
    player.currentTime = 0
    if (player.error) player.load()
    setError('')
    try { await player.play() }
    catch (error) {
      if (request.current === token && activePlayer === player && !(error instanceof DOMException && error.name === 'AbortError')) {
        setError('Audio unavailable. Tap the character or pinyin to retry.')
      }
    }
  }
  return <div className="min-w-0">
    <audio ref={audio} src={audioPath(character.hanzi)} preload="none" onPlaying={() => setPlaying(requestedSource.current)} onPause={() => setPlaying(null)} onEnded={() => { setPlaying(null); if (activePlayer === audio.current) activePlayer = null }} />
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-4xl leading-tight">
      <button type="button" lang="zh-Hans" data-testid="reference-character" title="Play pronunciation" aria-label={`Pronounce ${concealCharacter ? 'character' : character.hanzi}`} onClick={() => void play()} className={`min-h-11 min-w-11 rounded-sm text-4xl leading-none hover:text-accent-deep ${playing === 'character' ? 'bg-accent-soft text-accent-deep' : ''}`}>{concealCharacter ? '?' : character.hanzi}</button>
      <button type="button" data-testid="pinyin" title="Play pronunciation" aria-label={`Pronounce ${character.pinyin}`} onClick={() => void play()} className={`min-h-11 rounded-sm text-4xl leading-none hover:text-accent-deep ${playing === 'character' ? 'bg-accent-soft text-accent-deep' : ''}`}>{character.pinyin}</button>
      <button type="button" aria-label={`Tone ${tone.number}: ${tone.label}`} title="Tone guide" onClick={() => { stop(); setGuideOpen(true) }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-4xl hover:bg-accent-soft"><ToneMarker pinyin={character.pinyin} /></button>
      <button type="button" data-testid="translation" aria-label={`Example for ${character.hanzi}: ${character.meaning}`} title="Word example" className="min-h-11 max-w-full break-words rounded-sm text-left text-4xl leading-tight hover:text-accent-deep" onClick={() => { stop(); onExampleOpen?.(); setExampleOpen(true) }}>{character.meaning}</button>
    </div>
    {error && !exampleOpen && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    <Modal open={exampleOpen} onClose={() => { stop(); setExampleOpen(false) }} title="Word example">
      {example && <div className="space-y-4">
        {example.image && <img src={`/examples/${example.image}.png`} alt={SCENES[example.image]} width="768" height="512" className="aspect-[3/2] w-full rounded object-cover" />}
        {wordAudio ? <>
          <button type="button" lang="zh-Hans" aria-label={`Pronounce word ${example.word}`} title="Play word pronunciation" onClick={() => void play('word')} className={`block min-h-11 break-words rounded-sm text-left text-4xl leading-relaxed hover:text-accent-deep ${playing === 'word' ? 'bg-accent-soft' : ''}`}>{[...example.word].map((char,i) => <span key={i} className={char === character.hanzi ? 'text-accent-deep' : ''}>{char}</span>)}</button>
          <button type="button" aria-label={`Pronounce word ${example.pinyin}`} title="Play word pronunciation" onClick={() => void play('word')} className={`block min-h-11 rounded-sm text-left text-2xl hover:text-accent-deep ${playing === 'word' ? 'bg-accent-soft' : ''}`}>{example.pinyin}</button>
        </> : <><p lang="zh-Hans" className="break-words text-4xl leading-relaxed">{[...example.word].map((char,i) => <span key={i} className={char === character.hanzi ? 'text-accent-deep' : ''}>{char}</span>)}</p><p className="text-2xl">{example.pinyin}</p></>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <p className="text-xl">{example.meaning}</p>
        {example.word.includes('一') || example.word.includes('不') || (character.hanzi === '子') || /[ǎěǐǒǔǚ].* [^ ]*[ǎěǐǒǔǚ]/.test(example.pinyin) ? <p className="text-xs text-muted">The tone can change in a word or phrase.</p> : null}
      </div>}
    </Modal>
    <Modal open={guideOpen} onClose={() => setGuideOpen(false)} title="Mandarin tones">
      <div className="space-y-4">
        {GUIDE.map(([pinyin,title,description]) => <div key={pinyin} className="flex items-start gap-4"><ToneMarker pinyin={pinyin} /><div><h3 className="font-bold">{title} · {pinyin}</h3><p className="text-sm text-muted">{description}</p></div></div>)}
        <p className="border-t border-line pt-3 text-sm text-muted">The neutral tone (·) is short and light. The pronunciation of a tone can change next to other tones.</p>
      </div>
    </Modal>
  </div>
}
