'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DifficultyBadge, CoinBadge } from '@/components/ui/Badge'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { createTaskFromTemplate } from '@/app/(parent)/actions'
import { TASK_TEMPLATES } from '@/lib/templates'
import type { DeadlineType, TaskTemplate } from '@/types'

export function CreateTaskPicker() {
  const router = useRouter()
  const [selected, setSelected] = useState<TaskTemplate | null>(null)
  const [deadline, setDeadline] = useState<DeadlineType>('end_of_day')
  const [pending, startTransition] = useTransition()

  function create(force: boolean) {
    if (!selected) return
    startTransition(async () => {
      const res = await createTaskFromTemplate(selected.id, deadline, force)
      if (res.ok) {
        toast.success('Zadanie dodane!')
        router.push('/panel')
        return
      }
      if (res.duplicate) {
        // Reguła #9: ostrzeżenie o duplikacie, pytanie "czy na pewno?".
        toast(
          (t) => (
            <span className="flex flex-col gap-2">
              <span>Takie zadanie jest już otwarte. Dodać mimo to?</span>
              <span className="flex gap-2">
                <button
                  className="rounded bg-teal px-3 py-1 text-white"
                  onClick={() => {
                    toast.dismiss(t.id)
                    create(true)
                  }}
                >
                  Tak, dodaj
                </button>
                <button className="rounded bg-ink/10 px-3 py-1" onClick={() => toast.dismiss(t.id)}>
                  Anuluj
                </button>
              </span>
            </span>
          ),
          { duration: 8000 }
        )
        return
      }
      toast.error(res.error)
    })
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <LoadingOverlay show={pending} />
        <button onClick={() => setSelected(null)} className="self-start text-sm text-ink-3">
          ← Wybierz inne
        </button>

        <Card className="flex items-center gap-3">
          <span className="text-4xl">{selected.emoji}</span>
          <div>
            <h2 className="font-display font-semibold text-ink">{selected.title}</h2>
            <div className="mt-1 flex gap-2">
              <CoinBadge coins={selected.default_coins} />
              <DifficultyBadge difficulty={selected.default_difficulty} />
            </div>
          </div>
        </Card>

        <div>
          <p className="mb-2 text-sm text-ink-2">Termin</p>
          <div className="flex gap-2">
            <DeadlineOption active={deadline === 'end_of_day'} onClick={() => setDeadline('end_of_day')}>
              Dziś (do 23:59)
            </DeadlineOption>
            <DeadlineOption active={deadline === 'week'} onClick={() => setDeadline('week')}>
              Tydzień
            </DeadlineOption>
          </div>
        </div>

        <Button size="lg" fullWidth onClick={() => create(false)} disabled={pending}>
          Dodaj zadanie
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {TASK_TEMPLATES.map((t) => (
        <Card key={t.id} interactive onClick={() => setSelected(t)} className="flex items-center gap-3">
          <span className="text-3xl">{t.emoji}</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-ink truncate">{t.title}</h3>
            <div className="mt-1 flex gap-2">
              <CoinBadge coins={t.default_coins} />
              <DifficultyBadge difficulty={t.default_difficulty} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function DeadlineOption({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex-1 rounded-app border py-3 text-sm font-medium transition-colors ' +
        (active ? 'border-teal bg-teal-bg text-teal-dark' : 'border-border bg-white text-ink-2')
      }
    >
      {children}
    </button>
  )
}
