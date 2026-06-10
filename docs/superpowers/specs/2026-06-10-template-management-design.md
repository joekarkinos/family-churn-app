# Zarządzanie szablonami zadań przez rodzica — Design

**Data:** 2026-06-10
**Status:** zatwierdzony

## Cel

Umożliwić rodzicom dodawanie, edycję i usuwanie szablonów zadań z poziomu
aplikacji. Przy okazji usunąć obecną duplikację: szablony są dziś zapisane
zarówno w kodzie (`src/lib/templates.ts`), jak i w bazie
(`public.task_templates`, seedowane migracją `0004`), a aplikacja czyta tylko
z kodu. Tabela staje się jedynym źródłem prawdy.

## Decyzje (z brainstormingu)

- **Edytowalne pola:** wszystkie — `title`, `emoji`, `description`,
  `default_coins`, `default_difficulty`, `room`, `suggested_checklist`.
- **Usuwanie szablonu:** zachowaj zadania, odłącz (FK `on delete set null`).
  Istniejące zadania zostają (mają własną kopię tytułu/monet), tracą tylko
  podgląd checklisty. Szablon znika z listy „Dodaj zadanie".
- **Wejście do ekranu:** link „Zarządzaj szablonami" na ekranie `/dodaj`.
- **ID nowego szablonu:** losowy UUID (kolumna `id` to `text`, przyjmuje UUID).
  Istniejące slugi (`lazienka-taty` itd.) zostają nietknięte.

## 1. Warstwa danych — czytanie z bazy

- `src/lib/templates.ts` przestaje być źródłem prawdy. Szablony pochodzą z
  `public.task_templates`.
- Nowy helper serwerowy `getTemplates()` (np. w `src/lib/templates.ts` jako
  funkcja async lub w `(parent)/actions.ts`) — `select *` z tabeli, sortowanie
  po `title`. Zwraca `TaskTemplate[]`. Obsługa błędu: log + pusta lista.
- Konsumenci przechodzą z importu stałej na fetch z bazy:
  - `src/components/tasks/CreateTaskPicker.tsx` — dostaje listę szablonów przez
    props z server-component rodzica (`(parent)/dodaj/page.tsx`).
  - `src/app/(child)/zadania/[id]/page.tsx` — pobiera checklistę szablonu po
    `task.template_id` (pojedynczy select), zamiast szukać w stałej.

## 2. Migracja `0005_templates_writable.sql`

- Polityki RLS dla zapisu na `task_templates`, tylko rodzic
  (`public.is_parent()`): `insert`, `update`, `delete`. Istniejąca polityka
  `select` ("readable by authenticated") zostaje.
- Zmiana FK: `tasks.template_id` → `on delete set null`. Wymaga `drop
  constraint` istniejącego FK i dodania nowego z regułą. Dzięki temu usunięcie
  szablonu zostawia zadania nienaruszone, tylko zeruje `template_id`.

## 3. Akcje serwerowe (`src/app/(parent)/actions.ts`)

Trzy nowe akcje, wszystkie chronione (RLS + brak dostępu dla nie-rodzica),
zwracają istniejący kształt `ActionResult`, robią `revalidatePath`:

- `createTemplate(input)` — generuje `crypto.randomUUID()`, insert.
- `updateTemplate(id, input)` — update wszystkich pól.
- `deleteTemplate(id)` — delete (FK odłącza zadania).

Walidacja (komunikaty po polsku):
- `title` niepusty,
- `default_coins` całkowite ≥ 1,
- `default_difficulty` ∈ `easy|medium|hard`,
- `suggested_checklist` — tablica niepustych stringów (puste kroki odfiltrowane),
- `emoji` niepuste (fallback `📋`).

`revalidatePath('/dodaj')` i `revalidatePath('/szablony')`.

## 4. UI

- **`/dodaj`** (`(parent)/dodaj/page.tsx`): server component pobiera szablony
  przez `getTemplates()`, przekazuje do `CreateTaskPicker`. Na górze link
  „⚙️ Zarządzaj szablonami" → `/szablony`.
- **Nowy route `(parent)/szablony/page.tsx`**: server component,
  `requireUser('parent')`, lista wszystkich szablonów z `getTemplates()`,
  renderuje `TemplateManager`.
- **Nowy komponent `src/components/tasks/TemplateManager.tsx`** (`'use client'`):
  - lista szablonów (emoji, tytuł, monety, trudność) z akcjami Edytuj / Usuń,
  - przycisk „+ Dodaj szablon",
  - formularz (jeden, używany do dodawania i edycji) ze wszystkimi polami;
    edytor checklisty z dodawaniem/usuwaniem wierszy kroków,
  - wzorzec `useTransition` + `LoadingOverlay` + `react-hot-toast`,
  - usuwanie z potwierdzeniem (toast z przyciskami, jak ostrzeżenie o duplikacie
    w `CreateTaskPicker`).

## 5. Obsługa błędów i testy

- Akcje obsługują błędy Supabase (`error.message`); nie-rodzic blokowany przez
  RLS i guard trasy `requireUser('parent')`.
- Weryfikacja: `npm run type-check` + manualny przebieg (dodaj → edytuj →
  usuń → sprawdź, że lista w „Dodaj" się aktualizuje i że stare zadanie
  przeżywa usunięcie szablonu).

## Pliki

**Nowe:**
- `supabase/migrations/0005_templates_writable.sql`
- `src/app/(parent)/szablony/page.tsx`
- `src/components/tasks/TemplateManager.tsx`

**Zmieniane:**
- `src/lib/templates.ts` (stała → helper `getTemplates()`, lub stała usunięta)
- `src/app/(parent)/dodaj/page.tsx`
- `src/components/tasks/CreateTaskPicker.tsx`
- `src/app/(child)/zadania/[id]/page.tsx`
- `src/app/(parent)/actions.ts`
