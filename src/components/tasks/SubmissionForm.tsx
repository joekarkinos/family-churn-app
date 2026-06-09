'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { submitTask } from '@/app/(child)/actions'

// Formularz zgłoszenia wykonania zadania (opcjonalna notatka).
// Upload zdjęć do Storage można dodać później — na razie notatka tekstowa.
export function SubmissionForm({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitTask(taskId, note)
      if (res.ok) {
        toast.success('Zgłoszone! Rodzic sprawdzi i przyzna monety.')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Zgłoś wykonanie
      </Button>
    )
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-app border border-border bg-white p-3">
      <LoadingOverlay show={pending} />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notatka dla rodzica (opcjonalnie)…"
        rows={2}
        className="w-full resize-none rounded-app-sm border border-border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={pending}>
          Wyślij zgłoszenie
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Anuluj
        </Button>
      </div>
    </div>
  )
}
