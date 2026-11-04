type Name = 'play' | 'restart' | 'watch' | 'hint' | 'next' | 'autoplay' | 'guide' | 'memory' | 'characters' | 'stroke' | 'back' | 'filters' | 'bookmark' | 'clear'
export function PracticeIcon({name, size = 22}: {name: Name; size?: number}) {
  return <svg aria-hidden="true" className="shrink-0" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'filters' && <><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="var(--panel)"/><circle cx="16" cy="12" r="2" fill="var(--panel)"/><circle cx="10" cy="18" r="2" fill="var(--panel)"/></>}
    {name === 'bookmark' && <path d="M6 3h12v18l-6-4-6 4V3Z"/>}
    {name === 'clear' && <path d="m6 6 12 12M6 18 18 6"/>}
    {name === 'back' && <path d="m10 5-7 7 7 7M3 12h18" />}
    {name === 'play' && <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />}
    {name === 'restart' && <><path d="M4 10a8 8 0 1 1 1.8 7.2M4 4v6h6" /></>}
    {name === 'watch' && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
    {name === 'hint' && <><path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z" /></>}
    {name === 'next' && <><path d="m5 5 10 7-10 7Z" fill="currentColor" stroke="none" /><path d="M19 5v14" /></>}
    {name === 'autoplay' && <><path d="M3 9a9 9 0 0 1 15-4l3 3M21 3v5h-5M21 15a9 9 0 0 1-15 4l-3-3M3 21v-5h5" /><path d="m10 8 6 4-6 4Z" fill="currentColor" stroke="none" /></>}
    {name === 'guide' && <><path d="M9 3H4a1 1 0 0 0-1 1v5M3 15v5a1 1 0 0 0 1 1h5M15 21h5a1 1 0 0 0 1-1v-5" strokeDasharray="2 3" /><path d="m10 14 8-8 3 3-8 8-4 1 1-4Z" /></>}
    {name === 'memory' && <><path d="M12 6a3 3 0 0 0-6 0 4 4 0 0 0-2 7 4 4 0 0 0 2 6 3 3 0 0 0 6 0V6Zm0 0a3 3 0 0 1 6 0 4 4 0 0 1 2 7 4 4 0 0 1-2 6 3 3 0 0 1-6 0M6 6v3M18 6v3M7 14c3 0 5 2 5 5M17 14c-3 0-5 2-5 5" /></>}
    {name === 'characters' && <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 7h8M12 7v10M8 17h8" /></>}
    {name === 'stroke' && <path d="M18 4c-2 7-6 12-12 16" strokeWidth="2.5" />}
  </svg>
}
