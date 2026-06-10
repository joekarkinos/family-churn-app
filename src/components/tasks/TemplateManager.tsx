'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CoinBadge, DifficultyBadge } from '@/components/ui/Badge'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { createTemplate, updateTemplate, deleteTemplate } from '@/app/(parent)/actions'
import type { TaskTemplate, TaskDifficulty } from '@/types'
import type { TemplateInput } from '@/lib/templates'

const DIFFICULTY_OPTIONS: { value: TaskDifficulty; label: string }[] = [
  { value: 'easy', label: 'Łatwe' },
  { value: 'medium', label: 'Średnie' },
  { value: 'hard', label: 'Trudne' },
]

function emptyForm(): TemplateInput {
  return {
    title: '',
    description: '',
    emoji: '📋',
    default_coins: 20,
    default_difficulty: 'medium',
    suggested_checklist: [],
    room: null,
  }
}

function toInput(t: TaskTemplate): TemplateInput {
  return {
    title: t.title,
    description: t.description ?? '',
    emoji: t.emoji,
    default_coins: t.default_coins,
    default_difficulty: t.default_difficulty,
    suggested_checklist: [...t.suggested_checklist],
    room: t.room ?? null,
  }
}

export function TemplateManager({ templates }: { templates: TaskTemplate[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // null = lista; 'new' = formularz dodawania; string id = edycja
  const [editing, setEditing] = useState<null | 'new' | string>(null)
  const [form, setForm] = useState<TemplateInput>(emptyForm())

  function startAdd() {
    setForm(emptyForm())
    setEditing('new')
  }

  function startEdit(t: TaskTemplate) {
    setForm(toInput(t))
    setEditing(t.id)
  }

  function cancel() {
    setEditing(null)
  }

  function handleSave() {
    startTransition(async () => {
      const res =
        editing === 'new'
          ? await createTemplate(form)
          : await updateTemplate(editing as string, form)
      if (res.ok) {
        toast.success(editing === 'new' ? 'Szablon dodany!' : 'Szablon zapisany!')
        setEditing(null)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleDelete(t: TaskTemplate) {
    toast(
      (to) => (
        <span className="flex flex-col gap-2">
          <span>Usunąć szablon „{t.title}"? Istniejące zadania zostaną.</span>
          <span className="flex gap-2">
            <button
              className="rounded bg-red-500 px-3 py-1 text-white"
              onClick={() => {
                toast.dismiss(to.id)
                startTransition(async () => {
                  const res = await deleteTemplate(t.id)
                  if (res.ok) {
                    toast.success('Szablon usunięty')
                    router.refresh()
                  } else {
                    toast.error(res.error)
                  }
                })
              }}
            >
              Usuń
            </button>
            <button className="rounded bg-ink/10 px-3 py-1" onClick={() => toast.dismiss(to.id)}>
              Anuluj
            </button>
          </span>
        </span>
      ),
      { duration: 8000 }
    )
  }

  // ─── Formularz (dodawanie/edycja) ───
  if (editing !== null) {
    return (
      <div className="flex flex-col gap-4">
        <LoadingOverlay show={pending} />
        <button onClick={cancel} className="self-start text-sm text-ink-3">
          ← Wróć do listy
        </button>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-2">Tytuł</span>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-app border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-teal/40"
            placeholder="np. Umyj okna"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex w-24 flex-col gap-1">
            <span className="text-sm text-ink-2">Emoji</span>
            <input
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              className="rounded-app border border-border p-2.5 text-center text-xl focus:outline-none focus:ring-2 focus:ring-teal/40"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-ink-2">Nagroda (monety)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.default_coins}
              onChange={(e) =>
                setForm({ ...form, default_coins: parseInt(e.target.value, 10) || 0 })
              }
              className="rounded-app border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-teal/40"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-2">Opis</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="resize-none rounded-app border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-teal/40"
            placeholder="Krótki opis zadania…"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm text-ink-2">Trudność</span>
          <div className="flex gap-2">
            {DIFFICULTY_OPTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setForm({ ...form, default_difficulty: d.value })}
                className={
                  'flex-1 rounded-app border py-2.5 text-sm font-medium transition-colors ' +
                  (form.default_difficulty === d.value
                    ? 'border-teal bg-teal-bg text-teal-dark'
                    : 'border-border bg-white text-ink-2')
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink-2">Pomieszczenie (opcjonalnie)</span>
          <input
            value={form.room ?? ''}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
            className="rounded-app border border-border p-2.5 focus:outline-none focus:ring-2 focus:ring-teal/40"
            placeholder="np. kuchnia"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-2">Lista kroków</span>
          {form.suggested_checklist.map((step, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={step}
                onChange={(e) => {
                  const next = [...form.suggested_checklist]
                  next[i] = e.target.value
                  setForm({ ...form, suggested_checklist: next })
                }}
                className="flex-1 rounded-app border border-border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
                placeholder={`Krok ${i + 1}`}
              />
              <button
                onClick={() =>
                  setForm({
                    ...form,
                    suggested_checklist: form.suggested_checklist.filter((_, j) => j !== i),
                  })
                }
                className="flex items-center justify-center rounded-app border border-border px-3 text-ink-3"
                aria-label="Usuń krok"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setForm({ ...form, suggested_checklist: [...form.suggested_checklist, ''] })
            }
            className="flex items-center gap-1 self-start text-sm font-medium text-teal"
          >
            <Plus className="h-4 w-4" /> Dodaj krok
          </button>
        </div>

        <Button size="lg" fullWidth onClick={handleSave} disabled={pending}>
          {editing === 'new' ? 'Dodaj szablon' : 'Zapisz zmiany'}
        </Button>
      </div>
    )
  }

  // ─── Lista ───
  return (
    <div className="flex flex-col gap-2">
      <LoadingOverlay show={pending} />
      <Button onClick={startAdd} fullWidth>
        <Plus className="h-4 w-4" /> Dodaj szablon
      </Button>

      {templates.length === 0 && (
        <p className="mt-4 text-center text-sm text-ink-3">Brak szablonów. Dodaj pierwszy.</p>
      )}

      {templates.map((t) => (
        <Card key={t.id} className="flex items-center gap-3">
          <span className="text-3xl">{t.emoji}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display font-semibold text-ink">{t.title}</h3>
            <div className="mt-1 flex gap-2">
              <CoinBadge coins={t.default_coins} />
              <DifficultyBadge difficulty={t.default_difficulty} />
            </div>
          </div>
          <button
            onClick={() => startEdit(t)}
            className="flex h-9 w-9 items-center justify-center rounded-app text-ink-2 hover:bg-black/5"
            aria-label="Edytuj"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(t)}
            className="flex h-9 w-9 items-center justify-center rounded-app text-red-500 hover:bg-red-50"
            aria-label="Usuń"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </Card>
      ))}
    </div>
  )
}
