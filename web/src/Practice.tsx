import { useEffect, useRef, useState } from 'react'
import HanziWriter from 'hanzi-writer'
import { Badge, Card, ProgressBar } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { CHARACTERS, LEVELS, charactersForLevel, nextCharacter, type Character } from './characters'
import { CharacterDetails } from './Pronunciation'
import { loadCharacterData } from './characterData'
import type { Attempt, Mode } from './progress'
import type { ReviewEvent } from './review'

type Phase = 'loading' | 'ready' | 'drawing' | 'watching' | 'complete' | 'error'
export function Practice({ character, onSelect, onComplete, active, autoAdvance, onAutoAdvanceChange, practiceRequest, onReviewEvent, review, onBrowse, onExitReview }: {
  character: Character; onSelect: (c: Character) => void; onComplete: (a: Attempt) => void; active: boolean; autoAdvance: boolean; onAutoAdvanceChange: (enabled: boolean) => void; practiceRequest: number
  onReviewEvent: (event: ReviewEvent) => void; onBrowse: (c: Character) => void; onExitReview: () => void
  review?: {index: number; total: number; next: Character | null}
}) {
  const target = useRef<HTMLDivElement>(null)
  const writer = useRef<HanziWriter | null>(null)
  const generation = useRef(0)
  const dataReady = useRef(false)
  const hints = useRef(0)
  const autoStartNext = useRef<string | null>(null)
  const handledPracticeRequest = useRef(0)
  const levelCharacters = charactersForLevel(character.level)
  const next = review ? review.next : nextCharacter(character)
  const callback = useRef(onComplete)
  callback.current = onComplete
  const [mode, setMode] = useState<Mode>(review ? 'recall' : 'guided')
  const reviewCallback = useRef(onReviewEvent)
  reviewCallback.current = onReviewEvent
  const currentAttempt = useRef<ReviewEvent | null>(null)
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
      const outlineToken = document.documentElement.dataset.theme === 'dark' ? '--muted' : '--accent-soft'
      return { strokeColor: css.getPropertyValue('--ink').trim(), drawingColor: css.getPropertyValue('--accent').trim(), highlightColor: css.getPropertyValue('--accent').trim(), outlineColor: css.getPropertyValue(outlineToken).trim() }
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
    if (!active) { autoStartNext.current = null; currentAttempt.current = null; return }
    if (!instance) return
    const token = ++generation.current
    let canceled = false
    dataReady.current = false
    currentAttempt.current = null
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
      if (autoStartNext.current === character.hanzi || practiceRequest > handledPracticeRequest.current) {
        autoStartNext.current = null
        handledPracticeRequest.current = practiceRequest
        start(false)
      }
    }).catch(() => {
      if (!canceled) { setPhase('error'); setMessage('Could not load this character. Reconnect and try again.') }
    })
    return () => { canceled = true; generation.current++; instance.cancelQuiz(); if (dataReady.current) void instance.pauseAnimation(); dataReady.current = false }
  }, [character.hanzi, mode, round, active, practiceRequest])

  useEffect(() => {
    if (phase !== 'complete' || !active || !autoAdvance || !next) return
    const timer = window.setTimeout(() => {
      autoStartNext.current = next.hanzi
      onSelect(next)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [phase, active, autoAdvance, next, onSelect])

  const revealPad = () => {
    const rect = target.current?.getBoundingClientRect()
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
    if (rect && (rect.top < headerBottom + 12 || rect.bottom > innerHeight - 76)) target.current?.scrollIntoView({block: 'center', behavior: 'instant'})
  }
  const start = (scrollToPad = true) => {
    const instance = writer.current
    if (!instance || !dataReady.current) return
    autoStartNext.current = null
    const token = ++generation.current
    setCorrect(0); setMistakes(0); setHintCount(0); hints.current = 0
    if (scrollToPad) revealPad()
    setPhase('drawing'); setMessage('')
    currentAttempt.current = {id: crypto.randomUUID(), character: character.hanzi, mode, mistakes: 0, hints: 0, at: new Date().toISOString(), completed: false}
    void instance.quiz({
      showHintAfterMisses: false, highlightOnComplete: true,
      onMistake: data => {
        if (token !== generation.current) return
        setMistakes(data.totalMistakes)
        if (currentAttempt.current) {
          currentAttempt.current = {...currentAttempt.current, mistakes: data.totalMistakes, at: new Date().toISOString()}
          reviewCallback.current(currentAttempt.current)
        }
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
        const completedAt = new Date().toISOString()
        setPhase('complete'); setMessage(next ? '' : review ? 'Review complete.' : 'End of the library. Choose a level to continue.')
        if (currentAttempt.current) {
          reviewCallback.current({...currentAttempt.current, mistakes: summary.totalMistakes, hints: hints.current, at: completedAt, completed: true})
          currentAttempt.current = null
        }
        callback.current({character: character.hanzi, mode, mistakes: summary.totalMistakes, hints: hints.current, at: completedAt})
      },
    })
  }
  const recordHint = () => {
    if (!currentAttempt.current) return
    hints.current++; setHintCount(hints.current)
    currentAttempt.current = {...currentAttempt.current, hints: hints.current, at: new Date().toISOString()}
    reviewCallback.current(currentAttempt.current)
  }
  const watch = async () => {
    recordHint()
    currentAttempt.current = null
    const instance = writer.current
    if (!instance) return
    const token = ++generation.current
    instance.cancelQuiz()
    revealPad()
    setPhase('watching'); setCorrect(0); setMessage('')
    await instance.animateCharacter()
    if (token !== generation.current) return
    await instance.hideCharacter({duration: 200})
    if (token !== generation.current) return
    setPhase('ready'); setMessage('')
  }
  const busy = phase === 'loading' || phase === 'watching' || phase === 'error'
  const startLabel = phase === 'complete' || phase === 'drawing' ? 'Practice again' : 'Start practice'
  return <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)] md:gap-x-6">
    <div className="min-w-0 space-y-3 md:col-start-2 md:row-start-1">
      <CharacterDetails character={character} active={active} concealCharacter={mode === 'recall'} onExampleOpen={recordHint} />
      <div className={review ? 'hidden' : 'grid grid-cols-2 gap-2'}>
        <label htmlFor="level" className="sr-only">Study level</label>
        <select id="level" value={character.level} onChange={e => { autoStartNext.current = null; onBrowse(charactersForLevel(Number(e.target.value))[0]) }} className="min-h-11 min-w-0 w-full rounded-sm border border-line-strong bg-panel px-2 text-sm">
          {LEVELS.map(level => <option key={level.id} value={level.id}>Level {level.id} · {level.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="character">Choose a character</label>
        <select id="character" className="min-h-11 min-w-0 w-full rounded-sm border border-line-strong bg-panel px-2 text-sm" value={character.hanzi} onChange={e => { autoStartNext.current = null; onBrowse(CHARACTERS.find(c => c.hanzi === e.target.value)!) }}>
          {levelCharacters.map((c, i) => <option key={c.hanzi} value={c.hanzi}>{i + 1}. {mode === 'guided' ? `${c.hanzi} · ` : ''}{c.pinyin}</option>)}
        </select>
      </div>
      {review && <div className="flex items-center justify-between text-sm text-muted"><span>Review · {review.index + 1}/{review.total}</span><Button iconOnly aria-label="Back to review queue" title="Back to review queue" onClick={onExitReview}><PracticeIcon name="back" /></Button></div>}
    </div>
    <div className="min-w-0 md:col-start-1 md:row-start-1">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <Button iconOnly role="switch" aria-label="From memory" aria-checked={mode === 'recall'} title={mode === 'guided' ? 'Guided — switch to from memory' : 'From memory — switch to guided'} className="aria-checked:border-accent aria-checked:bg-accent-soft aria-checked:text-accent-deep" onClick={() => { autoStartNext.current = null; setMode(mode === 'guided' ? 'recall' : 'guided') }}><PracticeIcon name={mode === 'guided' ? 'guide' : 'memory'} /></Button>
          <Badge><span className="inline-flex items-center gap-3 tabular-nums">
            <span className="inline-flex items-center gap-1" title="Characters" aria-label={`Character ${review ? review.index + 1 : levelCharacters.indexOf(character) + 1} of ${review ? review.total : levelCharacters.length}`}><PracticeIcon name="characters" size={14} />{review ? review.index + 1 : levelCharacters.indexOf(character) + 1}/{review ? review.total : levelCharacters.length}</span>
            <span className="inline-flex items-center gap-1" title="Strokes" aria-label={`${correct} of ${strokeCount} strokes`}><PracticeIcon name="stroke" size={14} />{correct}/{strokeCount}</span>
          </span></Badge>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[min(360px,calc(100svh-100px))] overflow-hidden rounded border border-line-strong bg-paper">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-line-strong" viewBox="0 0 100 100">
            <path d="M50 0V100 M0 50H100 M0 0L100 100 M100 0L0 100" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 2" />
          </svg>
          <div ref={target} role="img" aria-label={`Writing area for ${character.hanzi}. Draw with a mouse, finger, or stylus.`} className="relative aspect-square w-full touch-none select-none" />
        </div>
        <div className="mt-3" role="progressbar" aria-label="Stroke progress" aria-valuemin={0} aria-valuemax={strokeCount || 1} aria-valuenow={correct}><ProgressBar value={correct} max={strokeCount || 1} height={4} /></div>
        <div className="mt-3 flex items-center justify-between gap-1" role="group" aria-label="Practice controls">
          <Button primary iconOnly aria-label={startLabel} title={startLabel} onClick={() => start()} disabled={busy}>
            <PracticeIcon name={startLabel === 'Start practice' ? 'play' : 'restart'} />
          </Button>
          <Button iconOnly aria-label="Watch strokes" title="Watch strokes" onClick={() => void watch()} disabled={busy}><PracticeIcon name="watch" /></Button>
          <Button iconOnly aria-label="Hint" title="Show the next stroke" disabled={phase !== 'drawing'} onClick={() => { recordHint(); void writer.current?.highlightStroke(correct) }}><PracticeIcon name="hint" /></Button>
          <Button iconOnly aria-label="Next character" title="Next character" disabled={!next} onClick={() => { if (next) { autoStartNext.current = phase === 'drawing' || phase === 'complete' ? next.hanzi : null; onSelect(next) } }}><PracticeIcon name="next" /></Button>
          <Button iconOnly className="aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-deep" aria-label="Autoplay" aria-pressed={autoAdvance} title={autoAdvance ? 'Autoplay on — tap to turn off' : 'Autoplay off — tap to turn on'} onClick={() => { autoStartNext.current = null; onAutoAdvanceChange(!autoAdvance) }}><PracticeIcon name="autoplay" /></Button>
        </div>
        <p className={message ? 'mt-3 text-sm text-muted' : ''} role="status">{message}</p>
        {phase === 'error' && <Button className="mt-3" onClick={() => setRound(r => r + 1)}>Retry loading</Button>}
        {(mistakes > 0 || hintCount > 0) && <p className="mt-2 text-xs text-muted">{mistakes} retries · {hintCount} hints</p>}
      </Card>
    </div>
  </div>
}
