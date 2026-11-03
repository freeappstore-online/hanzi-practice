import data from './examples.json'
export type WordExample = {word: string; pinyin: string; meaning: string; image?: string}
export const EXAMPLES: Record<string, WordExample> = data
export const SCENES: Record<string, string> = {
  meal: 'A family eating rice and vegetables and drinking tea at a table.',
  school: 'A teacher and students with books, pencils and notebooks in a classroom.',
  park: 'A person walking a dog beside trees, flowers and a lake, with a bird overhead.',
}
