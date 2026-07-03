'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import {
  requestDutySwap,
  acceptDutySwap,
  cancelDutySwap,
  type DutyActionResult,
} from '@/app/(child)/duty-actions'
import type { DutyBannerState } from '@/types'

export function DutyBanner({ state, today }: { state: DutyBannerState; today: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(fn: () => Promise<DutyActionResult>) {
    startTransition(async () => {
      const res = await fn()
      if (res.ok) {
        if (res.message) toast.success(res.message)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  if (state.kind === 'none') return null

  const base = 'mb-4 rounded-2xl p-4 shadow-sm'

  if (state.kind === 'info') {
    return (
      <div className={`${base} bg-surface`}>
        <p className="text-sm text-ink-3">Dziś dyżur pełni</p>
        <p className="font-display text-lg font-bold text-ink">
          {state.childEmoji} {state.childName}
        </p>
      </div>
    )
  }

  if (state.kind === 'on_duty') {
    return (
      <div className={`${base} bg-teal/10 border border-teal/30`}>
        <LoadingOverlay show={pending} />
        <p className="font-display text-lg font-bold text-ink">🧹 Dziś Twój dyżur!</p>
        <p className="mb-3 text-sm text-ink-3">Nie dasz rady? Poproś siostry o zastępstwo.</p>
        <button
          onClick={() => run(() => requestDutySwap(today))}
          disabled={pending}
          className="rounded-full bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Nie mogę dziś — poproś siostry
        </button>
      </div>
    )
  }

  if (state.kind === 'awaiting') {
    return (
      <div className={`${base} bg-surface border border-border`}>
        <LoadingOverlay show={pending} />
        <p className="font-display text-lg font-bold text-ink">⏳ Czekam na zastępstwo…</p>
        <p className="mb-3 text-sm text-ink-3">Poprosiłaś siostry o przejęcie dzisiejszego dyżuru.</p>
        <button
          onClick={() => run(() => cancelDutySwap(state.requestId))}
          disabled={pending}
          className="text-sm font-medium text-teal underline disabled:opacity-60"
        >
          Anuluj prośbę
        </button>
      </div>
    )
  }

  // kind === 'invited'
  return (
    <div className={`${base} bg-teal/10 border border-teal/30`}>
      <LoadingOverlay show={pending} />
      <p className="font-display text-lg font-bold text-ink">🙋 {state.requesterName} prosi o zastępstwo</p>
      <p className="mb-3 text-sm text-ink-3">Jeśli się zgodzisz, weźmiesz dziś dyżur, a ona odda Ci swój najbliższy.</p>
      <button
        onClick={() => run(() => acceptDutySwap(state.requestId))}
        disabled={pending}
        className="rounded-full bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Zgadzam się
      </button>
    </div>
  )
}
