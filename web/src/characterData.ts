import type { CharacterJson } from 'hanzi-writer'

// Share pending requests and parsed data between preloading and the writing pad.
const characters = new Map<string, Promise<CharacterJson>>()
export function loadCharacterData(character: string): Promise<CharacterJson> {
  const cached = characters.get(character)
  if (cached) return cached
  const request = fetch(`/characters/${encodeURIComponent(character)}.json`)
    .then(response => {
      if (!response.ok) throw new Error('Character data is unavailable')
      return response.json() as Promise<CharacterJson>
    })
    .catch(error => {
      characters.delete(character)
      throw error
    })
  characters.set(character, request)
  return request
}
