import type { ButtonHTMLAttributes } from 'react'
export function Button({ primary, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {primary?: boolean}) {
  return <button {...props} className={`min-h-11 rounded-sm border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${primary ? 'border-accent bg-accent text-paper hover:bg-accent-hover' : 'border-line-strong bg-panel text-ink hover:bg-paper-deep'} ${className}`} />
}
