# Wygasłe zadania — ukrycie dla dzieci, reaktywacja dla rodziców — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zadania z minionym terminem znikają natychmiast z listy dziecka (nie czekają na cron), a rodzic widzi je na swojej liście `/zadania` z odznaką „Wygasłe" i przyciskiem „Reaktywuj", który przywraca zadanie do puli z nowym terminem tego samego typu.

**Architecture:** Ekran dziecka (`src/app/(child)/zadania/page.tsx`) dodaje warunek `expires_at > now()` do zapytania, żeby nie zależeć od crona Edge Function `expire-tasks`. Ekran rodzica (`src/app/(parent)/zadania/page.tsx`) rozszerza zapytanie na `status IN ('open', 'expired')`. Nowa akcja serwerowa `reactivateTask` w `src/app/(parent)/actions.ts` liczy nowy `expires_at` istniejącym helperem `computeExpiry()` i przywraca zadanie do `status: 'open'`. Nowy klientowy komponent `ReactivateButton` (analogiczny do `LogoutButton`/`TaskActions`) wywołuje tę akcję i jest renderowany warunkowo przez `TaskCard`.

**Tech Stack:** Next.js 14 (App Router, Server Components + Server Actions), TypeScript, Supabase (PostgreSQL + RLS), Tailwind, react-hot-toast.

**Uwaga o testach:** Projekt nie ma frameworka testowego (brak plików testowych, w `package.json` tylko `type-check` i `lint`). Zgodnie z istniejącą konwencją bramką weryfikacji każdego zadania jest `npm run type-check` (+ `npm run lint` w ostatnim zadaniu) oraz manualna weryfikacja w `npm run dev`. Nie dodajemy harnessu testowego (poza zakresem).

## Global Constraints

- Język UI: wyłącznie polski (reguła projektu — CLAUDE.md).
- `1 zadanie = 1 wykonawca` — reaktywacja musi czyścić `claimed_by`/`claimed_at`, inaczej zadanie wróci do puli "otwartych", ale nadal przypisane do dziecka, co złamie tę regułę.
- Nie zmieniamy Edge Function `expire-tasks` ani nie dodajemy migracji SQL — istniejąca polityka RLS `"tasks update by parent"` (`supabase/migrations/0002_rls_policies.sql:75-79`) już pozwala rodzicowi na update każdego wiersza `tasks`.
- Nowy termin po reaktywacji liczony jest tym samym helperem `computeExpiry()` co przy tworzeniu zadania (`src/app/(parent)/actions.ts:14-25`) — brak duplikacji logiki dat.

---

## File Structure

**Nowe pliki:**
- `src/components/tasks/ReactivateButton.tsx` — klientowski przycisk „Reaktywuj", wywołuje `reactivateTask`.

**Zmieniane pliki:**
- `src/app/(parent)/actions.ts` — nowa akcja `reactivateTask`.
- `src/components/tasks/TaskCard.tsx` — nowy prop `canReactivate`, renderuje `ReactivateButton` dla wygasłych zadań.
- `src/app/(parent)/zadania/page.tsx` — zapytanie obejmuje `status IN ('open', 'expired')`, nagłówek i licznik zaktualizowane, `TaskCard` dostaje `canReactivate`.
- `src/app/(child)/zadania/page.tsx` — zapytanie dodaje `expires_at > now()`, żeby wygasłe zadania znikały bez czekania na cron.

---

## Task 1: Akcja serwerowa `reactivateTask`

**Files:**
- Modify: `src/app/(parent)/actions.ts`

**Interfaces:**
- Consumes: istniejący `computeExpiry(deadline: DeadlineType): string` (`src/app/(parent)/actions.ts:14-25`, ta sama funkcja, brak zmian), istniejący typ `ActionResult` (`src/app/(parent)/actions.ts:9`).
- Produces: `export async function reactivateTask(taskId: string): Promise<ActionResult>` — używany w Task 2 przez `ReactivateButton`.

- [ ] **Step 1: Dodaj funkcję `reactivateTask` w `src/app/(parent)/actions.ts`**

Wstaw nową funkcję bezpośrednio po `createTaskFromTemplate` (po linii `return { ok: true }\n}` zamykającej tę funkcję, przed komentarzem `// Zatwierdzenie zgłoszenia...`):

```typescript
// Reaktywacja wygasłego zadania: nowy termin (ten sam typ), wraca do puli otwartych.
// Czyścimy claimed_by/claimed_at — reguła #2 (1 zadanie = 1 wykonawca).
export async function reactivateTask(taskId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: task, error: fetchErr } = await supabase
    .from('tasks')
    .select('deadline_type')
    .eq('id', taskId)
    .single()
  if (fetchErr || !task) return { ok: false, error: 'Zadanie nie istnieje' }

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'open',
      expires_at: computeExpiry(task.deadline_type as DeadlineType),
      claimed_by: null,
      claimed_at: null,
    })
    .eq('id', taskId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/zadania')
  revalidatePath('/panel')
  return { ok: true }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów. (`DeadlineType` jest już zaimportowany na górze pliku: `import type { DeadlineType, TaskDifficulty } from '@/types'`.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(parent)/actions.ts"
git commit -m "Akcja reactivateTask: wygasłe zadanie wraca do puli z nowym terminem"
```

---

## Task 2: `ReactivateButton` + wpięcie w `TaskCard`

**Files:**
- Create: `src/components/tasks/ReactivateButton.tsx`
- Modify: `src/components/tasks/TaskCard.tsx`

**Interfaces:**
- Consumes: `reactivateTask(taskId: string): Promise<ActionResult>` z Task 1; istniejący `LoadingOverlay` (`src/components/ui/LoadingOverlay.tsx`, prop `show: boolean`); istniejący `Task` type (`src/types/index.ts:23-41`, pola `status: TaskStatus`, `expires_at: string`).
- Produces: `export function ReactivateButton({ taskId }: { taskId: string })`; `TaskCard` zyskuje prop `canReactivate?: boolean` — używany w Task 3 (`/zadania` rodzica).

- [ ] **Step 1: Utwórz `src/components/tasks/ReactivateButton.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { reactivateTask } from '@/app/(parent)/actions'

export function ReactivateButton({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const res = await reactivateTask(taskId)
      if (res.ok) {
        toast.success('Zadanie reaktywowane!')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <>
      <LoadingOverlay show={pending} />
      <button
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-medium text-teal underline disabled:opacity-60"
      >
        Reaktywuj
      </button>
    </>
  )
}
```

- [ ] **Step 2: Wpisz `canReactivate` do `TaskCard`**

W `src/components/tasks/TaskCard.tsx` zastąp całą zawartość pliku:

```tsx
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { DifficultyBadge, StatusBadge, CoinBadge } from '@/components/ui/Badge'
import { ReactivateButton } from '@/components/tasks/ReactivateButton'
import { formatDeadline } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'

interface TaskCardProps {
  task: Task
  href?: string
  showStatus?: boolean
  canReactivate?: boolean
}

export function TaskCard({ task, href, showStatus, canReactivate }: TaskCardProps) {
  const deadline = formatDeadline(task.expires_at)
  const isWeek = task.deadline_type === 'week'
  const isExpired = task.status === 'expired' || deadline.expired

  const content = (
    <Card interactive={!!href} className="flex items-start gap-3">
      <span className="text-3xl leading-none">{task.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-ink truncate">{task.title}</h3>
          <CoinBadge coins={task.coins_reward} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={task.difficulty} />
          {showStatus && <StatusBadge status={task.status} />}
          {isWeek && <span className="text-xs text-teal font-medium">⭐ tydzień</span>}
          <span
            className={cn(
              'text-xs',
              deadline.expired ? 'text-red-500' : 'text-ink-3'
            )}
          >
            {deadline.text}
          </span>
          {canReactivate && isExpired && <ReactivateButton taskId={task.id} />}
        </div>
      </div>
    </Card>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
```

Zmiana względem oryginału: dodany import `ReactivateButton`, nowy prop `canReactivate`, zmienna `isExpired` (`task.status === 'expired' || deadline.expired` — traktujemy zadanie jako wygasłe zarówno gdy cron już zaktualizował `status`, jak i gdy termin minął a cron jeszcze nie zdążył), oraz warunkowe renderowanie przycisku na końcu wiersza odznak.

`TaskCard` pozostaje komponentem serwerowym (bez `'use client'`) — interaktywność jest w osobnym leaf-komponencie `ReactivateButton`, tak jak `ReviewCard`/`TaskActions` są klientowskie, a strony je renderujące są serwerowe.

- [ ] **Step 3: Type-check**

Run: `npm run type-check`
Expected: brak błędów.

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/ReactivateButton.tsx src/components/tasks/TaskCard.tsx
git commit -m "TaskCard: przycisk Reaktywuj dla wygasłych zadań (widok rodzica)"
```

---

## Task 3: Rodzic — `/zadania` pokazuje wygasłe zadania

**Files:**
- Modify: `src/app/(parent)/zadania/page.tsx`

**Interfaces:**
- Consumes: `TaskCard` z propem `canReactivate` (Task 2); istniejący `Task` type.

- [ ] **Step 1: Zamień zawartość `src/app/(parent)/zadania/page.tsx`**

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { TaskCard } from '@/components/tasks/TaskCard'
import type { Task } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ZadaniaPage() {
  await requireUser('parent')
  const supabase = await createClient()

  // Otwarte + wygasłe — rodzic musi widzieć wygasłe, żeby móc je reaktywować.
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['open', 'expired'])
    .order('expires_at', { ascending: true })

  const allTasks = (tasks ?? []) as Task[]
  const openCount = allTasks.filter((t) => t.status === 'open').length
  const expiredCount = allTasks.length - openCount

  return (
    <main className="flex flex-col gap-5 px-4 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/panel" className="text-ink-3 hover:text-ink">←</Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Zadania</h1>
          <p className="text-sm text-ink-3">
            {openCount} otwartych{expiredCount > 0 ? ` · ${expiredCount} wygasłych` : ''}
          </p>
        </div>
      </header>

      {allTasks.length === 0 ? (
        <p className="text-center text-ink-3 py-12">Brak zadań</p>
      ) : (
        <div className="flex flex-col gap-3">
          {allTasks.map((task) => (
            <TaskCard key={task.id} task={task} showStatus canReactivate />
          ))}
        </div>
      )}
    </main>
  )
}
```

Zmiana względem oryginału: filtr `.eq('status', 'open')` → `.in('status', ['open', 'expired'])`; nagłówek „Otwarte zadania" → „Zadania" z licznikiem obu stanów; puste-stanowy tekst „Brak otwartych zadań" → „Brak zadań"; `TaskCard` dostaje nowy prop `canReactivate`.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(parent)/zadania/page.tsx"
git commit -m "Rodzic: lista /zadania pokazuje wygasłe zadania z przyciskiem Reaktywuj"
```

---

## Task 4: Dziecko — wygasłe zadania znikają bez czekania na cron

**Files:**
- Modify: `src/app/(child)/zadania/page.tsx`

- [ ] **Step 1: Dodaj warunek na `expires_at` do zapytania**

W `src/app/(child)/zadania/page.tsx` zastąp:

```ts
  // Otwarte zadania (nieprzyjęte) — RLS dodatkowo to gwarantuje.
  // Zadania tygodniowe na górze (reguła #4), potem wg najbliższego deadline'u.
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .order('deadline_type', { ascending: true }) // 'week' < 'end_of_day' alfabetycznie? -> sortujemy w JS
    .order('expires_at', { ascending: true })
```

na:

```ts
  // Otwarte zadania (nieprzyjęte) — RLS dodatkowo to gwarantuje.
  // expires_at > now(): wygasłe zadania znikają natychmiast, nie czekamy na cron expire-tasks.
  // Zadania tygodniowe na górze (reguła #4), potem wg najbliższego deadline'u.
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .order('deadline_type', { ascending: true }) // 'week' < 'end_of_day' alfabetycznie? -> sortujemy w JS
    .order('expires_at', { ascending: true })
```

Reszta pliku (sortowanie w JS, obsługa błędu, puste stany, `TaskCard` bez `canReactivate`) bez zmian.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(child)/zadania/page.tsx"
git commit -m "Dziecko: wygasłe zadania znikają z listy natychmiast (bez czekania na cron)"
```

---

## Weryfikacja końcowa (manualna)

Po wszystkich zadaniach uruchom `npm run dev` i sprawdź:

- [ ] `npm run type-check` i `npm run lint` przechodzą bez błędów.
- [ ] Jako rodzic, utwórz zadanie z terminem „dziś" (`/dodaj`), w bazie ręcznie ustaw `expires_at` na czas w przeszłości (np. przez Supabase Studio SQL editor: `update tasks set expires_at = now() - interval '1 hour' where id = '<id>'`).
- [ ] Zaloguj się jako dziecko na `/zadania` — zadanie z minionym terminem **nie pojawia się** na liście, mimo że `status` w bazie może wciąż być `'open'` (cron jeszcze nie zadziałał).
- [ ] Zaloguj się jako rodzic na `/zadania` — to samo zadanie **jest widoczne**, z czerwonym „wygasło" i przyciskiem „Reaktywuj".
- [ ] Kliknij „Reaktywuj” — toast „Zadanie reaktywowane!”, zadanie dostaje nowy `expires_at` (dziś 23:59 dla `end_of_day`, +7 dni dla `week`), `status` wraca na `'open'`.
- [ ] Po reaktywacji zadanie od razu widoczne na `/zadania` dziecka.
- [ ] Powtórz z zadaniem typu „tydzień” — reaktywacja daje nowy termin +7 dni, nie „dziś 23:59”.
- [ ] Zadanie, które dziecko przyjęło (`claimed_by` ustawione), a potem wygasło i zostało reaktywowane — po reaktywacji `claimed_by`/`claimed_at` są `null` (sprawdź w Supabase Studio), zadanie wraca do puli nieprzyjętych.
