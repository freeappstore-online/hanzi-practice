import { CHARACTERS } from './characters'
export type Mode = 'guided' | 'recall'
export type Attempt = { character: string; mode: Mode; mistakes: number; hints: number; at: string }
export type Progress = Attempt[]
export const STORAGE_KEY = 'hanzi-practice:progress:v1'
export function parseProgress(raw: string | null): Progress {
  if (!raw) return []
  const data: unknown = JSON.parse(raw)
  if (!Array.isArray(data)) throw new Error('Invalid saved progress')
  return data.filter((a): a is Attempt => !!a && typeof a === 'object' &&
    CHARACTERS.some(c => c.hanzi === a.character) && ['guided','recall'].includes(a.mode) &&
    Number.isSafeInteger(a.mistakes) && a.mistakes >= 0 && Number.isSafeInteger(a.hints) && a.hints >= 0 &&
    typeof a.at === 'string' && Number.isFinite(Date.parse(a.at)))
}
export function appendAttempt(progress: Progress, attempt: Attempt): Progress {
  return [...progress, attempt].slice(-2000)
}
export function mergeProgress(a: Progress, b: Progress): Progress {
  return [...new Map([...a,...b].map(attempt=>[attempt.at+attempt.character,attempt])).values()]
    .sort((left,right)=>Date.parse(left.at)-Date.parse(right.at))
}
export function localDay(iso: string) { return new Date(iso).toLocaleDateString('en-CA') }
export function characterStats(progress: Progress, hanzi: string) {
  const attempts = progress.filter(a => a.character === hanzi)
  return { total: attempts.length, recalled: attempts.filter(a => a.mode === 'recall' && a.mistakes === 0 && a.hints === 0).length }
}
