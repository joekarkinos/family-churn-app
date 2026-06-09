'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { claimTask, commentTask } from '@/app/(child)/actions'
import type { CommentReason, TaskStatus } from '@/types'

const REASONS: { value: CommentReason; label: string }[] = [
  { value: 'too_little_coins', label: 'Za mało monet' },
  { value: 'too_hard', label: 'Za trudne' },
  { value: 'unclear', label: 'Niejasne' },
  { value: 'no_time', label: 'Brak czasu' },
  { value: 'other', label: 'Inny powód' },
]

export function TaskActions({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showComment, setShowComment] = useState(false)

  if (status !== 'open') {
    return (
      <p className="rounded-app bg-ink/5 p-3 text-center text-sm text-ink-3">
        To zadanie nie jest już dostępne do przyjęcia.
      </p>
    )
  }

  function handleClaim() {
    startTransition(async () => {
      const res = await claimTask(taskId)
      if (res.ok) {
        toast.success('Zadanie przyjęte! 💪')
        router.push('/moje-zadania')
      } else {
        toast.error(res.error)
        router.refresh()
      }
    })
  }

  function handleComment(reason: CommentReason) {
    startTransition(async () => {
      const res = await commentTask(taskId, reason)
      if (res.ok) {
        toast.success('Dzięki! Rodzic dostanie info.')
        setShowComment(false)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <LoadingOverlay show={pending} />
      <Button size="lg" fullWidth onClick={handleClaim} disabled={pending}>
        Przyjmij zadanie
      </Button>

      {!showComment ? (
        <Button variant="ghost" onClick={() => setShowComment(true)} disabled={pending}>
          Nie wezmę tego — dlaczego?
        </Button>
      ) : (
        <div className="rounded-app border border-border bg-white p-3">
          <p className="mb-2 text-sm text-ink-2">Dlaczego nie bierzesz?</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <Button
                key={r.value}
                variant="secondary"
                size="sm"
                onClick={() => handleComment(r.value)}
                disabled={pending}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
