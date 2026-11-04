import { useCallback, useEffect, useRef, useState } from 'react'
import { CHARACTER_TOTALS_KEY, STORAGE_KEY, appendAttempt, mergeCharacterTotals, mergeProgress, parseCharacterTotals, parseProgress, totalsFromProgress, type Attempt, type CharacterTotals, type Progress } from './progress'
import { REVIEW_KEY, mergeReview, migrateReview, parseReview, recordReview, type ReviewEvent, type ReviewState } from './review'
import { WORDS_KEY, parseWordProgress } from './words'

function readWordProgress() {
  const raw=localStorage.getItem(WORDS_KEY)
  // Keep in-memory counts and warn if storage is unreadable, as for character history.
  if(raw)JSON.parse(raw)
  return parseWordProgress(raw)
}

export function useStudyProgress() {
  const [progress,setProgress]=useState<Progress>([])
  const [reviews,setReviews]=useState<ReviewState>({})
  const [wordCounts,setWordCounts]=useState<Record<string,number>>({})
  const [characterTotals,setCharacterTotals]=useState<CharacterTotals>({})
  const [warning,setWarning]=useState('')
  const refs=useRef({progress,reviews,wordCounts,characterTotals})
  const warn=()=>setWarning('Device storage is unavailable or unreadable. Current practice is kept in this tab.')
  useEffect(()=>{
    const read=()=>{
      let history=refs.current.progress,review=refs.current.reviews,counts=refs.current.wordCounts,totals=refs.current.characterTotals
      try{history=parseProgress(localStorage.getItem(STORAGE_KEY))}catch{warn()}
      try{review=parseReview(localStorage.getItem(REVIEW_KEY))}catch{warn()}
      try{counts=readWordProgress().counts}catch{warn()}
      try{totals=parseCharacterTotals(localStorage.getItem(CHARACTER_TOTALS_KEY))}catch{warn()}
      totals=mergeCharacterTotals(totals,totalsFromProgress(history))
      try{
        const serialized=JSON.stringify(totals)
        if(Object.keys(totals).length && localStorage.getItem(CHARACTER_TOTALS_KEY)!==serialized)localStorage.setItem(CHARACTER_TOTALS_KEY,serialized)
      }catch{warn()}
      review=migrateReview(review,history)
      refs.current={progress:history,reviews:review,wordCounts:counts,characterTotals:totals}
      setProgress(history);setReviews(review);setWordCounts(counts);setCharacterTotals(totals)
    }
    read()
    const sync=(event:StorageEvent)=>{if(event.key===null || [STORAGE_KEY,REVIEW_KEY,WORDS_KEY,CHARACTER_TOTALS_KEY].includes(event.key))read()}
    addEventListener('storage',sync)
    return ()=>removeEventListener('storage',sync)
  },[])
  const complete=useCallback((attempt:Attempt)=>{
    let history=refs.current.progress
    try{history=mergeProgress(parseProgress(localStorage.getItem(STORAGE_KEY)),history)}catch{warn()}
    let totals=refs.current.characterTotals
    try{totals=mergeCharacterTotals(totals,parseCharacterTotals(localStorage.getItem(CHARACTER_TOTALS_KEY)))}catch{warn()}
    totals=mergeCharacterTotals(totals,totalsFromProgress(history))
    const previous=totals[attempt.character]??{total:0,recalled:0}
    totals={...totals,[attempt.character]:{
      total:Math.min(Number.MAX_SAFE_INTEGER,previous.total+1),
      recalled:Math.min(Number.MAX_SAFE_INTEGER,previous.recalled+Number(attempt.mode==='recall'&&!attempt.mistakes&&!attempt.hints)),
    }}
    history=appendAttempt(history,attempt)
    refs.current.progress=history;setProgress(history);refs.current.characterTotals=totals;setCharacterTotals(totals)
    try{localStorage.setItem(CHARACTER_TOTALS_KEY,JSON.stringify(totals))}catch{warn()}
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(history))}catch{warn()}
  },[])
  const reviewEvent=useCallback((event:ReviewEvent)=>{
    let state=refs.current.reviews
    try{state=mergeReview(state,parseReview(localStorage.getItem(REVIEW_KEY)))}catch{warn()}
    state=recordReview(state,event)
    refs.current.reviews=state;setReviews(state)
    try{localStorage.setItem(REVIEW_KEY,JSON.stringify(state))}catch{warn()}
  },[])
  const completeWord=useCallback((word:string)=>{
    let previous=parseWordProgress(null)
    try{previous=readWordProgress()}catch{warn()}
    // Merge each counter, so a stale tab cannot erase another word's completion.
    const counts={...previous.counts}
    for(const [key,count] of Object.entries(refs.current.wordCounts))counts[key]=Math.max(counts[key]??0,count)
    counts[word]=(counts[word]??0)+1
    refs.current.wordCounts=counts;setWordCounts(counts)
    try{localStorage.setItem(WORDS_KEY,JSON.stringify({...previous,counts}))}catch{warn()}
  },[])
  return {progress,reviews,wordCounts,characterTotals,warning,complete,reviewEvent,completeWord}
}
