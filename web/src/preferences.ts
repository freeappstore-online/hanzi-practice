import { CHARACTERS } from './characters'
export const PREFERENCES_KEY = 'hanzi-practice:preferences:v1'
export type Preferences = { character: string; autoplay: boolean }
export const DEFAULT_PREFERENCES: Preferences = { character: CHARACTERS[0].hanzi, autoplay: true }
export function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || 'null')
    return {
      character: CHARACTERS.some(c => c.hanzi === saved?.character) ? saved.character : DEFAULT_PREFERENCES.character,
      autoplay: typeof saved?.autoplay === 'boolean' ? saved.autoplay : true,
    }
  } catch { return { ...DEFAULT_PREFERENCES } }
}
export function savePreferences(preferences: Preferences) {
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); return true }
  catch { return false }
}
