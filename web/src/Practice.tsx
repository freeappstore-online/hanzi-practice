import { useEffect, useRef, useState } from 'react'
import HanziWriter from 'hanzi-writer'
import { Badge, Card, ProgressBar, Tabs } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { CHARACTERS, LEVELS, charactersForLevel, nextCharacter, type Character } from './characters'
import { CharacterDetails } from './Pronunciation'
import { loadCharacterData } from './characterData'
import type { Attempt, Mode } from './progress'

type Phase = 'loading' | 'ready' | 'drawing' | 'watching' | 'complete' | 'error'
export function Practice({ character, onSelect, onComplete, active, autoAdvance, onAutoAdvanceChange }: {
  character: Character; onSelect: (c: Character) => void; onComplete: (a: Attempt) => void; active: boolean; autoAdvance: boolean; onAutoAdvanceChange: (enabled: boolean) => void
}) {
  const target = useRef<HTMLDivElement>(null)
  const writer = useRef<HanziWriter | null>(null)
  const generation = useRef(0)
  const dataReady = useRef(false)
  const hints = useRef(0)
  const autoStartNext = useRef<string | null>(null)
  const levelCharacters = charactersForLevel(character.level)
  const next = nextCharacter(character)
  const callback = useRef(onComplete)
  callback.current = onComplete
  const [mode, setMode] = useState<Mode>('guided')
  const [phase, setPhase] = useState<Phase>('loading')
  const [strokeCount, setStrokeCount] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [hintCount, setHintCount] = useState(0)
  const [message, setMessage] = useState('Loading…')
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (active && next) void loadCharacterData(next.hanzi).catch(() => { /* Retry when needed. */ })
  }, [active, next])

  // Keep one writer across characters and routes; resizing preserves the current quiz.
  useEffect(() => {
    const node = target.current!
    const colors = () => {
      const css = getComputedStyle(document.documentElement)
      return { strokeColor: css.getPropertyValue('--ink').trim(), drawingColor: css.getPropertyValue('--accent').trim(), highlightColor: css.getPropertyValue('--accent').trim(), outlineColor: css.getPropertyValue('--accent-soft').trim() }
    }
    const instance = new HanziWriter(node, {
      width: node.clientWidth || 320, height: node.clientWidth || 320, padding: 24,
      ...colors(), showCharacter: false, showOutline: true,
      strokeAnimationSpeed: 0.8, delayBetweenStrokes: 350,
      charDataLoader: loadCharacterData,
    })
    writer.current = instance
    const resize = new ResizeObserver(() => {
      const size = node.clientWidth
      if (size) instance.updateDimensions({ width: size, height: size, padding: 24 })
    })
    resize.observe(node)
    const theme = new MutationObserver(() => {
      if (!dataReady.current) return
      const { strokeColor, drawingColor, highlightColor, outlineColor } = colors()
      for (const [key, value] of Object.entries({strokeColor, drawingColor, highlightColor, outlineColor})) {
        void instance.updateColor(key as 'strokeColor', value, { duration: 0 })
      }
    })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      generation.current++
      instance.cancelQuiz()
      if (dataReady.current) void instance.pauseAnimation()
      dataReady.current = false
      resize.disconnect()
      theme.disconnect()
      node.replaceChildren()
      writer.current = null
    }
  }, [])

  useEffect(() => {
    const instance = writer.current
    if (!active) { autoStartNext.current = null; return }
    if (!instance) return
    const token = ++generation.current
    let canceled = false
    dataReady.current = false
    setPhase('loading'); setCorrect(0); setMistakes(0); setHintCount(0); hints.current = 0
    setMessage('Loading…')
    instance.cancelQuiz()
    void instance.setCharacter(character.hanzi).then(async () => {
      if (canceled || token !== generation.current) return
      const data = await instance.getCharacterData()
      if (canceled || token !== generation.current) return
      dataReady.current = true
      setStrokeCount(data.strokes.length)
      if (mode === 'guided') await instance.showOutline({duration: 0})
      else await instance.hideOutline({duration: 0})
      await instance.hideCharacter({duration: 0})
      if (canceled || token !== generation.current) return
      setPhase('ready')
      setMessage('')
      if (autoStartNext.current === character.hanzi) { autoStartNext.current = null; start(false) }
    }).catch(() => {
      if (!canceled) { setPhase('error'); setMessage('Could not load this character. Reconnect and try again.') }
    })
    return () => { canceled = true; generation.current++; instance.cancelQuiz(); if (dataReady.current) void instance.pauseAnimation(); dataReady.current = false }
  }, [character.hanzi, mode, round, active])

  useEffect(() => {
    if (phase !== 'complete' || !active || !autoAdvance || !next) return
    const timer = window.setTimeout(() => {
      autoStartNext.current = next.hanzi
      onSelect(next)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [phase, active, autoAdvance, next, onSelect])

  const start = (scrollToPad = true) => {
    const instance = writer.current
    if (!instance || !dataReady.current) return
    autoStartNext.current = null
    const token = ++generation.current
    setCorrect(0); setMistakes(0); setHintCount(0); hints.current = 0
    if (scrollToPad) target.current?.scrollIntoView({block: 'center', behavior: 'instant'})
    setPhase('drawing'); setMessage('')
    void instance.quiz({
      showHintAfterMisses: false, highlightOnComplete: true,
      onMistake: data => {
        if (token !== generation.current) return
        setMistakes(data.totalMistakes)
        setMessage(`Try stroke ${data.strokeNum + 1} again.`)
      },
      onCorrectStroke: data => {
        if (token !== generation.current) return
        setCorrect(data.strokeNum + 1)
        setMessage('')
      },
      onComplete: summary => {
        if (token !== generation.current) return
        generation.current++
        setPhase('complete'); setMessage(next ? '' : 'End of the library. Choose a level to continue.')
        callback.current({character: character.hanzi, mode, mistakes: summary.totalMistakes, hints: hints.current, at: new Date().toISOString()})
      },
    })
  }
  const watch = async () => {
    const instance = writer.current
    if (!instance) return
    const token = ++generation.current
    instance.cancelQuiz()
    target.current?.scrollIntoView({block: 'center', behavior: 'instant'})
    setPhase('watching'); setCorrect(0); setMessage('')
    await instance.animateCharacter()
    if (token !== generation.current) return
    await instance.hideCharacter({duration: 200})
    if (token !== generation.current) return
    setPhase('ready'); setMessage('')
  }
  const busy = phase === 'loading' || phase === 'watching' || phase === 'error'
  return <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)] md:gap-x-6">
    <div className="min-w-0 space-y-3 md:col-start-2 md:row-start-1">
      <CharacterDetails character={character} active={active} concealCharacter={mode === 'recall'} />
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor="level" className="sr-only">Study level</label>
        <select id="level" value={character.level} onChange={e => { autoStartNext.current = null; onSelect(charactersForLevel(Number(e.target.value))[0]) }} className="min-h-11 min-w-0 w-full rounded-sm border border-line-strong bg-panel px-2 text-sm">
          {LEVELS.map(level => <option key={level.id} value={level.id}>Level {level.id} · {level.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="character">Choose a character</label>
        <select id="character" className="min-h-11 min-w-0 w-full rounded-sm border border-line-strong bg-panel px-2 text-sm" value={character.hanzi} onChange={e => { autoStartNext.current = null; onSelect(CHARACTERS.find(c => c.hanzi === e.target.value)!) }}>
          {levelCharacters.map(c => <option key={c.hanzi} value={c.hanzi}>{mode === 'guided' ? `${c.hanzi} · ` : ''}{c.pinyin} · {c.meaning}</option>)}
        </select>
      </div>
    </div>
    <div className="min-w-0 md:col-start-1 md:row-start-1 md:row-span-2">
      <Card>
        <div className="mb-2 flex items-center justify-between gap-3 text-sm text-muted">
          <Badge>{levelCharacters.indexOf(character) + 1} / {levelCharacters.length}</Badge>
          <span>{strokeCount} {strokeCount === 1 ? 'stroke' : 'strokes'}</span>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[min(360px,calc(100svh-100px))] overflow-hidden rounded border border-line-strong bg-paper">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-line-strong" viewBox="0 0 100 100">
            <path d="M50 0V100 M0 50H100 M0 0L100 100 M100 0L0 100" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 2" />
          </svg>
          <div ref={target} role="img" aria-label={`Writing area for ${character.hanzi}. Draw with a mouse, finger, or stylus.`} className="relative aspect-square w-full touch-none select-none" />
        </div>
        <div className="mt-2"><ProgressBar value={correct} max={strokeCount || 1} label={`${correct} of ${strokeCount} strokes`} /></div>
        <p className="text-sm text-muted" role="status">{message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button primary onClick={() => start()} disabled={busy}>{phase === 'complete' || phase === 'drawing' ? 'Practice again' : 'Start practice'}</Button>
          <Button onClick={() => void watch()} disabled={busy}>Watch strokes</Button>
          <Button disabled={phase !== 'drawing'} onClick={() => { hints.current++; setHintCount(hints.current); void writer.current?.highlightStroke(correct) }}>Hint</Button>
          {phase === 'error' && <Button onClick={() => setRound(r => r + 1)}>Retry loading</Button>}
        </div>
      </Card>
    </div>
    <div className="min-w-0 space-y-3 md:col-start-2 md:row-start-2">
      <Tabs tabs={[{key: 'guided', label: 'Guided'}, {key: 'recall', label: 'From memory'}]} active={mode} onChange={key => { autoStartNext.current = null; setMode(key as Mode) }} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Button disabled={!next} onClick={() => { autoStartNext.current = null; if (next) onSelect(next) }}>Next character →</Button>
        <button type="button" aria-label="Autoplay" aria-pressed={autoAdvance} title={autoAdvance ? 'Pause autoplay' : 'Enable autoplay'} onClick={() => { autoStartNext.current = null; onAutoAdvanceChange(!autoAdvance) }} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-panel hover:bg-paper-deep ${autoAdvance ? 'text-accent-deep' : 'text-ink'}`}>
          <svg aria-hidden="true" className="shrink-0" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">{autoAdvance ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M7 4v16l14-8z" />}</svg>
        </button>
      </div>
      {(mistakes > 0 || hintCount > 0) && <p className="text-sm text-muted">{mistakes} retries · {hintCount} hints</p>}
    </div>
  </div>
}
