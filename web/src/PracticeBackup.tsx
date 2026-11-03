import { useState } from 'react'
import { Card } from '@freeappstore/sdk/ui'
import { Button } from './Button'
import { exportPractice, importPractice } from './backup'

export function PracticeBackup() {
  const [message, setMessage] = useState('')
  const [imported, setImported] = useState(false)
  const oldAddress = location.hostname === 'hanzi-practice.freeappstore.online'
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportPractice(localStorage)], {type:'application/json'}))
      const link = document.createElement('a'); link.href = url; link.download = 'hanzi-practice-backup.json'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Backup exported. Keep this file to restore your practice.')
    } catch { setMessage('Saved practice could not be read. Your existing data has not been changed.') }
  }
  return <Card>
    <h2 className="mb-2 text-lg font-bold">Keep your practice</h2>
    <p>Our shorter address is <a className="text-accent underline" href="https://hanzi.freeappstore.online">hanzi.freeappstore.online</a>. Browsers keep separate storage for each address.</p>
    <p className="mt-2">{oldAddress ? 'Export your practice here, then open the shorter address and import the file in About.' : <>To move existing practice, <a className="text-accent underline" href="https://hanzi-practice.freeappstore.online/about">export it from the old address</a>, then import that file here.</>}</p>
    <p className="mt-2">The backup contains your practice history, review schedule, and place in the library. Import merges history and restores the saved place. No account information is included.</p>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button onClick={download}>Export practice</Button>
      <label className="block min-w-0">Import practice
        <input className="mt-1 block max-w-full text-sm" type="file" accept="application/json,.json" onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (!file) return
          try {
            if (file.size > 2_000_000) throw new Error('This backup is too large.')
            const count = importPractice(await file.text(), localStorage)
            setImported(true); setMessage(`Imported. ${count} completed practices saved. Reload to use your restored progress.`)
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not import this backup.') }
        }} />
      </label>
      {imported && <Button onClick={() => location.reload()}>Reload practice</Button>}
    </div>
    {message && <p role="status" className="mt-3">{message}</p>}
  </Card>
}
