import { useCallback, useEffect, useRef, useState } from 'react'
import { initApp } from '@freeappstore/sdk'
import { Badge, Card, EmptyState, PageHeader, SearchInput, Shell, useToast, type NavItem } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { CHARACTERS, LEVELS, GROUPS, charactersForLevel, findCharacter, type Character } from './characters'
import { Pronunciation, ToneMarker } from './Pronunciation'
import { Practice } from './Practice'
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
  const navigate = (href: string) => { history.pushState(null, '', href); setPath(href) }
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
  const toast = useToast()
  const [character, setCharacter] = useState(CHARACTERS[0])
  const [progress, setProgress] = useState<Progress>([])
  const progressRef = useRef<Progress>([])
  const [storageWarning, setStorageWarning] = useState('')
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageWarning(''); toast.show('Practice saved on this device.', {variant:'success'}) }
    catch { setStorageWarning('Device storage is unavailable or full. Progress is kept only until this page closes.'); toast.show('Completed! Progress could not be saved.', {variant:'error'}) }
  }, [toast])
  const choose = (c: Character) => { setCharacter(c); navigate('/') }
  const practiceActive = !['/characters','/progress','/about'].includes(path)
  return <div className="mx-auto w-full max-w-5xl p-4 sm:p-7">
    {storageWarning && <p role="alert" className="mb-4 rounded border border-warning bg-warning-soft p-3 text-sm">{storageWarning}</p>}
    <section hidden={!practiceActive}>
      <PageHeader title="A little practice. A lasting skill." description="Learn Chinese characters, one stroke at a time." />
      <Practice character={character} onSelect={setCharacter} onComplete={complete} active={practiceActive} />
    </section>
    {path === '/characters' && <Library progress={progress} choose={choose} />}
    {path === '/progress' && <ProgressScreen progress={progress} choose={choose} />}
    {path === '/about' && <About />}
  </div>
}
function Library({progress, choose}: {progress: Progress; choose: (c: Character) => void}) {
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('All')
  const [level, setLevel] = useState('1')
  const query = search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const visible = CHARACTERS.filter(c => (level === 'all' || c.level === Number(level)) && (group === 'All' || c.group === group) && `${c.hanzi} ${c.pinyin} ${c.meaning}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(query))
  return <>
    <PageHeader title="200 characters, five study levels" description="Build from foundations to expressing ideas. These are app study levels, not an official HSK syllabus." />
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      <SearchInput value={search} onChange={setSearch} placeholder="Search characters, pinyin, or meaning" />
      <select aria-label="Library level" value={level} onChange={e => { setLevel(e.target.value); setGroup('All') }} className="min-h-11 min-w-0 rounded-sm border border-line-strong bg-panel px-3">
        <option value="all">All levels</option>{LEVELS.map(l => <option key={l.id} value={l.id}>Level {l.id} · {l.name}</option>)}
      </select>
      <select aria-label="Character group" value={group} onChange={e => setGroup(e.target.value)} className="min-h-11 rounded-sm border border-line-strong bg-panel px-3">
        {['All', ...GROUPS].map(g => <option key={g}>{g}</option>)}
      </select>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {visible.map(c => {
        const stats = characterStats(progress, c.hanzi)
        return <div key={c.hanzi} className="rounded border border-line-strong bg-panel"><button onClick={() => choose(c)} aria-label={`Practice ${c.hanzi}, ${c.meaning}`} className="w-full rounded p-4 text-left hover:bg-paper-deep">
          <span lang="zh-Hans" className="mb-3 block text-5xl leading-tight">{c.hanzi}</span>
          <span className="mb-2 flex flex-wrap items-center gap-2"><span className="text-lg font-bold">{c.pinyin}</span><ToneMarker pinyin={c.pinyin} /></span><span className="mb-3 block text-sm text-muted">{c.meaning}</span>
          <Badge variant={stats.recalled ? 'success' : stats.total ? 'accent' : 'default'}>{stats.recalled ? 'Recalled unaided' : stats.total ? `${stats.total} practices` : `Level ${c.level}`}</Badge>
        </button><div className="px-4 pb-4"><Pronunciation character={c} /></div></div>
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
    <PageHeader title="Small steps add up" description="Completed practice on this device. The most recent 2,000 results are kept." />
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
    <p className="mb-6 text-sm text-muted">“Recalled” means completed in From memory mode with zero retries and no hints. It is a practice milestone, not a fluency score.</p>
    {!progress.length ? <EmptyState title="Your first stroke starts here" message="Finish a character to begin your practice history." action={<Button primary onClick={() => choose(CHARACTERS[0])}>Practice 一</Button>} /> : <div className="space-y-3">
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
    <PageHeader title="Make room for a little practice" description="A free, focused introduction to writing Chinese characters." />
    <div className="max-w-2xl space-y-5 text-sm leading-relaxed">
      <Card><h2 className="mb-2 text-lg font-bold">Watch. Trace. Recall.</h2><p>Watch the strokes before you write. Use Guided mode to follow the outline, then From memory to hide both the outline and the reference glyph. Draw with a finger, stylus, or mouse. The app checks stroke shape, direction, and order; it does not grade calligraphy.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">200 characters across five study levels</h2><p>The library uses simplified Chinese where forms differ. Each app study level has 40 characters; these levels are not an official HSK syllabus. Open the app online once and allow it to finish loading; the app, character data, and pronunciation audio are then cached for offline practice.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">Listen and see the tone</h2><p>Tap Listen for Mandarin pronunciation. The large number and arrow beside pinyin show the tone: 1 level, 2 rising, 3 dipping then rising, 4 falling, and 5 neutral. The displayed reading and audio are for the character in isolation; some characters have other readings or change tone in a phrase.</p><p className="mt-2">Audio is generated with the free <a href="https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh" className="text-accent underline">Kokoro Mandarin model</a> and bundled with the app. No speech API, key, or on-device model download is needed.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">Keep writing</h2><p>After a character is complete, practice moves to the next one and starts it automatically. You can turn this off with the automatic practice checkbox. At the end of a level it continues into the next level; at the end of the library it stops.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">Your practice stays here</h2><p>No account is needed. Results are saved in this browser on this device. Clearing browser storage removes them; signing in does not sync them. Private browsing may discard them when you close the window.</p></Card>
      <Card><h2 className="mb-2 text-lg font-bold">Built on open work</h2><p>Stroke animation and checking use <a className="text-accent underline" href="https://hanziwriter.org">Hanzi Writer</a> (MIT). Character paths come from <a className="text-accent underline" href="https://github.com/chanind/hanzi-writer-data">Hanzi Writer Data</a>, derived from Make Me a Hanzi and Arphic fonts, under the <a className="text-accent underline" href="/licenses/ARPHICPL.txt">Arphic Public License</a>. The data license is separate from this app’s MIT source license.</p></Card>
      <p>Part of <a href="https://freeappstore.online" className="text-accent underline">FreeAppStore</a> · <a href="https://github.com/freeappstore-online/hanzi-practice" className="text-accent underline">Source and feedback</a></p>
    </div>
  </>
}
