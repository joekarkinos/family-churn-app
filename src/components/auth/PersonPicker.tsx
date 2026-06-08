'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PinInput } from './PinInput'
import { loginWithPin, type FamilyMember } from '@/app/(auth)/actions'

export function PersonPicker({ members }: { members: FamilyMember[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<FamilyMember | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reset, setReset] = useState(0)
  const [pending, startTransition] = useTransition()

  function handlePin(pin: string) {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const res = await loginWithPin(selected.id, pin)
      if (res.ok) {
        router.replace(res.role === 'parent' ? '/panel' : '/zadania')
      } else {
        setError(res.error)
        setReset((r) => r + 1)
      }
    })
  }

  if (selected) {
    return (
      <div className="flex flex-col items-center gap-6">
        <button
          onClick={() => {
            setSelected(null)
            setError(null)
          }}
          className="self-start text-ink-3 text-sm"
        >
          ← Zmień osobę
        </button>

        <div className="flex flex-col items-center gap-2">
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
            style={{ backgroundColor: (selected.color ?? '#00897b') + '22' }}
          >
            {selected.avatar_emoji}
          </span>
          <h2 className="font-display text-2xl font-bold text-ink">{selected.name}</h2>
          <p className="text-ink-3 text-sm">Wpisz swój PIN</p>
        </div>

        <PinInput onComplete={handlePin} disabled={pending} error={!!error} resetSignal={reset} />

        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold text-ink text-center">Kto to?</h1>
      <div className="grid grid-cols-2 gap-3">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-app bg-white border border-border',
              'p-5 shadow-card transition-transform active:scale-95'
            )}
            style={{ borderTopColor: m.color ?? '#00897b', borderTopWidth: 3 }}
          >
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{ backgroundColor: (m.color ?? '#00897b') + '22' }}
            >
              {m.avatar_emoji}
            </span>
            <span className="font-display font-semibold text-ink">{m.name}</span>
            <span className="text-xs text-ink-3">
              {m.role === 'parent' ? 'Rodzic' : 'Dziecko'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
