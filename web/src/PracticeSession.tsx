import { useEffect, useRef, useState } from 'react'
import HanziWriter from 'hanzi-writer'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { WordDetails } from './WordDetails'
import { CharacterDetails } from './Pronunciation'
import { loadCharacterData } from './characterData'
import type { StudyItem } from './catalog'
import type { Attempt, Mode } from './progress'
import type { ReviewEvent } from './review'
import type { PracticeResult } from './practice-history'

type Tile={strokes:number;correct:number;mistakes:number;hints:number;done:boolean}
const empty=():Tile=>({strokes:0,correct:0,mistakes:0,hints:0,done:false})
type Phase='loading'|'drawing'|'watching'|'complete'|'error'
export function PracticeSession({item,queue,index,mode,completed,autoplay,onMode,onAutoplay,onCharacterComplete,onReviewEvent,onCompleted,onRestart,onJump,onNext,onBack,doneCount,onRemaining,finishedIds}: {
  item:StudyItem;queue:StudyItem[];index:number;mode:Mode;completed:boolean;autoplay:boolean
  onMode:(mode:Mode)=>void;onAutoplay:(value:boolean)=>void;onCharacterComplete:(a:Attempt)=>void
  onReviewEvent:(event:ReviewEvent)=>void;onCompleted:(result:PracticeResult)=>void;doneCount:number;finishedIds:string[];onRemaining:()=>void;onRestart:()=>void;onJump:(index:number)=>void;onNext:()=>void;onBack:()=>void
}) {
  const chars=[...item.text],padding=chars.length===1?24:12
  const nodes=useRef<(HTMLDivElement|null)[]>([]),writers=useRef<HanziWriter[]>([])
  const ready=useRef(false),generation=useRef(0),attempt=useRef<ReviewEvent|null>(null),runId=useRef('')
  const [round,setRound]=useState(0),[tiles,setTiles]=useState<Tile[]>(()=>chars.map(empty)),[current,setCurrent]=useState(0)
  const tileState=useRef<Tile[]>(chars.map(empty))
  const [phase,setPhase]=useState<Phase>('loading'),[message,setMessage]=useState('')
  const callbacks=useRef({onCharacterComplete,onReviewEvent,onCompleted})
  callbacks.current={onCharacterComplete,onReviewEvent,onCompleted}
  const patch=(i:number,change:Partial<Tile>)=>{tileState.current=tileState.current.map((t,j)=>i===j?{...t,...change}:t);setTiles(tileState.current)}
  const aggregate=(complete:boolean)=>{
    if(item.kind!=='word')return
    callbacks.current.onReviewEvent({id:runId.current,character:item.text,mode,at:new Date().toISOString(),completed:complete,mistakes:tileState.current.reduce((n,t)=>n+t.mistakes,0),hints:tileState.current.reduce((n,t)=>n+t.hints,0)})
  }
  const begin=(i:number,resume=false)=>{
    if(!ready.current)return
    const token=++generation.current
    const previous=resume?attempt.current:null
    const offset=previous?.mistakes??0
    attempt.current=previous??{id:crypto.randomUUID(),character:chars[i],mode,mistakes:0,hints:0,at:new Date().toISOString(),completed:false}
    setCurrent(i);setPhase('drawing');setMessage('');patch(i,{correct:0})
    void writers.current[i].quiz({showHintAfterMisses:false,highlightOnComplete:true,
      onMistake:data=>{
        if(token!==generation.current || !attempt.current)return
        attempt.current={...attempt.current,mistakes:offset+data.totalMistakes,at:new Date().toISOString()}
        patch(i,{mistakes:attempt.current.mistakes});callbacks.current.onReviewEvent(attempt.current);aggregate(false)
        setMessage(`Try stroke ${data.strokeNum+1} again.`)
      },
      onCorrectStroke:data=>{if(token===generation.current){patch(i,{correct:data.strokeNum+1});setMessage('')}},
      onComplete:data=>{
        if(token!==generation.current || !attempt.current)return
        generation.current++
        const done={...attempt.current,mistakes:offset+data.totalMistakes,completed:true,at:new Date().toISOString()}
        attempt.current=null;patch(i,{done:true,mistakes:done.mistakes})
        callbacks.current.onReviewEvent(done)
        callbacks.current.onCharacterComplete({character:done.character,mode:done.mode,mistakes:done.mistakes,hints:done.hints,at:done.at})
        if(i+1<chars.length)begin(i+1)
        else{setPhase('complete');setMessage('');aggregate(true);callbacks.current.onCompleted({mode,mistakes:tileState.current.reduce((n,t)=>n+t.mistakes,0),hints:tileState.current.reduce((n,t)=>n+t.hints,0),at:new Date().toISOString()})}
      },
    })
  }
  useEffect(()=>{
    let canceled=false
    ready.current=false;generation.current++;attempt.current=null;runId.current=crypto.randomUUID()
    tileState.current=chars.map(empty);setTiles(tileState.current);setCurrent(0);setPhase('loading');setMessage('')
    const targetNodes=nodes.current.slice(0,chars.length)
    const colors=()=>{
      const css=getComputedStyle(document.documentElement)
      return {strokeColor:css.getPropertyValue('--ink').trim(),drawingColor:css.getPropertyValue('--accent').trim(),highlightColor:css.getPropertyValue('--accent').trim(),outlineColor:css.getPropertyValue(document.documentElement.dataset.theme==='dark'?'--muted':'--accent-soft').trim()}
    }
    const instances=chars.map((_,i)=>new HanziWriter(targetNodes[i]!,{
      width:targetNodes[i]!.clientWidth||140,height:targetNodes[i]!.clientWidth||140,padding,...colors(),
      showCharacter:false,showOutline:mode==='guided',charDataLoader:loadCharacterData,strokeAnimationSpeed:.8,delayBetweenStrokes:350,
    }))
    writers.current=instances
    const resize=new ResizeObserver(()=>instances.forEach((writer,i)=>{const size=targetNodes[i]?.clientWidth;if(size)writer.updateDimensions({width:size,height:size,padding})}))
    targetNodes.forEach(node=>{if(node)resize.observe(node)})
    const theme=new MutationObserver(()=>{if(ready.current)instances.forEach(writer=>Object.entries(colors()).forEach(([key,value])=>void writer.updateColor(key as 'strokeColor',value,{duration:0})))})
    theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})
    void Promise.all(instances.map(async(writer,i)=>{await writer.setCharacter(chars[i]);if(canceled)return 0;const data=await writer.getCharacterData();return data.strokes.length})).then(strokes=>{
      if(canceled)return
      ready.current=true;tileState.current=strokes.map(n=>({...empty(),strokes:n,correct:completed?n:0,done:completed}));setTiles(tileState.current)
      if(completed){instances.forEach(w=>void w.showCharacter({duration:0}));setPhase('complete')}
      else begin(0)
    }).catch(()=>{if(!canceled){setPhase('error');setMessage('Could not load this exercise. Reconnect and try again.')}})
    return ()=>{
      canceled=true;ready.current=false;generation.current++;attempt.current=null;resize.disconnect();theme.disconnect()
      instances.forEach(writer=>writer.destroy())
      targetNodes.forEach(node=>node?.replaceChildren())
    }
    // Completion only changes the saved checkpoint; it must not recreate a finished quiz.
  },[item.id,mode,round])
  const next=queue.find((entry,i)=>i>index&&!finishedIds.includes(entry.id))
  useEffect(()=>{if(next)for(const c of next.text)void loadCharacterData(c).catch(()=>{})},[next])
  useEffect(()=>{
    if(phase!=='complete'||!autoplay||!next)return
    const timer=setTimeout(onNext,250);return ()=>clearTimeout(timer)
  },[phase,autoplay,next,onNext])
  const hint=()=>{
    if(!attempt.current)return
    attempt.current={...attempt.current,hints:attempt.current.hints+1,at:new Date().toISOString()}
    patch(current,{hints:attempt.current.hints});callbacks.current.onReviewEvent(attempt.current);aggregate(false)
  }
  const watch=async()=>{
    if(!ready.current || phase!=='drawing')return
    hint();const token=++generation.current
    const writer=writers.current[current];writer.cancelQuiz();setPhase('watching');setMessage('')
    try{await writer.animateCharacter();if(token!==generation.current)return;await writer.hideCharacter({duration:0});if(token===generation.current)begin(current,true)}
    catch{if(token===generation.current)begin(current,true)}
  }
  const busy=['loading','watching','error'].includes(phase)
  const restart=()=>{onRestart();setRound(n=>n+1)}
  return <div className="mx-auto max-w-2xl space-y-3">
    <div className="flex items-center gap-2">
      <Button iconOnly aria-label="Back to filters" title="Back to filters" onClick={onBack}><PracticeIcon name="back" /></Button>
      <select aria-label="Practice item" value={item.id} onChange={e=>onJump(queue.findIndex(entry=>entry.id===e.target.value))} className="min-h-11 min-w-0 flex-1 rounded-sm border border-line-strong bg-panel px-2 text-sm">
        {queue.map((entry,i)=><option key={entry.id} value={entry.id}>{i+1}/{queue.length} · {mode==='recall'?entry.pinyin:`${entry.text} · ${entry.pinyin}`}</option>)}
      </select>
      <Button iconOnly role="switch" aria-label="From memory" aria-checked={mode==='recall'} title="Guided / From memory" onClick={()=>onMode(mode==='guided'?'recall':'guided')}><PracticeIcon name={mode==='guided'?'guide':'memory'} /></Button>
    </div>
    {item.character?<CharacterDetails character={item.character} concealCharacter={mode==='recall'} onExampleOpen={hint} />:<WordDetails word={item.word!} conceal={mode==='recall'} />}
    <div className={`grid gap-2 sm:gap-4 ${chars.length===2?'grid-cols-2':'mx-auto max-w-[min(360px,calc(100svh-100px))] grid-cols-1'}`} aria-label="Writing tiles">
      {chars.map((char,i)=>{const tile=tiles[i]??empty();return <div key={i} data-testid={`writing-tile-${i}`} className={`min-w-0 rounded border-2 p-1 ${current===i&&phase==='drawing'?'border-accent':'border-line-strong'} bg-panel`}>
        <div className="mb-1 flex justify-between px-1 text-xs tabular-nums text-muted"><span>{i+1}/{chars.length}</span><span aria-label={`${tile.correct} of ${tile.strokes} strokes`}>{tile.done?<span className="text-success" aria-label="Completed">✓</span>:`${tile.correct}/${tile.strokes}`}</span></div>
        <div className="relative aspect-square overflow-hidden rounded-sm bg-paper">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-line-strong" viewBox="0 0 100 100"><path d="M50 0V100 M0 50H100 M0 0L100 100 M100 0L0 100" stroke="currentColor" strokeWidth=".4" strokeDasharray="2 2" /></svg>
          <div ref={node=>{nodes.current[i]=node}} role="img" aria-label={`Writing area ${i+1} for ${mode==='recall'?'hidden character':char}`} aria-disabled={current!==i||phase!=='drawing'} className={`relative aspect-square w-full touch-none select-none ${current!==i||phase!=='drawing'?'pointer-events-none':''}`} />
        </div>
      </div>})}
    </div>
    <div role="group" aria-label="Practice controls" className="flex justify-between gap-1">
      <Button primary iconOnly aria-label="Restart exercise" title="Restart exercise" disabled={busy} onClick={restart}><PracticeIcon name="restart" /></Button>
      <Button iconOnly aria-label="Watch strokes" title="Watch strokes" disabled={phase!=='drawing'} onClick={()=>void watch()}><PracticeIcon name="watch" /></Button>
      <Button iconOnly aria-label="Hint" title="Show next stroke" disabled={phase!=='drawing'} onClick={()=>{hint();void writers.current[current]?.highlightStroke(tiles[current].correct)}}><PracticeIcon name="hint" /></Button>
      <Button iconOnly aria-label="Next item" title="Next item" disabled={!next} onClick={onNext}><PracticeIcon name="next" /></Button>
      <Button iconOnly aria-label="Autoplay" aria-pressed={autoplay} title="Autoplay" className="aria-pressed:border-accent aria-pressed:bg-accent-soft" onClick={()=>onAutoplay(!autoplay)}><PracticeIcon name="autoplay" /></Button>
    </div>
    <p role="status" className="text-sm text-muted">{message || (phase==='complete'&&!next?(doneCount===queue.length?'Practice complete.':`${doneCount}/${queue.length} completed.`):'')}</p>
    {!next&&doneCount<queue.length&&phase==='complete'&&<Button onClick={onRemaining}>Continue unfinished</Button>}
    {phase==='error'&&<Button onClick={()=>setRound(n=>n+1)}>Retry loading</Button>}
    {tiles.some(t=>t.mistakes||t.hints)&&<p className="text-xs text-muted">{tiles.reduce((n,t)=>n+t.mistakes,0)} retries · {tiles.reduce((n,t)=>n+t.hints,0)} hints</p>}
  </div>
}
