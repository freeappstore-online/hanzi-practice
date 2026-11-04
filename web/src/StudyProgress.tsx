import { Card, PageHeader } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { PracticeIcon } from './PracticeIcon'
import { CATALOG, ITEM_BY_TEXT, type StudyItem, type StudyStats } from './catalog'
import { localDay, type Mode, type Progress } from './progress'
export function StudyProgress({progress,stats,practice,selectStatus}:{progress:Progress;stats:StudyStats;practice:(items:StudyItem[],mode:Mode)=>void;selectStatus:(status:string)=>void}) {
  const today=localDay(new Date().toISOString())
  return <>
    <PageHeader title="Progress"/>
    <div className="mb-4 grid grid-cols-3 gap-2">
      {[['Today',progress.filter(a=>localDay(a.at)===today).length],['Characters',CATALOG.filter(i=>i.kind==='character'&&stats.counts[i.text]).length],['Words',CATALOG.filter(i=>i.kind==='word'&&stats.counts[i.text]).length]].map(([label,count])=><Card key={label}><p className="text-3xl">{count}</p><p className="text-xs text-muted">{label}</p></Card>)}
    </div>
    <div className="mb-4 flex flex-wrap gap-2">{[['due','Review'],['weak','Needs work'],['new','New']].map(([id,label])=><Button key={id} onClick={()=>selectStatus(id)}>{label}</Button>)}</div>
    <div className="space-y-2">{[...progress].reverse().slice(0,30).map((attempt,i)=>{
      const item=ITEM_BY_TEXT.get(attempt.character)!
      return <Card key={`${attempt.at}-${i}`}><div className="flex items-center gap-3"><span className="text-4xl" lang="zh-Hans">{item.text}</span><div className="min-w-0 flex-1"><p className="font-bold">{item.pinyin} · {item.meaning}</p><p className="text-xs text-muted">{attempt.mode==='recall'?'From memory':'Guided'} · {attempt.mistakes} retries · {attempt.hints} hints</p></div><Button iconOnly aria-label={`Practice ${item.text}`} onClick={()=>practice([item],attempt.mode)}><PracticeIcon name="play"/></Button></div></Card>
    })}</div>
  </>
}
