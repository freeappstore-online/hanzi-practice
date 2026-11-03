import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readPreferences, savePreferences, DEFAULT_PREFERENCES} from '../web/src/preferences.ts'
test('preferences validate saved data and tolerate blocked storage',t=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{bad',setItem:()=>{throw Error('blocked')}}})
  t.after(()=>{if(previous) Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage})
  assert.deepEqual(readPreferences(),DEFAULT_PREFERENCES)
  assert.equal(savePreferences({character:'字',autoplay:false}),false)
})
