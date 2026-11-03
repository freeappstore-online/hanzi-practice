import words from './word-audio.json'
import type { WordExample } from './examples'

export const audioPath = (hanzi: string) => `/audio/v2/${hanzi.codePointAt(0)!.toString(16)}.mp3`
const recordings: Record<string, {pinyin: string; file: string}> = words
export function exampleAudioPath(example: WordExample | undefined) {
  if (!example) return undefined
  const recording = recordings[example.word]
  return recording?.pinyin === example.pinyin ? `/audio/v2/${recording.file}` : undefined
}
