import { useCallback, useEffect, useRef, useState } from 'react'
import { initApp } from '@freeappstore/sdk'
import { Badge, Card, EmptyState, PageHeader, SearchInput, Shell, type NavItem } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { CHARACTERS, LEVELS, charactersForLevel, findCharacter, type Character } from './characters'
import { CharacterDetails } from './Pronunciation'
import { readPreferences, savePreferences } from './preferences'
import { Practice } from './Practice'
import { PracticeIcon } from './PracticeIcon'
import { appendAttempt, characterStats, localDay, parseProgress, STORAGE_KEY, type Attempt, type Progress } from './progress'

const fas = initApp({ appId: 'hanzi-practice' })
const NAV: NavItem[] = [
  {label:'Practice', href:'/', title:'Practice — Hanzi Practice'},
  {label:'Characters', href:'/characters', title:'Characters — Hanzi Practice'},
  {label:'Progress', href:'/progress', title:'Progress — Hanzi Practice'},
  {label:'About', href:'/about', title:'About — Hanzi Practice'},
]
export default function App() {
  const [path, setPath] = useState(location.pathname)
  const navigate = (href: string) => {
    history.pushState(null, '', href)
    setPath(href)
    // Keep the shared header in sync when a screen's play button navigates.
    dispatchEvent(new PopStateEvent('popstate'))
  }
  useEffect(() => {
    const sync = () => setPath(location.pathname)
    addEventListener('popstate', sync)
    return () => removeEventListener('popstate', sync)
  }, [])
  return <Shell app={fas} appName="Hanzi" nav={NAV} onNavigate={navigate}>
    <Screens path={path} navigate={navigate} />
  </Shell>
}
function Screens({path, navigate}: {path: string; navigate: (href: string) => void}) {
  const [preferences, setPreferences] = useState(readPreferences)
  const [practiceRequest, setPracticeRequest] = useState(0)
  const character = findCharacter(preferences.character)
  const setCharacter = useCallback((next: Character) => setPreferences(p => ({...p, character: next.hanzi})), [])
  const setAutoplay = useCallback((autoplay: boolean) => setPreferences(p => ({...p, autoplay})), [])
  const [progress, setProgress] = useState<Progress>([])
  const progressRef = useRef<Progress>([])
  const [storageWarning, setStorageWarning] = useState('')
  useEffect(() => {
    if (!savePreferences(preferences)) setStorageWarning('Device storage is unavailable. Your place and settings will not be saved.')
  }, [preferences])
  useEffect(() => {
    try { const saved = parseProgress(localStorage.getItem(STORAGE_KEY)); progressRef.current = saved; setProgress(saved) }
    catch { setStorageWarning('Saved progress could not be read. Practice still works, but this session starts with an empty history.') }
  }, [])
  const complete = useCallback((attempt: Attempt) => {
    // Re-read before appending so another tab's completed practice is retained.
    let current = progressRef.current
    try { current = [...new Map([...parseProgress(localStorage.getItem(STORAGE_KEY)), ...current].map(a => [a.at + a.character, a])).values()] } catch { /* Keep this session in memory. */ }
    const next = appendAttempt(current, attempt)
    progressRef.current = next; setProgress(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageWarning('') }
    catch { setStorageWarning('Device storage is unavailable or full. Progress is kept only until this page closes.') }
  }, [])
  const choose = (c: Character) => { setCharacter(c); setPracticeRequest(n => n + 1); navigate('/') }
  const practiceActive = !['/characters','/progress','/about'].includes(path)
  return <div className="mx-auto w-full max-w-5xl p-4 sm:p-7">
    {storageWarning && <p role="alert" className="mb-4 rounded border border-warning bg-warning-soft p-3 text-sm">{storageWarning}</p>}
    <section hidden={!practiceActive}>
      <div className="sr-only"><PageHeader title="Character practice" /></div>
      <Practice character={character} onSelect={setCharacter} onComplete={complete} active={practiceActive} autoAdvance={preferences.autoplay} onAutoAdvanceChange={setAutoplay} practiceRequest={practiceRequest} />
    </section>
    {path === '/characters' && <Library progress={progress} choose={choose} initialLevel={character.level} />}
    {path === '/progress' && <ProgressScreen progress={progress} choose={choose} />}
    {path === '/about' && <About />}
  </div>
}
function Library({progress, choose, initialLevel}: {progress: Progress; choose: (c: Character) => void; initialLevel: number}) {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('All')
  const [level, setLevel] = useState(String(initialLevel))
  const query = search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const availableGroups = [...new Set(CHARACTERS.filter(c => level === 'all' || c.level === Number(level)).map(c => c.group))]
  const visible = CHARACTERS.filter(c => (level === 'all' || c.level === Number(level)) && (group === 'All' || c.group === group) && `${c.hanzi} ${c.pinyin} ${c.meaning}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(query))
  return <>
    <PageHeader title="Characters" />
    <div className="mb-4 grid grid-cols-2 gap-3">
      <SearchInput className="col-span-2" value={search} onChange={setSearch} placeholder="Search characters" />
      <select aria-label="Library level" value={level} onChange={e => { setLevel(e.target.value); setGroup('All') }} className="min-h-11 min-w-0 rounded-sm border border-line-strong bg-panel px-3">
        <option value="all">All levels</option>{LEVELS.map(l => <option key={l.id} value={l.id}>Level {l.id} · {l.name}</option>)}
      </select>
      <select aria-label="Character group" value={group} onChange={e => setGroup(e.target.value)} className="min-h-11 min-w-0 rounded-sm border border-line-strong bg-panel px-3">
        {['All', ...availableGroups].map(g => <option key={g} value={g}>{g === 'All' ? 'All groups' : g}</option>)}
      </select>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map(c => {
        const stats = characterStats(progress, c.hanzi)
        const practiceLabel = `${stats.total} completed ${stats.total === 1 ? 'practice' : 'practices'}`
        return <div key={c.hanzi} className="min-w-0 rounded border border-line-strong bg-panel p-4">
          <CharacterDetails character={c} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {stats.total > 0 && <span aria-label={practiceLabel} title={`${practiceLabel} · ${stats.recalled} from memory`}><Badge variant="success"><span className="inline-flex items-center gap-1"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>{stats.total}</span></Badge></span>}
            {stats.total === 0 && level === 'all' && <Badge>Level {c.level}</Badge>}
            <Button iconOnly className="ml-auto" onClick={() => choose(c)} aria-label={`Practice ${c.hanzi}, ${c.meaning}`} title={`Practice ${c.hanzi}`}><PracticeIcon name="play" /></Button>
          </div>
        </div>
      })}
    </div>
    {!visible.length && <EmptyState title="No characters found" message="Try another pinyin, meaning, level, or group." />}
  </>
}
function ProgressScreen({progress, choose}: {progress: Progress; choose: (c: Character) => void}) {
  const today = localDay(new Date().toISOString())
  const practiced = CHARACTERS.filter(c => characterStats(progress, c.hanzi).total)
  const recalled = practiced.filter(c => characterStats(progress, c.hanzi).recalled)
  return <>
    <PageHeader title="Progress" />
    <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
      {[['Today',progress.filter(a => localDay(a.at) === today).length],['Characters',practiced.length],['Recalled',recalled.length]].map(([label,count]) => <Card key={label}><p className="display-font text-3xl">{count}</p><p className="mt-1 text-xs text-muted sm:text-sm">{label}</p></Card>)}
    </div>
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      {LEVELS.map(level => {
        const items = charactersForLevel(level.id)
        const done = items.filter(c => characterStats(progress,c.hanzi).total).length
        return <Card key={level.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Level {level.id} · {level.name}</h2><p className="text-sm text-muted">{done} / {items.length} characters practised</p></div><Button onClick={() => choose(items.find(c => !characterStats(progress,c.hanzi).total) ?? items[0])}>Practise level {level.id}</Button></div></Card>
      })}
    </div>
    {!progress.length ? <EmptyState title="No practice yet" message="Completed characters appear here." action={<Button primary onClick={() => choose(CHARACTERS[0])}>Practice 一</Button>} /> : <div className="space-y-3">
      {[...progress].reverse().slice(0,30).map((a,i) => {
        const c = findCharacter(a.character)
        return <Card key={`${a.at}-${i}`}><div className="flex flex-wrap items-center gap-4">
          <span lang="zh-Hans" className="text-4xl">{c.hanzi}</span>
          <div className="min-w-0 flex-1"><p className="font-bold">{c.pinyin} · {c.meaning}</p><p className="text-xs text-muted">{a.mode === 'recall' ? 'From memory' : 'Guided'} · {a.mistakes} retries · {a.hints} hints</p><p className="text-xs text-muted">{new Date(a.at).toLocaleString()}</p></div>
          <Button onClick={() => choose(c)}>Practice</Button>
        </div></Card>
      })}
    </div>}
  </>
}
function About() {
  return <>
    <PageHeader title="About" />
    <div className="max-w-2xl space-y-5 text-sm leading-relaxed">
      <Card><h2 className="mb-2 text-lg font-bold">Watch. Trace. Recall.</h2><p>Watch the strokes before you write. Use Guided mode to follow the outline, then From memory to hide both the outline and the reference glyph. Draw with a finger, stylus, or mouse. The app checks stroke shape, direction, and order; it does not grade calligraphy.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">{CHARACTERS.length} characters across {LEVELS.length} study levels</h2><p>The library uses simplified Chinese where forms differ. Each app study level has 40 characters; these levels are not an official HSK syllabus. Open the app online once and allow it to finish loading; the app, character data, and pronunciation audio are then cached for offline practice.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">Listen and see the tone</h2><p>Tap a character or its pinyin for Mandarin pronunciation. Tap the pitch curve for the tone guide. The pitch curve beside pinyin shows the tone: 1 level, 2 rising, 3 dipping then rising, 4 falling, and 5 neutral. The displayed reading and audio are for the character in isolation; some characters have other readings or change tone in a phrase.</p><p className="mt-2">Audio is generated with the free <a href="https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh" className="text-accent underline">Kokoro Mandarin model</a> and bundled with the app. No speech API, key, or on-device model download is needed.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">Keep writing</h2><p>After a character is complete, practice moves to the next one and starts it automatically. You can turn this off with the autoplay button. At the end of a level it continues into the next level; at the end of the library it stops.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">Your practice stays here</h2><p>No account is needed. Results, your current character and level, and the autoplay setting are saved in this browser on this device. Clearing browser storage removes them; signing in does not sync them. Private browsing may discard them when you close the window.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">Built on open work</h2><p>Stroke animation and checking use <a className="text-accent underline" href="https://hanziwriter.org">Hanzi Writer</a> (MIT). Character paths come from <a className="text-accent underline" href="https://github.com/chanind/hanzi-writer-data">Hanzi Writer Data</a>, derived from Make Me a Hanzi and Arphic fonts, under the <a className="text-accent underline" href="/licenses/ARPHICPL.txt">Arphic Public License</a>. The data license is separate from this app’s MIT source license.</p></Card>
      <p>Part of <a href="https://freeappstore.online" className="text-accent underline">FreeAppStore</a> · <a href="https://github.com/freeappstore-online/hanzi-practice" className="text-accent underline">Source and feedback</a></p>
    </div>
  </>
}
