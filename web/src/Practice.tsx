import { useEffect, useRef, useState } from 'react'
import HanziWriter from 'hanzi-writer'
import { Badge, Card, ProgressBar, Tabs } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { CHARACTERS, type Character } from './characters'
import type { Attempt, Mode } from './progress'

type Phase = 'loading' | 'ready' | 'drawing' | 'watching' | 'complete' | 'error'
export function Practice({ character, onSelect, onComplete, active }: {
  character: Character; onSelect: (c: Character) => void; onComplete: (a: Attempt) => void; active: boolean
}) {
  const target = useRef<HTMLDivElement>(null)
  const writer = useRef<HanziWriter | null>(null)
  const generation = useRef(0)
  const dataReady = useRef(false)
  const hints = useRef(0)
  const callback = useRef(onComplete)
  callback.current = onComplete
  const [mode, setMode] = useState<Mode>('guided')
  const [phase, setPhase] = useState<Phase>('loading')
  const [strokeCount, setStrokeCount] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [hintCount, setHintCount] = useState(0)
  const [message, setMessage] = useState('Loading character…')
  const [round, setRound] = useState(0)

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
      charDataLoader: async (char) => {
        const response = await fetch(`/characters/${encodeURIComponent(char)}.json`)
        if (!response.ok) throw new Error('Character data is unavailable')
        return response.json()
      },
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
    if (!instance || !active) return
    const token = ++generation.current
    let canceled = false
    dataReady.current = false
    setPhase('loading'); setCorrect(0); setMistakes(0); setHintCount(0); hints.current = 0
    setMessage('Loading character…')
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
      setMessage(mode === 'guided' ? 'Trace the character in stroke order. Use Hint to see the next stroke.' : 'Write from memory. The outline is hidden; Hint is available if you need it.')
    }).catch(() => {
      if (!canceled) { setPhase('error'); setMessage('Could not load this character. Reconnect and try again.') }
    })
    return () => { canceled = true; generation.current++; instance.cancelQuiz(); if (dataReady.current) void instance.pauseAnimation(); dataReady.current = false }
  }, [character.hanzi, mode, round, active])

  const start = () => {
    const instance = writer.current
    if (!instance || phase === 'loading' || phase === 'error') return
    const token = ++generation.current
    setCorrect(0); setMistakes(0); setHintCount(0); hints.current = 0
    target.current?.scrollIntoView({block: 'center', behavior: 'instant'})
    setPhase('drawing'); setMessage('Draw stroke 1. Follow its direction from start to finish.')
    void instance.quiz({
      showHintAfterMisses: false, highlightOnComplete: true,
      onMistake: data => {
        if (token !== generation.current) return
        setMistakes(data.totalMistakes)
        setMessage(`Try stroke ${data.strokeNum + 1} again. Check its position and direction, or use Hint.`)
      },
      onCorrectStroke: data => {
        if (token !== generation.current) return
        setCorrect(data.strokeNum + 1)
        setMessage(data.strokesRemaining ? `Good. Now draw stroke ${data.strokeNum + 2}.` : 'Character complete!')
      },
      onComplete: summary => {
        if (token !== generation.current) return
        generation.current++
        setPhase('complete'); setMessage('Character complete! Practice again or move to the next character.')
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
    setPhase('watching'); setCorrect(0); setMessage('Watch the stroke order, then try it yourself.')
    await instance.animateCharacter()
    if (token !== generation.current) return
    await instance.hideCharacter({duration: 200})
    if (token !== generation.current) return
    setPhase('ready'); setMessage('Your turn. Start practice when you are ready.')
  }
  const busy = phase === 'loading' || phase === 'watching' || phase === 'error'
  return <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)]">
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Badge variant="accent">{character.group}</Badge>
        <span className="text-sm text-muted">{strokeCount} {strokeCount === 1 ? 'stroke' : 'strokes'}</span>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[min(360px,calc(100svh-100px))] overflow-hidden rounded border border-line-strong bg-paper">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-line-strong" viewBox="0 0 100 100">
          <path d="M50 0V100 M0 50H100 M0 0L100 100 M100 0L0 100" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 2" />
        </svg>
        <div ref={target} role="img" aria-label={`Writing area for ${character.hanzi}. Draw with a mouse, finger, or stylus.`} className="relative aspect-square w-full touch-none select-none" />
      </div>
      <div className="mt-4"><ProgressBar value={correct} max={strokeCount || 1} label={`${correct} of ${strokeCount} strokes`} /></div>
      <p className="mt-3 min-h-12 text-sm text-muted" role="status">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button primary onClick={start} disabled={busy}>{phase === 'complete' || phase === 'drawing' ? 'Practice again' : 'Start practice'}</Button>
        <Button onClick={() => void watch()} disabled={busy}>Watch strokes</Button>
        <Button disabled={phase !== 'drawing'} onClick={() => { hints.current++; setHintCount(hints.current); void writer.current?.highlightStroke(correct) }}>Hint</Button>
        {phase === 'error' && <Button onClick={() => setRound(r => r + 1)}>Retry loading</Button>}
      </div>
    </Card>
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">One character at a time</p>
        <div className="my-3 flex items-center gap-5">
          <span lang="zh-Hans" className="text-7xl leading-tight">{mode === 'recall' ? '?' : character.hanzi}</span>
          <div><h2 className="display-font text-3xl">{character.pinyin}</h2><p className="mt-1 text-muted">{character.meaning}</p></div>
        </div>
      </div>
      <Tabs tabs={[{key: 'guided', label: 'Guided'}, {key: 'recall', label: 'From memory'}]} active={mode} onChange={key => setMode(key as Mode)} />
      <p className="text-sm text-muted">{mode === 'guided' ? 'Follow the faint outline. A stroke counts when its shape, direction, and order match.' : 'Write without the outline. The reference character is hidden too; hints are counted separately.'}</p>
      <div className="flex gap-6 border-y border-line py-4 text-sm"><span><strong>{mistakes}</strong> retries</span><span><strong>{hintCount}</strong> hints</span></div>
      <label className="block text-sm font-bold" htmlFor="character">Choose a character</label>
      <select id="character" className="min-h-11 w-full rounded-sm border border-line-strong bg-panel p-3" value={character.hanzi} onChange={e => onSelect(CHARACTERS.find(c => c.hanzi === e.target.value)!)}>
        {CHARACTERS.map(c => <option key={c.hanzi} value={c.hanzi}>{mode === 'guided' ? `${c.hanzi} · ` : ''}{c.pinyin} · {c.meaning}</option>)}
      </select>
      <Button className="w-full" onClick={() => onSelect(CHARACTERS[(CHARACTERS.indexOf(character) + 1) % CHARACTERS.length])}>Next character →</Button>
      <p className="text-xs leading-relaxed text-muted">Usually left to right and top to bottom. Watch each character to learn its specific order. Completing a character saves your practice result.</p>
    </div>
  </div>
}
