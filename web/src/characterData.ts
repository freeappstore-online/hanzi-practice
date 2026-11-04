import type { CharacterJson } from 'hanzi-writer'

// Share pending requests and parsed data between preloading and the writing pad.
const characters = new Map<string, Promise<CharacterJson>>()
function validateData(data: CharacterJson): CharacterJson {
  if (!data || !Array.isArray(data.strokes) || !data.strokes.length ||
      !data.strokes.every(path=>typeof path==='string' && path.length>0) ||
      !Array.isArray(data.medians) || data.medians.length!==data.strokes.length ||
      !data.medians.every(points=>Array.isArray(points) && points.length>=2 && points.every(point=>
        Array.isArray(point) && point.length===2 && point.every(Number.isFinite)))) {
    throw new Error('Invalid character data')
  }
  return data
}
export function loadCharacterData(character: string): Promise<CharacterJson> {
  const cached = characters.get(character)
  if (cached) return cached
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),15000)
  const request = fetch(`/characters/${encodeURIComponent(character)}.json`,{signal:controller.signal})
    .then(response => {
      if (!response.ok) throw new Error('Character data is unavailable')
      return response.json() as Promise<CharacterJson>
    })
    .then(validateData)
    .catch(error => {
      characters.delete(character)
      throw error
    })
    .finally(()=>clearTimeout(timeout))
  characters.set(character, request)
  return request
}
