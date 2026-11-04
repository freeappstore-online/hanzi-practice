import { CHARACTERS } from './characters'
import { PREFERENCES_KEY, DEFAULT_PREFERENCES } from './preferences'
import { STORAGE_KEY, mergeProgress, parseProgress } from './progress'
import { REVIEW_KEY, parseReview, mergeReview } from './review'

export const BACKUP_KEYS = [STORAGE_KEY, REVIEW_KEY, PREFERENCES_KEY] as const
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export function exportPractice(storage: Store) {
  return JSON.stringify({ format: 'hanzi-practice-backup', version: 1,
    progress: parseProgress(storage.getItem(STORAGE_KEY)),
    review: parseReview(storage.getItem(REVIEW_KEY)),
    preferences: JSON.parse(storage.getItem(PREFERENCES_KEY) || 'null') ?? DEFAULT_PREFERENCES,
  }, null, 2)
}
export function importPractice(raw: string, storage: Store) {
  if (raw.length > 2_000_000) throw new Error('This backup is too large.')
  const backup = JSON.parse(raw)
  if (backup?.format !== 'hanzi-practice-backup' || backup.version !== 1 || !Array.isArray(backup.progress)) throw new Error('Choose a Hanzi practice backup.')
  const progress = parseProgress(JSON.stringify(backup.progress))
  if (progress.length !== backup.progress.length) throw new Error('The backup contains invalid practice records.')
  const review = parseReview(JSON.stringify(backup.review))
  if (!backup.review || Object.keys(review).length !== Object.keys(backup.review).length) throw new Error('The backup contains invalid review records.')
  const p = backup.preferences
  if (!p || !CHARACTERS.some(c => c.hanzi === p.character) || typeof p.autoplay !== 'boolean') throw new Error('The backup contains invalid preferences.')
  const previous = BACKUP_KEYS.map(key => [key, storage.getItem(key)] as const)
  const current = parseProgress(storage.getItem(STORAGE_KEY))
  const merged = mergeProgress(progress,current).slice(-2000)
  const values = [JSON.stringify(merged), JSON.stringify(mergeReview(review, parseReview(storage.getItem(REVIEW_KEY)))), JSON.stringify({character:p.character, autoplay:p.autoplay})]
  try { BACKUP_KEYS.forEach((key, i) => storage.setItem(key, values[i])) }
  catch {
    // Restore the original values if a quota failure interrupted the import.
    for (const [key, value] of previous) { try { if (value === null) storage.removeItem(key); else storage.setItem(key, value) } catch { /* Preserve the original storage failure. */ } }
    throw new Error('Device storage could not save the backup. Keep the backup file and try again.')
  }
  return merged.length
}
