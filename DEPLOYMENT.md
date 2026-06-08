# Wdrożenie ZadaniaDom — przewodnik krok po kroku

Ten dokument prowadzi Cię **od zera do działającej aplikacji** w internecie. Zakłada,
że nie masz jeszcze żadnych kont. Wszystko, co opisane, da się zrobić w darmowych planach.

## Co budujemy (architektura)

```
┌─────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│   Vercel    │────▶│         Supabase          │     │   Firebase   │
│ (Next.js,   │     │ PostgreSQL + Auth +       │     │  (FCM push)  │
│  frontend)  │     │ Storage + Edge Functions  │     │  — później   │
└─────────────┘     └──────────────────────────┘     └──────────────┘
```

- **Vercel** — hostuje aplikację Next.js (to, co widzą użytkownicy).
- **Supabase** — baza danych, logowanie, pliki, funkcje cron. Serce backendu.
- **Firebase (FCM)** — powiadomienia push na Androida. **Opcjonalne na start** —
  aplikacja działa bez nich; dodasz je później (epiki E8/E9).

Kolejność jest ważna: **najpierw Supabase** (bo z niego bierzesz klucze), **potem Vercel**.

---

## Czego potrzebujesz przed startem

| Rzecz | Po co | Gdzie zdobyć |
|-------|-------|--------------|
| Konto GitHub | kod aplikacji jest tam (`joekarkinos/family-churn-app`) | masz już ✓ |
| Konto Supabase | backend | rejestracja w kroku 1 |
| Konto Vercel | hosting | rejestracja w kroku 4 |
| Node.js 18+ na komputerze | uruchomienie migracji i seeda | [nodejs.org](https://nodejs.org) (masz v24 ✓) |
| (opcjonalnie) konto Firebase | push notyfikacje | krok 7 |

---

## KROK 1 — Załóż projekt Supabase

1. Wejdź na **https://supabase.com** → **Start your project** → zaloguj się przez GitHub.
2. **New project**:
   - **Name**: `zadaniadom`
   - **Database Password**: wygeneruj silne hasło i **zapisz je** (przyda się do migracji).
   - **Region**: wybierz najbliższy — **Central EU (Frankfurt)**.
   - **Pricing Plan**: **Free**.
3. Kliknij **Create new project** i poczekaj ~2 minuty, aż baza wstanie.

---

## KROK 2 — Skopiuj klucze API

W projekcie Supabase wejdź w **Settings (⚙️) → API** i zapisz trzy wartości:

| Wartość w Supabase | Zmienna w aplikacji | Uwaga |
|--------------------|---------------------|-------|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` | np. `https://abcd1234.supabase.co` |
| **Project API keys → `anon` `public`** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | bezpieczny dla przeglądarki |
| **Project API keys → `service_role` `secret`** | `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ **TAJNY** — nigdy w kliencie, nigdy w gicie |

> 💡 `service_role` omija RLS. Trzymaj go tylko po stronie serwera (seed, Edge Functions, zmienne na Vercel).

Dodatkowo wymyśl jedną własną wartość:

| Zmienna | Co to | Jak wygenerować |
|---------|-------|-----------------|
| `AUTH_DERIVE_SECRET` | sekret do wyprowadzania ukrytych haseł logowania | w terminalu: `openssl rand -hex 32` (albo dowolny długi losowy ciąg) |

---

## KROK 3 — Wgraj schemat bazy i dane (migracje + seed)

Robisz to **raz, z własnego komputera**. Masz dwie drogi — wybierz A (prościej) lub B (CLI).

### Opcja A — przez panel Supabase (najprościej)

1. W Supabase wejdź w **SQL Editor → New query**.
2. Otwórz po kolei pliki z repo i **wklej + uruchom** (przycisk **Run**) w tej kolejności:
   1. `supabase/migrations/0001_initial_schema.sql`
   2. `supabase/migrations/0002_rls_policies.sql`
   3. `supabase/migrations/0003_rpc_functions.sql`
   4. `supabase/migrations/0004_seed_templates.sql`
3. Sprawdź w **Table Editor**, że pojawiły się tabele (`app_users`, `tasks`, …) i 10 szablonów w `task_templates`.

### Opcja B — przez Supabase CLI (jeśli wolisz terminal)

```bash
# w katalogu projektu
npx supabase login                       # otworzy przeglądarkę
npx supabase link --project-ref <PROJECT_REF>   # REF jest w URL projektu / Settings
npx supabase db push                     # wypchnie wszystkie migracje z supabase/migrations
```

### Seed rodziny (oba warianty wymagają tego kroku)

Migracje tworzą **tabele i szablony**, ale **nie tworzą użytkowników** (Tata, Mama, Hania,
Maria, Sonia). Robi to skrypt, bo musi założyć prawdziwych użytkowników w Supabase Auth.

1. W katalogu projektu utwórz plik **`.env.local`** (jest w `.gitignore`, więc nie trafi do gita):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...
   AUTH_DERIVE_SECRET=tu-wklej-wynik-openssl-rand-hex-32

   # (opcjonalnie) własne PIN-y; bez nich użyte zostaną domyślne
   PIN_TATA=1234
   PIN_MAMA=4321
   PIN_HANIA=1111
   PIN_MARIA=2222
   PIN_SONIA=3333
   ```

2. Zainstaluj zależności i uruchom seed:

   ```bash
   npm install
   npm run seed:family
   ```

   Zobaczysz potwierdzenie utworzenia 5 osób. **Zapisz PIN-y** — będą potrzebne do logowania.
   Domyślne PIN-y (gdy nie ustawisz swoich): Tata `1111`, Mama `2222`, Hania `3333`, Maria `4444`, Sonia `5555`.

> ⚠️ `AUTH_DERIVE_SECRET` w seedzie i na Vercel **musi być identyczny** — inaczej logowanie nie zadziała.

---

## KROK 4 — Załóż konto Vercel i podłącz repo

1. Wejdź na **https://vercel.com** → **Sign Up** → **Continue with GitHub**.
2. **Add New… → Project**.
3. Z listy repozytoriów wybierz **`family-churn-app`** → **Import**.
   - Jeśli repo nie widać: **Adjust GitHub App Permissions** i daj Vercel dostęp do repo.
4. Konfiguracja projektu:
   - **Framework Preset**: Next.js (wykryje automatycznie).
   - **Root Directory**: zostaw domyślnie (`./`).
   - **Build Command / Output**: zostaw domyślne.
   - **NIE klikaj jeszcze Deploy** — najpierw dodaj zmienne (krok 5).

---

## KROK 5 — Dodaj zmienne środowiskowe na Vercel

Wciąż na ekranie importu rozwiń **Environment Variables** i dodaj (dla środowiska
**Production**, a najlepiej też Preview/Development):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Twój Project URL z kroku 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | klucz `anon` z kroku 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | klucz `service_role` z kroku 2 |
| `AUTH_DERIVE_SECRET` | **dokładnie ten sam** sekret co w seedzie |

> Pola `NEXT_PUBLIC_FCM_VAPID_KEY` i `FCM_SERVER_KEY` dodasz dopiero, gdy włączysz push (krok 7).
> Bez nich aplikacja działa normalnie.

Teraz kliknij **Deploy**. Po ~1–2 min dostaniesz adres typu `https://family-churn-app.vercel.app`.

---

## KROK 6 — Połącz Supabase Auth z adresem Vercel

Żeby logowanie i przekierowania działały na produkcji:

1. W Supabase wejdź **Authentication → URL Configuration**.
2. **Site URL**: wpisz adres z Vercel, np. `https://family-churn-app.vercel.app`.
3. **Redirect URLs**: dodaj ten sam adres (oraz `http://localhost:3000` do testów lokalnych).
4. Zapisz.

Wejdź na adres Vercel, wybierz osobę, wpisz PIN — powinieneś się zalogować. 🎉

---

## KROK 7 — (Opcjonalnie, później) Powiadomienia push przez Firebase

Pomiń ten krok na start. Wróć do niego, gdy zaimplementujesz epiki E8/E9.

1. Wejdź na **https://console.firebase.google.com** → **Create a project** (możesz wyłączyć Analytics).
2. **Project settings → Cloud Messaging** — włącz **Firebase Cloud Messaging API (V1)**.
3. **Project settings → General → Your apps → Web app (`</>`)** — zarejestruj aplikację web.
4. W **Cloud Messaging → Web Push certificates → Generate key pair** skopiuj **klucz VAPID**:
   - → zmienna `NEXT_PUBLIC_FCM_VAPID_KEY`.
5. Klucz serwera (do wysyłki z Edge Function) → zmienna `FCM_SERVER_KEY`.
6. Dodaj obie zmienne **na Vercel** (krok 5) i w Supabase **Edge Functions secrets**.

---

## KROK 8 — (Opcjonalnie) Edge Function: wygasanie zadań (cron)

Funkcja `supabase/functions/expire-tasks` oznacza przeterminowane zadania (reguły #3/#4).
Aby działała na produkcji:

```bash
npx supabase functions deploy expire-tasks
```

Następnie w Supabase **Database → Cron Jobs** (rozszerzenie `pg_cron`) dodaj wywołanie
funkcji **co minutę**. Sekrety funkcji (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) ustaw w
**Edge Functions → Secrets**.

> `notify-push` jest na razie pustym placeholderem — wdrożysz ją, gdy dodasz kod FCM.

---

## KROK 9 — (Opcjonalnie) Storage na zdjęcia zgłoszeń

Jeśli włączysz upload zdjęć przy zgłaszaniu zadań:

1. Supabase **Storage → New bucket** → nazwa `submissions` → **Public** (lub prywatny + polityki).
2. `next.config.mjs` już zezwala na obrazy z `*.supabase.co`.

---

## Codzienne wdrażanie zmian (po pierwszym setupie)

Po połączeniu z Vercel deploy jest automatyczny:

- **push do gałęzi `master`** → Vercel buduje i publikuje **produkcję**.
- **push do innej gałęzi / Pull Request** → Vercel tworzy **Preview** (osobny adres do testów).

Zmiany w bazie wdrażasz osobno: dopisz nową migrację `00XX_...sql` w `supabase/migrations/`
i uruchom `npx supabase db push` (lub wklej w SQL Editor).

---

## Szybka checklista

- [ ] Projekt Supabase utworzony (Free, region Frankfurt)
- [ ] Skopiowane: URL, `anon`, `service_role`; wygenerowany `AUTH_DERIVE_SECRET`
- [ ] Migracje `0001`–`0004` wykonane
- [ ] `.env.local` uzupełniony i `npm run seed:family` wykonany (PIN-y zapisane)
- [ ] Repo zaimportowane do Vercel
- [ ] 4 zmienne środowiskowe dodane na Vercel (`AUTH_DERIVE_SECRET` identyczny z seedem!)
- [ ] Deploy zakończony, adres `*.vercel.app` działa
- [ ] Supabase Auth → Site URL + Redirect URLs ustawione na adres Vercel
- [ ] Logowanie PIN-em działa na produkcji
- [ ] (później) Firebase FCM, cron `expire-tasks`, bucket `submissions`

---

## Najczęstsze problemy

| Objaw | Przyczyna / rozwiązanie |
|-------|--------------------------|
| Nie mogę się zalogować, „Logowanie nie powiodło się" | `AUTH_DERIVE_SECRET` na Vercel ≠ ten z seedu. Ustaw identyczny i przeloguj. |
| „Brak konfiguracji serwera" przy logowaniu | Brak `AUTH_DERIVE_SECRET` w zmiennych Vercel. |
| Lista osób pusta na ekranie logowania | Seed nie wykonany albo zły `SUPABASE_SERVICE_ROLE_KEY`. Uruchom `npm run seed:family`. |
| Build na Vercel pada na brak zmiennych | Dodaj 4 zmienne z kroku 5 i zrób **Redeploy**. |
| Dziecko widzi cudze monety | RLS nie wgrane — uruchom migrację `0002_rls_policies.sql`. |
| Po deployu 404 na `/zadania` | To normalne, dopóki nie zalogujesz się jako dziecko (trasy chronione middleware). |
