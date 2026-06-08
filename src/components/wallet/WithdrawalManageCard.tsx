'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'
import { markWithdrawalPaid } from '@/app/(parent)/actions'

export interface PendingWithdrawal {
  id: string
  amount_coins: number
  amount_pln: number
  requested_at: string
  childName: string
  childEmoji: string
}

export function WithdrawalManageCard({ withdrawal }: { withdrawal: PendingWithdrawal }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handlePaid() {
    startTransition(async () => {
      const res = await markWithdrawalPaid(withdrawal.id)
      if (res.ok) {
        toast.success(`Oznaczono jako zapłacone (${withdrawal.amount_pln} PLN)`)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <p className="font-medium text-ink">
          {withdrawal.childEmoji} {withdrawal.childName}
        </p>
        <p className="font-display text-lg font-bold text-ink">
          {withdrawal.amount_coins} 🪙 = {withdrawal.amount_pln} PLN
        </p>
        <p className="text-xs text-ink-3">{formatDate(withdrawal.requested_at)}</p>
      </div>
      <Button onClick={handlePaid} disabled={pending}>
        Zapłacono
      </Button>
    </Card>
  )
}
