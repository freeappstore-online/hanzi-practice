type Name = 'play' | 'restart' | 'watch' | 'hint' | 'next' | 'autoplay'
export function PracticeIcon({name}: {name: Name}) {
  return <svg aria-hidden="true" className="shrink-0" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'play' && <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />}
    {name === 'restart' && <><path d="M4 10a8 8 0 1 1 1.8 7.2M4 4v6h6" /></>}
    {name === 'watch' && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
    {name === 'hint' && <><path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z" /></>}
    {name === 'next' && <><path d="m5 5 10 7-10 7Z" fill="currentColor" stroke="none" /><path d="M19 5v14" /></>}
    {name === 'autoplay' && <><path d="M3 9a9 9 0 0 1 15-4l3 3M21 3v5h-5M21 15a9 9 0 0 1-15 4l-3-3M3 21v-5h5" /><path d="m10 8 6 4-6 4Z" fill="currentColor" stroke="none" /></>}
  </svg>
}
