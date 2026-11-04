import { useEffect, useRef, useState } from 'react'
import HanziWriter from 'hanzi-writer'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { WordDetails } from './WordDetails'
import { loadCharacterData } from './characterData'
import { type PracticeWord } from './words'
import type { Attempt, Mode } from './progress'
import type { ReviewEvent } from './review'

type Tile = {strokes:number;correct:number;mistakes:number;hints:number;done:boolean}
const empty = ():Tile => ({strokes:0,correct:0,mistakes:0,hints:0,done:false})
export function WordPractice({word,next,autoplay,setAutoplay,onComplete,onReviewEvent,onWordComplete,onNext,onBack}: {
  word:PracticeWord; next:PracticeWord|null; autoplay:boolean; setAutoplay:(value:boolean)=>void
  onComplete:(attempt:Attempt)=>void; onReviewEvent:(event:ReviewEvent)=>void; onWordComplete:()=>void
  onNext:()=>void; onBack:()=>void
}) {
  const nodes = useRef<(HTMLDivElement|null)[]>([])
  const writers = useRef<HanziWriter[]>([])
  const ready = useRef(false)
  const generation = useRef(0)
  const attempt = useRef<ReviewEvent|null>(null)
  const [mode,setMode] = useState<Mode>('guided')
  const [round,setRound] = useState(0)
  const [tiles,setTiles] = useState<Tile[]>([empty(),empty()])
  const [current,setCurrent] = useState(0)
  const [phase,setPhase] = useState<'loading'|'ready'|'drawing'|'watching'|'complete'|'error'>('loading')
  const [message,setMessage] = useState('')
  const callbacks = useRef({onComplete,onReviewEvent,onWordComplete})
  callbacks.current = {onComplete,onReviewEvent,onWordComplete}
  const chars = [...word.word]
  const patch = (index:number,change:Partial<Tile>) => setTiles(old=>old.map((tile,i)=>i===index ? {...tile,...change} : tile))
  const begin = (index:number) => {
    if(!ready.current)return
    const token = ++generation.current
    setCurrent(index);setPhase('drawing');setMessage('')
    attempt.current = {id:crypto.randomUUID(),character:chars[index],mode,mistakes:0,hints:0,at:new Date().toISOString(),completed:false}
    void writers.current[index].quiz({
      showHintAfterMisses:false,highlightOnComplete:true,
      onMistake:data=>{
        if(token!==generation.current || !attempt.current)return
        attempt.current={...attempt.current,mistakes:data.totalMistakes,at:new Date().toISOString()}
        patch(index,{mistakes:data.totalMistakes})
        callbacks.current.onReviewEvent(attempt.current)
        setMessage(`Try stroke ${data.strokeNum+1} again.`)
      },
      onCorrectStroke:data=>{if(token===generation.current){patch(index,{correct:data.strokeNum+1});setMessage('')}},
      onComplete:summary=>{
        if(token!==generation.current || !attempt.current)return
        generation.current++
        const completed={...attempt.current,mistakes:summary.totalMistakes,at:new Date().toISOString(),completed:true}
        attempt.current=null
        patch(index,{done:true})
        callbacks.current.onReviewEvent(completed)
        callbacks.current.onComplete({character:completed.character,mode:completed.mode,mistakes:completed.mistakes,hints:completed.hints,at:completed.at})
        if(index===0)begin(1)
        else {setPhase('complete');setMessage('');callbacks.current.onWordComplete()}
      },
    })
  }
  const start = () => {
    if(!ready.current)return
    generation.current++;attempt.current=null
    for(const writer of writers.current) {writer.cancelQuiz();void writer.hideCharacter({duration:0})}
    setTiles(old=>old.map(t=>({...empty(),strokes:t.strokes})))
    begin(0)
  }
  useEffect(()=>{
    let canceled=false
    ready.current=false;generation.current++;attempt.current=null
    setTiles([empty(),empty()]);setCurrent(0);setPhase('loading');setMessage('')
    const colors=()=>{
      const css=getComputedStyle(document.documentElement)
      return {strokeColor:css.getPropertyValue('--ink').trim(),drawingColor:css.getPropertyValue('--accent').trim(),highlightColor:css.getPropertyValue('--accent').trim(),outlineColor:css.getPropertyValue(document.documentElement.dataset.theme==='dark'?'--muted':'--accent-soft').trim()}
    }
    const loaded=[false,false]
    const instances=chars.map((_,index)=>new HanziWriter(nodes.current[index]!,{
      width:nodes.current[index]!.clientWidth || 140,height:nodes.current[index]!.clientWidth || 140,padding:12,
      ...colors(),showCharacter:false,showOutline:mode==='guided',charDataLoader:loadCharacterData,
      strokeAnimationSpeed:.8,delayBetweenStrokes:350,
    }))
    writers.current=instances
    const resize=new ResizeObserver(()=>instances.forEach((writer,i)=>{
      const size=nodes.current[i]?.clientWidth
      if(size)writer.updateDimensions({width:size,height:size,padding:12})
    }))
    nodes.current.forEach(node=>{if(node)resize.observe(node)})
    const theme=new MutationObserver(()=>{
      if(!ready.current)return
      instances.forEach(writer=>Object.entries(colors()).forEach(([key,value])=>void writer.updateColor(key as 'strokeColor',value,{duration:0})))
    })
    theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})
    void Promise.all(instances.map(async(writer,i)=>{
      await writer.setCharacter(chars[i])
      const data=await writer.getCharacterData()
      loaded[i]=true
      return data.strokes.length
    })).then(strokes=>{
      if(canceled)return
      ready.current=true
      setTiles(strokes.map(count=>({...empty(),strokes:count})))
      begin(0)
    }).catch(()=>{if(!canceled){setPhase('error');setMessage('Could not load this word. Reconnect and try again.')}})
    return ()=>{
      canceled=true;ready.current=false;generation.current++;attempt.current=null
      resize.disconnect();theme.disconnect()
      instances.forEach((writer,i)=>{writer.cancelQuiz();if(loaded[i])void writer.pauseAnimation()})
      nodes.current.forEach(node=>node?.replaceChildren())
    }
  },[word.word,mode,round])
  useEffect(()=>{if(next)for(const c of next.word)void loadCharacterData(c).catch(()=>{})},[next])
  useEffect(()=>{
    if(phase!=='complete' || !autoplay || !next)return
    const timer=setTimeout(onNext,250)
    return ()=>clearTimeout(timer)
  },[phase,autoplay,next,onNext])
  const hint = () => {
    if(!attempt.current)return
    attempt.current={...attempt.current,hints:attempt.current.hints+1,at:new Date().toISOString()}
    patch(current,{hints:attempt.current.hints})
    callbacks.current.onReviewEvent(attempt.current)
  }
  const watch = async () => {
    if(!ready.current)return
    hint();attempt.current=null
    const token=++generation.current
    writers.current.forEach(writer=>writer.cancelQuiz())
    setPhase('watching');setMessage('')
    try {
      await writers.current[current].animateCharacter()
      if(token!==generation.current)return
      await writers.current[current].hideCharacter({duration:0})
      if(token===generation.current)setPhase('ready')
    } catch {if(token===generation.current)setPhase('ready')}
  }
  const busy=['loading','watching','error'].includes(phase)
  return <div className="mx-auto max-w-2xl space-y-3">
    <div className="flex items-center justify-between gap-3">
      <Button iconOnly aria-label="Back to words" onClick={onBack}><PracticeIcon name="back" /></Button>
      <Button iconOnly role="switch" aria-label="From memory" aria-checked={mode==='recall'} title="Guided / From memory" onClick={()=>setMode(mode==='guided'?'recall':'guided')}><PracticeIcon name={mode==='guided'?'guide':'memory'} /></Button>
    </div>
    <WordDetails word={word} conceal={mode==='recall'} />
    <div className="grid grid-cols-2 gap-2 sm:gap-4" aria-label="Word writing tiles">
      {chars.map((char,i)=><div key={i} data-testid={`word-tile-${i}`} className={`min-w-0 rounded border-2 p-1 ${current===i && phase==='drawing' ? 'border-accent' : 'border-line-strong'} bg-panel`}>
        <div className="mb-1 flex items-center justify-between px-1 text-xs tabular-nums text-muted"><span aria-label={`Character ${i+1} of 2`}>{i+1}/2</span><span aria-label={`${tiles[i].correct} of ${tiles[i].strokes} strokes`}>{tiles[i].done ? <span className="text-success" aria-label="Completed">✓</span> : `${tiles[i].correct}/${tiles[i].strokes}`}</span></div>
        <div className="relative aspect-square overflow-hidden rounded-sm bg-paper">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-line-strong" viewBox="0 0 100 100"><path d="M50 0V100 M0 50H100 M0 0L100 100 M100 0L0 100" stroke="currentColor" strokeWidth=".4" strokeDasharray="2 2" /></svg>
          <div ref={node=>{nodes.current[i]=node}} role="img" aria-label={`Writing area ${i+1} for ${mode==='recall'?'hidden character':char}`} aria-disabled={current!==i || phase!=='drawing'} className={`relative aspect-square w-full touch-none select-none ${current!==i || phase!=='drawing'?'pointer-events-none':''}`} />
        </div>
      </div>)}
    </div>
    <div role="group" aria-label="Word practice controls" className="flex items-center justify-between gap-1">
      <Button primary iconOnly aria-label="Restart word" title="Restart word" disabled={busy} onClick={start}><PracticeIcon name="restart" /></Button>
      <Button iconOnly aria-label="Watch strokes" title="Watch strokes" disabled={busy} onClick={()=>void watch()}><PracticeIcon name="watch" /></Button>
      <Button iconOnly aria-label="Hint" title="Show next stroke" disabled={phase!=='drawing'} onClick={()=>{hint();void writers.current[current]?.highlightStroke(tiles[current].correct)}}><PracticeIcon name="hint" /></Button>
      <Button iconOnly aria-label="Next word" title="Next word" disabled={!next} onClick={onNext}><PracticeIcon name="next" /></Button>
      <Button iconOnly aria-label="Autoplay" aria-pressed={autoplay} title="Autoplay" className="aria-pressed:border-accent aria-pressed:bg-accent-soft" onClick={()=>setAutoplay(!autoplay)}><PracticeIcon name="autoplay" /></Button>
    </div>
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
    {phase==='error' && <Button onClick={()=>setRound(n=>n+1)}>Retry loading</Button>}
    {tiles.some(t=>t.mistakes || t.hints) && <p className="text-xs text-muted">{tiles.reduce((n,t)=>n+t.mistakes,0)} retries · {tiles.reduce((n,t)=>n+t.hints,0)} hints</p>}
  </div>
}
