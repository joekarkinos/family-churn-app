'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { PinInput } from './PinInput'
import { loginWithPin, type FamilyMember } from '@/app/(auth)/actions'
import { Avatar } from '@/components/ui/Avatar'

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
        <LoadingOverlay show={pending} />
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
          <Avatar url={selected.avatar_url} emoji={selected.avatar_emoji} color={selected.color} size={80} alt={selected.name} />
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
            <Avatar url={m.avatar_url} emoji={m.avatar_emoji} color={m.color} size={64} alt={m.name} />
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
