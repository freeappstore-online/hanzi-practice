export const TONES = {
  1: {number: 1, path: 'M6 11 H34', label: 'high and level'},
  2: {number: 2, path: 'M6 32 C16 29 24 16 34 6', label: 'rising'},
  3: {number: 3, path: 'M5 12 C11 35 19 40 24 27 S30 10 35 5', label: 'dip then rise'},
  4: {number: 4, path: 'M6 6 C15 13 25 26 34 34', label: 'falling'},
  5: {number: 5, path: '', label: 'neutral'},
} as const
export function toneFor(pinyin: string) {
  const marks: Record<string, keyof typeof TONES> = {'\u0304':1, '\u0301':2, '\u030c':3, '\u0300':4}
  const mark = [...pinyin.normalize('NFD')].find(c => marks[c])
  return TONES[mark ? marks[mark] : 5]
}
