import { mkdirSync, copyFileSync } from 'node:fs'
import { CHARACTERS } from '../web/src/characters.ts'
mkdirSync('web/public/characters', { recursive: true })
mkdirSync('web/public/licenses', { recursive: true })
for (const {hanzi} of CHARACTERS) copyFileSync(`node_modules/hanzi-writer-data/${hanzi}.json`, `web/public/characters/${hanzi}.json`)
copyFileSync('node_modules/hanzi-writer-data/ARPHICPL.TXT', 'web/public/licenses/ARPHICPL.txt')
