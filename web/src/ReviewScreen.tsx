import { useEffect, useState } from 'react'
import { Badge, EmptyState, PageHeader } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { findCharacter, type Character } from './characters'
import { dueReviews, type ReviewState } from './review'

export function ReviewScreen({state, start}: {state: ReviewState; start: (characters: Character[]) => void}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer) }, [])
  const due = dueReviews(state, now)
  const upcoming = Object.values(state).filter(e => e.due > now).sort((a,b) => a.due - b.due)
  return <>
    <div className="mb-4 flex items-center justify-between gap-3">
      <PageHeader title="Review" />
      {due.length > 0 && <div className="flex items-center gap-3"><Badge>{due.length}</Badge><Button primary iconOnly aria-label={`Start review of ${due.length} characters`} title="Start review" onClick={() => start(due.map(e => findCharacter(e.character)))}><PracticeIcon name="play" /></Button></div>}
    </div>
    {!due.length && <EmptyState title={upcoming.length ? 'All caught up' : 'No reviews yet'} message={upcoming.length ? `Next review: ${new Date(upcoming[0].due).toLocaleString()}` : 'Practise a character to add it here.'} />}
    <div className="space-y-2">
      {due.map(entry => {
        const c = findCharacter(entry.character)
        return <div key={c.hanzi} className="flex items-center gap-3 rounded border border-line-strong bg-panel p-3">
          <span lang="zh-Hans" className="shrink-0 text-4xl">{c.hanzi}</span>
          <div className="min-w-0 flex-1"><p className="break-words font-bold">{c.pinyin} · {c.meaning}</p><p className="text-xs text-muted">{entry.mistakes || entry.hints ? `${entry.mistakes} retries · ${entry.hints} hints` : 'Ready to recall'}{!entry.completed && ' · unfinished'}</p></div>
          <Button iconOnly aria-label={`Review ${c.hanzi}`} title={`Review ${c.hanzi}`} onClick={() => start([c])}><PracticeIcon name="play" /></Button>
        </div>
      })}
    </div>
    {upcoming.length > 0 && due.length > 0 && <p className="mt-4 text-sm text-muted">{upcoming.length} scheduled for later</p>}
  </>
}
