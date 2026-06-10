# Zarządzanie szablonami zadań (rodzic) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pozwolić rodzicom dodawać, edytować i usuwać szablony zadań z poziomu aplikacji, czyniąc tabelę `public.task_templates` jedynym źródłem prawdy.

**Architecture:** Tabela `task_templates` (już istnieje, seedowana migracją 0004) staje się źródłem prawdy zamiast hardcoded `src/lib/templates.ts`. Nowa migracja dodaje polityki RLS dla zapisu (tylko rodzic) i zmienia FK `tasks.template_id` na `on delete set null`. Server actions w `(parent)/actions.ts` obsługują CRUD. Nowy ekran `/szablony` (dostępny z `/dodaj`) renderuje klientowski `TemplateManager`.

**Tech Stack:** Next.js 14 (App Router, Server Components + Server Actions), TypeScript, Supabase (PostgreSQL + RLS), Tailwind, react-hot-toast, lucide-react.

**Uwaga o testach:** Projekt nie ma frameworka testowego (brak plików testowych, w `package.json` tylko `type-check` i `lint`). Zgodnie z istniejącą konwencją bramką weryfikacji każdego zadania jest `npm run type-check` + weryfikacja manualna. Nie dodajemy harnessu testowego (poza zakresem).

---

## File Structure

**Nowe pliki:**
- `supabase/migrations/0005_templates_writable.sql` — RLS write + zmiana FK.
- `src/app/(parent)/szablony/page.tsx` — server component, lista szablonów dla rodzica.
- `src/components/tasks/TemplateManager.tsx` — klient: lista + formularz add/edit + usuwanie.

**Zmieniane pliki:**
- `src/lib/templates.ts` — dodanie typu `TemplateInput` i (zachowanie stałej `TASK_TEMPLATES` tylko jako dane seed nie jest potrzebne — usuwamy ją jako import runtime; patrz Task 2). Helper `getTemplates()`/`getTemplate()` ląduje w `src/lib/templates-db.ts` (nowy, server-only) — patrz niżej.
- `src/app/(parent)/actions.ts` — 3 nowe akcje + walidacja.
- `src/app/(parent)/dodaj/page.tsx` — fetch szablonów z bazy + link „Zarządzaj szablonami".
- `src/components/tasks/CreateTaskPicker.tsx` — przyjmuje `templates` przez props.
- `src/app/(child)/zadania/[id]/page.tsx` — fetch checklisty szablonu z bazy.

**Korekta względem specu:** helper czytający bazę umieszczamy w nowym pliku `src/lib/templates-db.ts` (server-only, używa `createClient`), a NIE w `src/lib/templates.ts` (który był importowany przez komponenty klienckie pośrednio). To utrzymuje rozdział: `templates.ts` = czyste typy/dane, `templates-db.ts` = dostęp do bazy.

---

## Task 1: Migracja — RLS zapisu + FK on delete set null

**Files:**
- Create: `supabase/migrations/0005_templates_writable.sql`

- [ ] **Step 1: Napisz migrację**

Create `supabase/migrations/0005_templates_writable.sql`:

```sql
-- ─────────────────────────────────────────────────────────────────
-- ZadaniaDom — Szablony edytowalne przez rodzica
-- Dodaje polityki RLS (insert/update/delete) tylko dla rodzica oraz
-- zmienia FK tasks.template_id na ON DELETE SET NULL (zachowaj zadania,
-- odłącz szablon).
-- ─────────────────────────────────────────────────────────────────

-- Zapis szablonów: tylko rodzic (select pozostaje z migracji 0002).
create policy "templates insert by parent"
  on public.task_templates for insert
  to authenticated
  with check (public.is_parent());

create policy "templates update by parent"
  on public.task_templates for update
  to authenticated
  using (public.is_parent())
  with check (public.is_parent());

create policy "templates delete by parent"
  on public.task_templates for delete
  to authenticated
  using (public.is_parent());

-- FK: usunięcie szablonu zostawia zadania, zeruje template_id.
-- Nazwa domyślnego constraintu nadawana przez Postgres to
-- tasks_template_id_fkey (table_column_fkey).
alter table public.tasks
  drop constraint tasks_template_id_fkey;

alter table public.tasks
  add constraint tasks_template_id_fkey
  foreign key (template_id) references public.task_templates(id)
  on delete set null;
```

- [ ] **Step 2: Weryfikacja składni (manualna)**

Plik to czysty SQL — nie ma lokalnej bazy do `supabase db push` w tej sesji. Zweryfikuj wzrokowo:
- nazwa constraintu `tasks_template_id_fkey` zgodna z konwencją Postgres (`<table>_<column>_fkey`),
- `public.is_parent()` istnieje (zdefiniowane w `0002_rls_policies.sql`),
- brak `drop policy` — polityki są nowe.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_templates_writable.sql
git commit -m "Migracja: szablony edytowalne przez rodzica (RLS + FK set null)"
```

---

## Task 2: Helper czytający szablony z bazy

**Files:**
- Create: `src/lib/templates-db.ts`
- Modify: `src/lib/templates.ts` (dodaj typ `TemplateInput`)

- [ ] **Step 1: Dodaj typ wejściowy do `templates.ts`**

Na końcu `src/lib/templates.ts` dodaj (zostaw istniejącą stałą `TASK_TEMPLATES` na razie — usuniemy importy w kolejnych zadaniach, a samą stałą w Task 7):

```typescript
// Dane wejściowe formularza szablonu (bez id — id nadaje serwer).
export interface TemplateInput {
  title: string
  description: string
  emoji: string
  default_coins: number
  default_difficulty: import('@/types').TaskDifficulty
  suggested_checklist: string[]
  room: string | null
}
```

- [ ] **Step 2: Utwórz `src/lib/templates-db.ts`**

```typescript
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { TaskTemplate } from '@/types'

// Pobiera wszystkie szablony z bazy (źródło prawdy), sortowane po tytule.
// Błąd → log + pusta lista (UI pokaże brak szablonów zamiast się wywalić).
export async function getTemplates(): Promise<TaskTemplate[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('task_templates')
    .select('id, title, description, emoji, default_coins, default_difficulty, suggested_checklist, room')
    .order('title', { ascending: true })

  if (error) {
    console.error('getTemplates error:', error)
    return []
  }
  return (data ?? []) as TaskTemplate[]
}

// Pojedynczy szablon po id (np. do checklisty na szczególe zadania).
// Brak/usunięty → null.
export async function getTemplate(id: string): Promise<TaskTemplate | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('task_templates')
    .select('id, title, description, emoji, default_coins, default_difficulty, suggested_checklist, room')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as TaskTemplate
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: brak błędów. (`server-only` jest standardowo dostępne w Next 14; jeśli zgłosi brak modułu, usuń linię `import 'server-only'` — to tylko zabezpieczenie.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/templates-db.ts src/lib/templates.ts
git commit -m "Helper getTemplates/getTemplate czytający szablony z bazy"
```

---

## Task 3: Server actions CRUD szablonów

**Files:**
- Modify: `src/app/(parent)/actions.ts`

- [ ] **Step 1: Dodaj akcje na końcu `src/app/(parent)/actions.ts`**

Najpierw dodaj import typu na górze pliku (obok istniejącego importu `DeadlineType`):

```typescript
import type { DeadlineType, TaskDifficulty } from '@/types'
import type { TemplateInput } from '@/lib/templates'
```

(Zastąp istniejącą linię `import type { DeadlineType } from '@/types'` wersją z `TaskDifficulty`.)

Na końcu pliku dodaj:

```typescript
// ─── Szablony zadań (CRUD, tylko rodzic) ───────────────────────────

const DIFFICULTIES: TaskDifficulty[] = ['easy', 'medium', 'hard']

// Walidacja wspólna dla create/update. Zwraca oczyszczone dane lub błąd.
function validateTemplate(
  input: TemplateInput
): { ok: true; value: TemplateInput } | { ok: false; error: string } {
  const title = input.title?.trim() ?? ''
  if (!title) return { ok: false, error: 'Tytuł nie może być pusty' }

  if (!Number.isInteger(input.default_coins) || input.default_coins < 1) {
    return { ok: false, error: 'Nagroda musi być liczbą całkowitą ≥ 1' }
  }

  if (!DIFFICULTIES.includes(input.default_difficulty)) {
    return { ok: false, error: 'Nieprawidłowy poziom trudności' }
  }

  const checklist = (input.suggested_checklist ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const room = input.room?.trim() || null
  const emoji = input.emoji?.trim() || '📋'

  return {
    ok: true,
    value: {
      title,
      description: input.description?.trim() ?? '',
      emoji,
      default_coins: input.default_coins,
      default_difficulty: input.default_difficulty,
      suggested_checklist: checklist,
      room,
    },
  }
}

export async function createTemplate(input: TemplateInput): Promise<ActionResult> {
  const v = validateTemplate(input)
  if (!v.ok) return { ok: false, error: v.error }

  const supabase = await createClient()
  const id = crypto.randomUUID()
  const { error } = await supabase.from('task_templates').insert({
    id,
    title: v.value.title,
    description: v.value.description,
    emoji: v.value.emoji,
    default_coins: v.value.default_coins,
    default_difficulty: v.value.default_difficulty,
    suggested_checklist: v.value.suggested_checklist,
    room: v.value.room,
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/szablony')
  revalidatePath('/dodaj')
  return { ok: true }
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Brak identyfikatora szablonu' }
  const v = validateTemplate(input)
  if (!v.ok) return { ok: false, error: v.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('task_templates')
    .update({
      title: v.value.title,
      description: v.value.description,
      emoji: v.value.emoji,
      default_coins: v.value.default_coins,
      default_difficulty: v.value.default_difficulty,
      suggested_checklist: v.value.suggested_checklist,
      room: v.value.room,
    })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/szablony')
  revalidatePath('/dodaj')
  return { ok: true }
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Brak identyfikatora szablonu' }

  const supabase = await createClient()
  const { error } = await supabase.from('task_templates').delete().eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/szablony')
  revalidatePath('/dodaj')
  return { ok: true }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów. (`crypto.randomUUID()` jest dostępne w Node 20 runtime — projekt używa `@types/node@^20`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/(parent)/actions.ts
git commit -m "Server actions: create/update/delete szablonu (walidacja, tylko rodzic)"
```

---

## Task 4: CreateTaskPicker przyjmuje szablony przez props

**Files:**
- Modify: `src/components/tasks/CreateTaskPicker.tsx`
- Modify: `src/app/(parent)/dodaj/page.tsx`

- [ ] **Step 1: Zmień `CreateTaskPicker` by brał `templates` z props**

W `src/components/tasks/CreateTaskPicker.tsx`:

Usuń import stałej:
```typescript
import { TASK_TEMPLATES } from '@/lib/templates'
```
i zamień na import typu:
```typescript
import type { TaskTemplate } from '@/types'
```

Zmień sygnaturę komponentu z:
```typescript
export function CreateTaskPicker() {
```
na:
```typescript
export function CreateTaskPicker({ templates }: { templates: TaskTemplate[] }) {
```

Zamień wszystkie wystąpienia `TASK_TEMPLATES` w pliku na `templates`. (Jest jedno: `{TASK_TEMPLATES.map((t) => (` → `{templates.map((t) => (`.)

Uwaga na typ `selected`: pozostaje `useState<TaskTemplate | null>(null)` — `TaskTemplate` jest już importowany przez `DeadlineType, TaskTemplate` we wcześniejszym imporcie z `@/types`. Sprawdź istniejącą linię importu z `@/types` i upewnij się, że zawiera `TaskTemplate` (już zawiera: `import type { DeadlineType, TaskTemplate } from '@/types'`).

- [ ] **Step 2: Zaktualizuj `/dodaj` by pobierał szablony i przekazywał + link do zarządzania**

Zastąp całą zawartość `src/app/(parent)/dodaj/page.tsx`:

```tsx
import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { getTemplates } from '@/lib/templates-db'
import { CreateTaskPicker } from '@/components/tasks/CreateTaskPicker'

export const dynamic = 'force-dynamic'

export default async function DodajPage() {
  await requireUser('parent')
  const templates = await getTemplates()

  return (
    <main className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-ink">Dodaj zadanie</h1>
        <Link href="/szablony" className="text-sm font-medium text-teal">
          ⚙️ Zarządzaj szablonami
        </Link>
      </div>
      <CreateTaskPicker templates={templates} />
    </main>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/CreateTaskPicker.tsx "src/app/(parent)/dodaj/page.tsx"
git commit -m "CreateTaskPicker czyta szablony z bazy przez props + link do zarządzania"
```

---

## Task 5: Szczegół zadania czyta checklistę z bazy

**Files:**
- Modify: `src/app/(child)/zadania/[id]/page.tsx`

- [ ] **Step 1: Zamień import stałej na fetch z bazy**

W `src/app/(child)/zadania/[id]/page.tsx`:

Usuń:
```typescript
import { TASK_TEMPLATES } from '@/lib/templates'
```
Dodaj:
```typescript
import { getTemplate } from '@/lib/templates-db'
```

Zamień blok wyszukiwania szablonu:
```typescript
  const template = task.template_id
    ? TASK_TEMPLATES.find((t) => t.id === task.template_id)
    : undefined
```
na:
```typescript
  const template = task.template_id ? await getTemplate(task.template_id) : null
```

Reszta pliku (render `template.suggested_checklist`) działa bez zmian, bo `getTemplate` zwraca ten sam kształt `TaskTemplate`.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(child)/zadania/[id]/page.tsx"
git commit -m "Szczegół zadania: checklista szablonu z bazy zamiast stałej"
```

---

## Task 6: Ekran zarządzania szablonami (UI)

**Files:**
- Create: `src/components/tasks/TemplateManager.tsx`
- Create: `src/app/(parent)/szablony/page.tsx`

- [ ] **Step 1: Utwórz `TemplateManager.tsx`**

Create `src/components/tasks/TemplateManager.tsx`:

```tsx
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
```

- [ ] **Step 2: Utwórz route `/szablony`**

Create `src/app/(parent)/szablony/page.tsx`:

```tsx
import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { getTemplates } from '@/lib/templates-db'
import { TemplateManager } from '@/components/tasks/TemplateManager'

export const dynamic = 'force-dynamic'

export default async function SzablonyPage() {
  await requireUser('parent')
  const templates = await getTemplates()

  return (
    <main className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-ink">Szablony zadań</h1>
        <Link href="/dodaj" className="text-sm font-medium text-teal">
          ← Dodaj zadanie
        </Link>
      </div>
      <TemplateManager templates={templates} />
    </main>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: brak błędów. Jeśli `CoinBadge`/`DifficultyBadge` mają inną sygnaturę niż użyta — sprawdź `src/components/ui/Badge.tsx` i dopasuj propsy (w `ReviewCard`/`CreateTaskPicker` używane jako `<CoinBadge coins={...} />` i `<DifficultyBadge difficulty={...} />`, więc powinno pasować).

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/TemplateManager.tsx "src/app/(parent)/szablony/page.tsx"
git commit -m "Ekran zarządzania szablonami: lista + formularz add/edit + usuwanie"
```

---

## Task 7: Sprzątanie — usuń nieużywaną stałą `TASK_TEMPLATES`

**Files:**
- Modify: `src/lib/templates.ts`

- [ ] **Step 1: Potwierdź brak importów stałej**

Run: `grep -rn "TASK_TEMPLATES" src/`
Expected: brak wyników (wszystkie przeniesione na `getTemplates`/`getTemplate` w Tasks 4–5).

Jeśli są wyniki — napraw je, zanim usuniesz stałą.

- [ ] **Step 2: Usuń stałą, zostaw typ `TemplateInput`**

W `src/lib/templates.ts` usuń całą tablicę `export const TASK_TEMPLATES: TaskTemplate[] = [ ... ]` oraz teraz-nieużywany import `import type { TaskTemplate } from '@/types'` (jeśli `TaskTemplate` nie jest już używany w pliku). Zostaw `export interface TemplateInput` (dodany w Task 2).

Plik po zmianie zawiera wyłącznie `TemplateInput` (i jego import `TaskDifficulty`, który jest inline `import('@/types')`). Wynikowa zawartość:

```typescript
// Dane wejściowe formularza szablonu (bez id — id nadaje serwer).
export interface TemplateInput {
  title: string
  description: string
  emoji: string
  default_coins: number
  default_difficulty: import('@/types').TaskDifficulty
  suggested_checklist: string[]
  room: string | null
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run type-check`
Expected: brak błędów.

Run: `npm run lint`
Expected: brak błędów (lub tylko istniejące wcześniej ostrzeżenia).

- [ ] **Step 4: Commit**

```bash
git add src/lib/templates.ts
git commit -m "Usuń nieużywaną stałą TASK_TEMPLATES (źródłem prawdy jest baza)"
```

---

## Task 8: Aktualizacja seed-migracji (spójność źródła prawdy)

**Files:**
- Modify: `supabase/migrations/0004_seed_templates.sql` (bez zmian treści — tylko weryfikacja)

- [ ] **Step 1: Weryfikacja**

Migracja `0004_seed_templates.sql` nadal jest poprawnym seedem początkowym (10 szablonów z `on conflict do update`). Pozostaje bez zmian — to dane startowe, a rodzic może je potem edytować/usuwać przez UI. Potwierdź wzrokowo, że plik istnieje i jest idempotentny (`on conflict (id) do update`).

Brak zmian w kodzie → brak commita w tym zadaniu.

---

## Weryfikacja końcowa (manualna)

Po wszystkich zadaniach uruchom aplikację (`npm run dev`) jako rodzic i sprawdź:

- [ ] `/dodaj` pokazuje link „⚙️ Zarządzaj szablonami" i listę szablonów z bazy.
- [ ] `/szablony`: dodanie nowego szablonu → pojawia się na liście i w `/dodaj`.
- [ ] Edycja szablonu (np. zmiana nagrody/kroków) → zapisana po odświeżeniu.
- [ ] Utworzenie zadania z szablonu, potem usunięcie tego szablonu → zadanie nadal istnieje na `/panel` (FK set null), a jego szczegół nie pokazuje już checklisty.
- [ ] Dziecko nie ma dostępu do `/szablony` (guard `requireUser('parent')` przekierowuje na `/zadania`).
- [ ] `npm run type-check` i `npm run lint` przechodzą.
```
