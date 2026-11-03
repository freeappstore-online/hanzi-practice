export const TONES = {
  1: {number: 1, contour: '→', label: 'high and level'},
  2: {number: 2, contour: '↗', label: 'rising'},
  3: {number: 3, contour: '↘↗', label: 'dip then rise'},
  4: {number: 4, contour: '↘', label: 'falling'},
  5: {number: 5, contour: '·', label: 'neutral'},
} as const
export function toneFor(pinyin: string) {
  const marks: Record<string, keyof typeof TONES> = {'\u0304':1, '\u0301':2, '\u030c':3, '\u0300':4}
  const mark = [...pinyin.normalize('NFD')].find(c => marks[c])
  return TONES[mark ? marks[mark] : 5]
}
