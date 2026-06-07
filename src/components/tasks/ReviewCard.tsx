'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CoinBadge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'
import { approveSubmission, rejectSubmission } from '@/app/(parent)/actions'

export interface PendingReview {
  id: string
  note: string | null
  photo_url: string | null
  submitted_at: string
  childName: string
  childEmoji: string
  taskTitle: string
  taskEmoji: string
  coinsReward: number
}

export function ReviewCard({ review }: { review: PendingReview }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [bonus, setBonus] = useState('')

  function handleApprove() {
    const bonusCoins = parseInt(bonus, 10) || 0
    startTransition(async () => {
      const res = await approveSubmission(review.id, bonusCoins)
      if (res.ok) {
        toast.success(`Zatwierdzono! +${review.coinsReward + bonusCoins} 🪙 dla ${review.childName}`)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleReject() {
    startTransition(async () => {
      const res = await rejectSubmission(review.id)
      if (res.ok) {
        toast('Odrzucono — zadanie wróciło do wykonania.')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{review.taskEmoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-semibold text-ink truncate">{review.taskTitle}</h3>
            <CoinBadge coins={review.coinsReward} />
          </div>
          <p className="text-sm text-ink-3">
            {review.childEmoji} {review.childName} · {formatDate(review.submitted_at)}
          </p>
        </div>
      </div>

      {review.note && (
        <p className="rounded-app-sm bg-surface p-2 text-sm text-ink-2">„{review.note}”</p>
      )}

      <label className="flex items-center gap-2 text-sm text-ink-2">
        Bonus 🪙:
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={bonus}
          onChange={(e) => setBonus(e.target.value)}
          placeholder="0"
          className="w-20 rounded-app-sm border border-border p-1.5 focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </label>

      <div className="flex gap-2">
        <Button fullWidth onClick={handleApprove} disabled={pending}>
          Zatwierdź
        </Button>
        <Button variant="danger" onClick={handleReject} disabled={pending}>
          Odrzuć
        </Button>
      </div>
    </Card>
  )
}
