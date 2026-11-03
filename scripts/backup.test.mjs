import test from 'node:test'
import assert from 'node:assert/strict'
import { exportPractice, importPractice, BACKUP_KEYS } from '../web/src/backup.ts'
import { STORAGE_KEY } from '../web/src/progress.ts'
import { PREFERENCES_KEY } from '../web/src/preferences.ts'
const attempt = (character, at) => ({character, at, mode:'guided', mistakes:0, hints:0})
function store(initial = {}) {
 const values = new Map(Object.entries(initial))
 return {getItem:k=>values.get(k) ?? null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k)}
}
test('backup merges, deduplicates, orders history and restores preferences without account data', () => {
 const a=attempt('一','2026-11-01T00:00:00Z'), b=attempt('二','2026-11-02T00:00:00Z')
 const old=store({[STORAGE_KEY]:JSON.stringify([a]), [PREFERENCES_KEY]:JSON.stringify({character:'二',autoplay:false}), 'secret-token':'private'})
 const raw=exportPractice(old)
 assert.ok(!raw.includes('private'))
 const current=store({[STORAGE_KEY]:JSON.stringify([a,b])})
 assert.equal(importPractice(raw,current),2)
 assert.deepEqual(JSON.parse(current.getItem(STORAGE_KEY)),[a,b])
 assert.equal(JSON.parse(current.getItem(PREFERENCES_KEY)).character,'二')
 assert.equal(importPractice(raw,current),2)
})
test('malformed backup never changes saved history', () => {
 const current=store({[STORAGE_KEY]:'[]'})
 assert.throws(()=>importPractice('{"format":"other"}',current))
 const bad=JSON.parse(exportPractice(store()))
 bad.progress=[{character:'invalid'}]
 assert.throws(()=>importPractice(JSON.stringify(bad),current))
 assert.equal(current.getItem(STORAGE_KEY),'[]')
})
test('quota failure restores original keys', () => {
 const current=store({[STORAGE_KEY]:'[]', [PREFERENCES_KEY]:JSON.stringify({character:'一',autoplay:true})})
 const before=BACKUP_KEYS.map(k=>current.getItem(k)); const set=current.setItem; let calls=0
 current.setItem=(k,v)=>{if(++calls===2) throw new Error('QuotaExceeded');return set(k,v)}
 assert.throws(()=>importPractice(exportPractice(store()),current),/could not save/)
 assert.deepEqual(BACKUP_KEYS.map(k=>current.getItem(k)),before)
})
