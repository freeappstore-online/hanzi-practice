import { useCallback, useEffect, useRef, useState } from 'react'
import { STORAGE_KEY, appendAttempt, mergeProgress, parseProgress, type Attempt, type Progress } from './progress'
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
  const [warning,setWarning]=useState('')
  const refs=useRef({progress,reviews,wordCounts})
  const warn=()=>setWarning('Device storage is unavailable or unreadable. Current practice is kept in this tab.')
  useEffect(()=>{
    const read=()=>{
      let history=refs.current.progress,review=refs.current.reviews,counts=refs.current.wordCounts
      try{history=parseProgress(localStorage.getItem(STORAGE_KEY))}catch{warn()}
      try{review=parseReview(localStorage.getItem(REVIEW_KEY))}catch{warn()}
      try{counts=readWordProgress().counts}catch{warn()}
      review=migrateReview(review,history)
      refs.current={progress:history,reviews:review,wordCounts:counts}
      setProgress(history);setReviews(review);setWordCounts(counts)
    }
    read()
    const sync=(event:StorageEvent)=>{if(event.key===null || [STORAGE_KEY,REVIEW_KEY,WORDS_KEY].includes(event.key))read()}
    addEventListener('storage',sync)
    return ()=>removeEventListener('storage',sync)
  },[])
  const complete=useCallback((attempt:Attempt)=>{
    let history=refs.current.progress
    try{history=mergeProgress(parseProgress(localStorage.getItem(STORAGE_KEY)),history)}catch{warn()}
    history=appendAttempt(history,attempt)
    refs.current.progress=history;setProgress(history)
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
  return {progress,reviews,wordCounts,warning,complete,reviewEvent,completeWord}
}
