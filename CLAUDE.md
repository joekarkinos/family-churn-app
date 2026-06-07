# ZadaniaDom — Instrukcje dla Claude Code

## Projekt

Aplikacja PWA dla rodziny Karkinosów do zarządzania domowymi obowiązkami.
Dzieci przyjmują zadania, wykonują je, zgłaszają. Rodzice tworzą, zatwierdzają, wypłacają monety.

## Rodzina

| Osoba | Rola    | Wiek | Kolor     |
|-------|---------|------|-----------|
| Tata  | rodzic  | —    | zielony   |
| Mama  | rodzic  | —    | niebieski |
| Hania | dziecko | 11   | turkusowy |
| Maria | dziecko | 14   | fioletowy |
| Sonia | dziecko | 18   | czerwony  |

Łazienka Taty = kabina prysznicowa.
Łazienka dziewczyn i Mamy = z wanną.
Pokój Hani + Marii = wspólny. Pokój Soni = osobny.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)
- **Hosting**: Vercel (frontend), Supabase (backend)
- **Push notyfikacje**: Firebase Cloud Messaging (FCM) — Android
- **Autentykacja**: Supabase custom auth + PIN 4-cyfrowy (bcrypt hash)

## Kluczowe reguły biznesowe

1. **1 moneta = 1 PLN** — bez wyjątków
2. **1 zadanie = 1 wykonawca** — po przyjęciu znika z listy innych
3. **Deadline "dziś"** → wygasa o 23:59 (cron co minutę w Edge Function)
4. **Deadline "tydzień"** → wygasa po 7 dniach, widoczne na górze listy
5. **Minimum wypłaty**: 1 PLN (1 moneta)
6. **Wypłata**: ręczna (rodzic robi przelew w Millennium, klika "Zapłacono")
7. **Monety nigdy nie wygasają**
8. **Każde dziecko widzi TYLKO swoje monety** — rodzice widzą wszystkich
9. **Duplikat zadania**: jeśli podobne zadanie (ten sam template_id) jest już otwarte, drugi rodzic dostaje alert z pytaniem "czy na pewno?"
10. **Komentarze do zadań**: dzieci mogą komentować dlaczego nie wzięły (za mało kasy, za trudne, niejasne, brak czasu) — rodzic dostaje powiadomienie

## Struktura katalogu

```
src/
  app/
    (auth)/          # ekrany logowania / wybór osoby / PIN
    (child)/         # widoki dla dzieci (zadania, moje, monety, profil)
    (parent)/        # widoki dla rodziców (panel, dodaj, zatwierdź, statsy)
  components/
    ui/              # Button, Badge, Card, BottomNav, etc.
    tasks/           # TaskCard, TaskDetail, SubmissionForm, etc.
    auth/            # PersonPicker, PinInput
    wallet/          # WalletCard, TransactionHistory, WithdrawalForm
  lib/
    supabase/        # client.ts (browser), server.ts (SSR)
    templates.ts     # lista szablonów zadań
  types/             # wszystkie TypeScript types
  hooks/             # useAuth, useTasks, useRealtime, etc.

supabase/
  migrations/        # SQL schema
  functions/
    expire-tasks/    # cron: wygasanie zadań
    notify-push/     # FCM push notifications
```

## Szablony zadań (wszystkie)

- 🍽️ Załaduj zmywarkę (30 monet, łatwe)
- 🥣 Rozładuj zmywarkę (25 monet, łatwe)
- 👕 Rozwiesić pranie (60 monet, średnie)
- 👗 Rozebrać suche pranie (50 monet, średnie)
- 🧹 Odkurzyć salon (50 monet, średnie)
- 🚿 Wyczyścić łazienkę Taty — prysznic (70 monet, trudne)
- 🛁 Wyczyścić łazienkę z wanną (80 monet, trudne)
- 📦 Pozbierać rzeczy w korytarzu (20 monet, łatwe)
- 🛏️ Posprzątać pokój Hani & Marii (40 monet, średnie)
- 🛏️ Posprzątać pokój Soni (40 monet, średnie)

## Design

- Font: Syne (display/tytuły) + DM Sans (body)
- Paleta: ciemne tło #1a1714, powierzchnie #faf8f5, akcent turkusowy #00897b
- Mobile-first, max-width 480px, PWA (działa jak natywna na Android)
- Język: **wyłącznie polski** — UI, komunikaty, błędy, wszystko

## Konwencje kodu

- Komponenty: PascalCase, jeden plik = jeden komponent
- Hooki: useXxx prefix
- Zmienne i funkcje: camelCase
- Typy: w `src/types/index.ts`, eksportowane
- Server Components domyślnie, `'use client'` tylko gdy konieczne
- Supabase queries: zawsze obsługa błędów, nigdy `.data!` bez sprawdzenia

## TODO (kolejność implementacji)

- [ ] Ekran wyboru osoby + PIN (auth flow)
- [ ] Middleware Supabase (ochrona tras)
- [ ] Widok dziecka: lista zadań
- [ ] Widok dziecka: szczegół + przyjęcie zadania
- [ ] Widok dziecka: zgłoszenie wykonania
- [ ] Panel rodzica: dashboard
- [ ] Panel rodzica: tworzenie zadania z szablonu
- [ ] Panel rodzica: zatwierdzanie zgłoszeń
- [ ] Portfel dziecka + prośba o wypłatę
- [ ] Panel rodzica: zarządzanie wypłatami
- [ ] Push notyfikacje (FCM)
- [ ] Cron: wygasanie zadań
- [ ] Statystyki (rodzic)
- [ ] PWA icons + manifest

## Środowisko

Zmienne w `.env.local` (nie commitować — jest w .gitignore):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_FCM_VAPID_KEY
- FCM_SERVER_KEY

Szablon w `.env.example`.
