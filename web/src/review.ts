import { CHARACTERS } from './characters'
import { WORDS } from './words'
import type { Attempt, Progress } from './progress'

export const REVIEW_KEY = 'hanzi-practice:review:v1'
const DAY = 86_400_000
const INTERVALS = [1, 3, 7, 14, 30, 60]
export type ReviewEvent = Attempt & { id: string; completed: boolean }
export type ReviewEntry = ReviewEvent & {
  due: number; stage: number; lastSuccess: number; totalMistakes: number; totalHints: number
}
export type ReviewState = Record<string, ReviewEntry>
const reviewTargets=new Set([...CHARACTERS.map(c=>c.hanzi),...WORDS.map(w=>w.word)])

export function parseReview(raw: string | null): ReviewState {
  if (!raw) return {}
  const data = JSON.parse(raw)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid review data')
  return Object.fromEntries(Object.entries(data).filter(([key, value]) => {
    const e = value as ReviewEntry
    return e && reviewTargets.has(key) && e.character === key &&
      typeof e.id === 'string' && typeof e.completed === 'boolean' && ['guided', 'recall'].includes(e.mode) &&
      typeof e.at === 'string' && Number.isFinite(Date.parse(e.at)) &&
      [e.mistakes, e.hints, e.stage, e.totalMistakes, e.totalHints].every(n => Number.isSafeInteger(n) && n >= 0) &&
      e.stage <= INTERVALS.length && [e.due, e.lastSuccess].every(n => Number.isFinite(n) && n >= 0)
  })) as ReviewState
}

export function recordReview(state: ReviewState, event: ReviewEvent): ReviewState {
  const old = state[event.character]
  const now = Date.parse(event.at)
  if (old && (Date.parse(old.at) > now || (old.id === event.id && old.completed))) return state
  const sameAttempt = old?.id === event.id
  const weak = event.mistakes > 0 || event.hints > 0 || !event.completed
  let stage = old?.stage ?? 0
  let lastSuccess = old?.lastSuccess ?? 0
  let due: number
  if (weak) {
    stage = 0
    due = now + (event.completed ? 10 * 60_000 : 0)
  } else if (event.mode === 'guided') {
    // Seeing the outline is assisted practice. Keeping the old stage here
    // would let a 10-minute recall jump straight to a much longer interval.
    stage = 0
    due = now + 10 * 60_000
  } else {
    // Repeating the same character early cannot inflate its interval.
    if (!old || now >= old.due) {
      stage = Math.min(stage + 1, INTERVALS.length)
      lastSuccess = now
      due = now + INTERVALS[Math.max(0, stage - 1)] * DAY
    } else {
      due = old.due
    }
  }
  return {...state, [event.character]: {
    ...event, stage, due, lastSuccess,
    totalMistakes: (old?.totalMistakes ?? 0) + Math.max(0, event.mistakes - (sameAttempt ? old.mistakes : 0)),
    totalHints: (old?.totalHints ?? 0) + Math.max(0, event.hints - (sameAttempt ? old.hints : 0)),
  }}
}

export function migrateReview(state: ReviewState, progress: Progress): ReviewState {
  return [...progress].sort((a,b) => Date.parse(a.at) - Date.parse(b.at)).reduce((result, attempt) => {
    if (result[attempt.character] && Date.parse(result[attempt.character].at) >= Date.parse(attempt.at)) return result
    return recordReview(result, {...attempt, id: attempt.at + attempt.character, completed: true})
  }, state)
}

export function mergeReview(a: ReviewState, b: ReviewState): ReviewState {
  const next = {...a}
  for (const [key, entry] of Object.entries(b)) {
    if (!next[key] || Date.parse(entry.at) >= Date.parse(next[key].at)) next[key] = entry
  }
  return next
}

export function dueReviews(state: ReviewState, now = Date.now()): ReviewEntry[] {
  return Object.values(state).filter(e => e.due <= now).sort((a,b) =>
    (b.mistakes + b.hints) - (a.mistakes + a.hints) || a.due - b.due || a.character.localeCompare(b.character))
}
