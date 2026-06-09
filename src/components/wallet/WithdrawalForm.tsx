'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { requestWithdrawal } from '@/app/(child)/actions'

// Prośba o wypłatę (reguła #5: min 1 moneta, nie więcej niż saldo).
export function WithdrawalForm({ balance }: { balance: number }) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    const coins = parseInt(amount, 10)
    if (!Number.isInteger(coins) || coins < 1) {
      toast.error('Minimalna wypłata to 1 moneta')
      return
    }
    if (coins > balance) {
      toast.error('Nie masz tylu monet')
      return
    }
    startTransition(async () => {
      const res = await requestWithdrawal(coins)
      if (res.ok) {
        toast.success('Prośba wysłana! Rodzic zrobi przelew.')
        setAmount('')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="flex items-end gap-2">
      <LoadingOverlay show={pending} />
      <label className="flex-1">
        <span className="mb-1 block text-sm text-ink-2">Ile monet wypłacić?</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={balance}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="np. 50"
          className="w-full rounded-app border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-teal/40"
        />
      </label>
      <Button onClick={handleSubmit} disabled={pending || balance < 1}>
        Poproś o wypłatę
      </Button>
    </div>
  )
}
