# Wygasłe zadania — ukrycie dla dzieci, reaktywacja dla rodziców

## Problem

Ekran dziecka "Dostępne zadania" (`src/app/(child)/zadania/page.tsx`) filtruje zadania po `status = 'open'`, ale czerwony tekst "wygasło" jest liczony niezależnie w `formatDeadline()` (`src/lib/format.ts`) na podstawie `expires_at`. W efekcie zadanie, którego termin już minął, wciąż widnieje na liście dziecka — tylko z czerwonym tekstem — aż do momentu, gdy cron (Edge Function `expire-tasks`) zmieni `status` na `'expired'`. Nie znaleziono konfiguracji harmonogramu crona w repo, więc to opóźnienie może być nieograniczone.

Rodzice nie mają dziś żadnego miejsca, w którym widzieliby wygasłe zadania — filtr na `/zadania` też ogranicza się do `status = 'open'` — więc nie mogą ich reaktywować.

## Zmiany

### 1. Dziecko: wygasłe zadania znikają natychmiast

`src/app/(child)/zadania/page.tsx` — do zapytania dodajemy warunek na `expires_at`, żeby nie czekać na cron:

```ts
.eq('status', 'open')
.gt('expires_at', new Date().toISOString())
```

Reszta logiki strony (sortowanie, obsługa błędów, puste stany) bez zmian.

### 2. Rodzic: wygasłe zadania widoczne na tej samej liście, z przyciskiem reaktywacji

`src/app/(parent)/zadania/page.tsx` — zapytanie rozszerzamy na `status IN ('open', 'expired')`:

```ts
.in('status', ['open', 'expired'])
```

Zadanie traktujemy jako wygasłe do wyświetlenia, gdy `status === 'expired'` LUB `expires_at` już minął (ta sama logika co w kroku 1, żeby rodzic widział to samo co widziałoby dziecko, zanim zadziała cron).

`TaskCard` (`src/components/tasks/TaskCard.tsx`) dostaje nowy opcjonalny prop `onReactivate?: () => void` (lub podobny), renderowany jako przycisk "Reaktywuj" obok istniejącego `StatusBadge`, widoczny tylko gdy zadanie jest wygasłe i wywołanie pochodzi ze strony rodzica. Przycisk wywołuje nową akcję serwerową (patrz punkt 3) i odświeża listę (`router.refresh()`), analogicznie do `ReviewCard`.

Nagłówek listy zmienia się z "Otwarte zadania" na coś obejmującego oba stany (np. "Zadania" z podpisem liczby otwartych i wygasłych) — szczegóły tekstu do dopracowania podczas implementacji, byle po polsku i zgodnie z resztą UI.

### 3. Akcja reaktywacji

Nowa funkcja w `src/app/(parent)/actions.ts`:

```ts
export async function reactivateTask(taskId: string): Promise<ActionResult>
```

Zachowanie:
- Pobiera zadanie, odczytuje jego `deadline_type`
- Liczy nowy `expires_at` przy użyciu istniejącego `computeExpiry(deadline_type)` (bez duplikowania logiki: dziś → 23:59 dzisiaj, tydzień → +7 dni od teraz)
- `update` na tabeli `tasks`: `status = 'open'`, `expires_at = <nowa data>`, `claimed_by = null`, `claimed_at = null` — zadanie wraca do puli nieprzyjętych, tak jak nowo utworzone
- `revalidatePath('/zadania')` i `/panel`

Nie jest wymagana migracja SQL — istniejąca polityka RLS `"tasks update by parent"` już pozwala rodzicowi na dowolny update wiersza w `tasks`.

## Poza zakresem

- Nie zmieniamy działania Edge Function `expire-tasks` ani nie konfigurujemy dla niej harmonogramu crona — to pozostaje osobnym zagadnieniem.
- Nie dodajemy powiadomień push o reaktywacji.
- Status `in_review` pozostaje nieużywany, tak jak dotychczas — nie jest to w zakresie tej zmiany.
