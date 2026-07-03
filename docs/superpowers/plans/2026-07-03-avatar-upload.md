# Zmiana zdjęcia profilowego — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Umożliwić ustawienie prawdziwego zdjęcia profilowego (upload z telefonu, skalowany w przeglądarce), które zastępuje emoji wszędzie w aplikacji; każdy edytuje swoje, rodzic dodatkowo zdjęcia dzieci.

**Architecture:** Nowa kolumna `app_users.avatar_url` + publiczny bucket Storage `avatars` z RLS (własny folder albo rodzic). Klient skaluje obraz przez `<canvas>` do 512×512 WebP i wysyła do Storage; server action zapisuje publiczny URL w profilu. Wspólny komponent `Avatar` (zdjęcie else emoji) podmienia wszystkie dotychczasowe miejsca z samym emoji.

**Tech Stack:** Next.js 14 (Server Components + server actions), TypeScript, Supabase (Postgres + Storage + RLS), `@supabase/ssr` (klient przeglądarkowy), Canvas API (bez nowych zależności), `react-hot-toast`, testy `node --test` + `tsx`.

## Global Constraints

- Język UI/komunikatów/błędów: **wyłącznie polski**.
- Uprawnienia: każdy edytuje swoje zdjęcie; **rodzic** edytuje też zdjęcia dzieci.
- Bucket `avatars` **publiczny**; ścieżka nieodgadywalna `{userId}/{uuid}.webp`.
- Obraz skalowany w przeglądarce do **512×512** (center-crop), kompresja **WebP** q≈0.85, przed uploadem. Limit bucketa **2 MB**.
- Fallback: brak `avatar_url` → dotychczasowy `avatar_emoji` w kółku z tłem `color + '22'`.
- Zdjęcie ma pierwszeństwo nad emoji; nic nie usuwamy.
- Server Components domyślnie; `'use client'` tylko gdy konieczne.
- Supabase queries: zawsze obsługa błędów, nigdy `.data!` bez sprawdzenia.
- Commity bez GPG: `git -c commit.gpgsign=false commit`. Autor: joekarkinos <karkinos79@gmail.com>.
- Nowe typy w `src/types/index.ts`, eksportowane.

## Mapa plików

- **Create** `supabase/migrations/0007_avatar_url.sql` — kolumna `avatar_url`, bucket `avatars`, polityki `storage.objects`.
- **Create** `src/lib/avatar/path.ts` — `buildAvatarPath(userId)`.
- **Create** `src/lib/avatar/path.test.ts` — test jednostkowy ścieżki.
- **Create** `src/lib/avatar/resize.ts` — `resizeToSquareWebp(file, size): Promise<Blob>` (klient, canvas).
- **Create** `src/app/(child)/profile-actions.ts` — server action `setAvatarUrl`.
- **Create** `src/components/ui/Avatar.tsx` — wspólny komponent wyświetlania.
- **Create** `src/components/profile/AvatarUploader.tsx` — `'use client'` upload.
- **Modify** `src/lib/auth/session.ts` — `CurrentUser.avatar_url` + select.
- **Modify** `src/types/index.ts` — `AppUser.avatar_url`; `DutyBannerState.info` + `childAvatarUrl`.
- **Modify** `src/lib/duty/queries.ts` — `children` mapa z `avatar_url`; baner `info` z `childAvatarUrl`.
- **Modify** `src/app/(auth)/actions.ts` — `FamilyMember.avatar_url` + select.
- **Modify** `src/components/auth/PersonPicker.tsx` — użyj `Avatar`.
- **Modify** `src/app/(child)/profil/page.tsx` — `Avatar` + `AvatarUploader`.
- **Modify** `src/app/(parent)/panel/page.tsx` — `Avatar` przy dzieciach + `AvatarUploader` (rodzic + dzieci); select dzieci z `avatar_url`.
- **Modify** `src/components/duty/DutyWeek.tsx` — `Avatar` w kaflu (mapa `people` z `avatar_url`).
- **Modify** `src/components/duty/DutyBanner.tsx` — `Avatar` w wariancie `info`.

---

### Task 1: Migracja — kolumna avatar_url + bucket + polityki

**Files:**
- Create: `supabase/migrations/0007_avatar_url.sql`

**Interfaces:**
- Consumes: `public.app_users`, `public.is_parent()`.
- Produces: kolumna `public.app_users.avatar_url text`; publiczny bucket `avatars`; polityki RLS na `storage.objects`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0007_avatar_url.sql`:

```sql
-- ─────────────────────────────────────────────────────────────────
-- ZadaniaDom — Zdjęcia profilowe
-- Kolumna avatar_url (zdjęcie ma pierwszeństwo nad avatar_emoji).
-- Publiczny bucket 'avatars', ścieżka {userId}/{uuid}.webp.
-- Zapis: własny folder (auth.uid()) albo rodzic (is_parent()).
-- ─────────────────────────────────────────────────────────────────

alter table public.app_users add column avatar_url text;

-- Publiczny bucket na avatary (limit 2 MB, tylko obrazy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Odczyt publiczny.
create policy "avatars read public"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Zapis/nadpis/usuń: pierwszy segment ścieżki = userId (własny folder) albo rodzic.
create policy "avatars insert own or parent"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_parent())
  );

create policy "avatars update own or parent"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_parent())
  )
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_parent())
  );

create policy "avatars delete own or parent"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_parent())
  );
```

- [ ] **Step 2: Sanity-check składni (baza lokalna niedostępna — Docker down)**

Przejrzyj migrację: brak literówek, polityki mają `to authenticated`/`to public`,
`storage.foldername(name)[1]` porównywane z `auth.uid()::text`. Zastosowanie na
produkcji nastąpi w osobnym kroku po zaakceptowaniu przez użytkownika (jak przy
dyżurach — `npx supabase db push`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_avatar_url.sql
git -c commit.gpgsign=false commit -m "Zdjęcia: migracja — kolumna avatar_url + bucket avatars + polityki"
```

---

### Task 2: Ścieżka w Storage (czysta funkcja) + test

**Files:**
- Create: `src/lib/avatar/path.ts`
- Test: `src/lib/avatar/path.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `crypto.randomUUID()` (globalne w Node 24 i w przeglądarce).
- Produces: `buildAvatarPath(userId: string): string` → `` `${userId}/${uuid}.webp` ``.

- [ ] **Step 1: Write the failing test**

Create `src/lib/avatar/path.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAvatarPath } from './path'

test('ścieżka ma prefiks userId i rozszerzenie .webp', () => {
  const p = buildAvatarPath('user-123')
  assert.ok(p.startsWith('user-123/'), 'prefiks = userId')
  assert.ok(p.endsWith('.webp'), 'rozszerzenie .webp')
})

test('kolejne wywołania dają różne ścieżki (losowy uuid)', () => {
  const a = buildAvatarPath('u')
  const b = buildAvatarPath('u')
  assert.notEqual(a, b)
})

test('segment po userId to niepusta nazwa pliku', () => {
  const p = buildAvatarPath('abc')
  const file = p.split('/')[1]
  assert.match(file, /^[0-9a-f-]{36}\.webp$/)
})
```

- [ ] **Step 2: Rozszerz skrypt test i uruchom — ma nie przejść**

Modify `package.json` — zmień skrypt `test`, by objął cały katalog `src`:

```json
    "test": "node --import tsx --test \"src/**/*.test.ts\"",
```

Run: `npm test`
Expected: FAIL — `Cannot find module './path'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/avatar/path.ts`:

```ts
// Ścieżka pliku avatara w buckecie 'avatars'. Pierwszy segment = userId
// (polityka RLS pisze tylko do własnego folderu, chyba że rodzic).
// Nazwa losowa (uuid), więc każdy upload to nowy obiekt.
export function buildAvatarPath(userId: string): string {
  return `${userId}/${crypto.randomUUID()}.webp`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — testy `path` (3) oraz istniejące `rotation` (7); łącznie `pass 10`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatar/path.ts src/lib/avatar/path.test.ts package.json
git -c commit.gpgsign=false commit -m "Zdjęcia: buildAvatarPath + testy; test obejmuje cały src"
```

---

### Task 3: Skalowanie obrazu w przeglądarce

**Files:**
- Create: `src/lib/avatar/resize.ts`

**Interfaces:**
- Consumes: DOM `Image`, `HTMLCanvasElement`, `File`/`Blob`.
- Produces: `resizeToSquareWebp(file: File, size?: number): Promise<Blob>` — center-crop do kwadratu `size` (domyślnie 512), WebP q≈0.85. Rzuca `Error` przy braku obsługi canvas/wczytania.

- [ ] **Step 1: Write the implementation**

Create `src/lib/avatar/resize.ts`:

```ts
// Skalowanie obrazu w przeglądarce: center-crop do kwadratu + kompresja WebP.
// Brak testu jednostkowego (canvas dostępny tylko w przeglądarce) — logika
// trzymana mała i czysta; weryfikacja ręczna w aplikacji.
export async function resizeToSquareWebp(file: File, size = 512): Promise<Blob> {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nie jest obsługiwany')

  // Center-crop: bierzemy kwadrat ze środka źródła.
  const side = Math.min(img.width, img.height)
  const sx = (img.width - side) / 2
  const sy = (img.height - side) / 2
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85)
  )
  if (!blob) throw new Error('Nie udało się przetworzyć obrazu')
  return blob
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Nie udało się wczytać pliku'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Nieprawidłowy obraz'))
    img.src = src
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/lib/avatar/resize.ts
git -c commit.gpgsign=false commit -m "Zdjęcia: skalowanie obrazu w przeglądarce (canvas → WebP 512²)"
```

---

### Task 4: Typy + rozszerzenie loaderów o avatar_url

Rozszerzamy źródła danych, by dostarczały `avatar_url` (potrzebne, by `Avatar` w Task 5+ mógł je wyświetlić).

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/auth/session.ts`
- Modify: `src/app/(auth)/actions.ts`
- Modify: `src/lib/duty/queries.ts`

**Interfaces:**
- Consumes: istniejące typy `AppUser`, `DutyBannerState`, `CurrentUser`, `FamilyMember`, `DutyView`.
- Produces:
  - `AppUser.avatar_url?: string | null`.
  - `CurrentUser.avatar_url: string | null`.
  - `FamilyMember.avatar_url: string | null`.
  - `DutyView['children']` wartości: `{ name; avatar_emoji; color; avatar_url }`.
  - `DutyBannerState` wariant `info` z polem `childAvatarUrl?: string | null`.

- [ ] **Step 1: Typy w types/index.ts — AppUser + DutyBannerState.info**

W `src/types/index.ts`, w interfejsie `AppUser` po `avatar_emoji: string` dodaj:

```ts
  avatar_url?: string | null   // zdjęcie profilowe (ma pierwszeństwo nad emoji)
```

W tym samym pliku, w typie `DutyBannerState`, zamień wariant `info` na:

```ts
  | { kind: 'info'; childName: string; childEmoji: string; childAvatarUrl?: string | null } // ktoś inny na dyżurze
```

- [ ] **Step 2: CurrentUser + getCurrentUser**

W `src/lib/auth/session.ts`, w interfejsie `CurrentUser` po `avatar_emoji: string` dodaj:

```ts
  avatar_url: string | null
```

W `getCurrentUser`, w wywołaniu `.select(...)` dodaj `avatar_url`:

```ts
    .select('id, name, role, avatar_emoji, color, avatar_url, coin_balance')
```

- [ ] **Step 3: FamilyMember + getFamilyMembers**

W `src/app/(auth)/actions.ts`, w interfejsie `FamilyMember` po `avatar_emoji: string` dodaj:

```ts
  avatar_url: string | null
```

W `getFamilyMembers`, w `.select(...)` dodaj `avatar_url`:

```ts
    .select('id, name, role, avatar_emoji, color, avatar_url')
```

- [ ] **Step 4: loadDutyView — children z avatar_url + baner info**

W `src/lib/duty/queries.ts`:

a) W typie `DutyView` zmień pole `children` na:

```ts
  children: Record<string, { name: string; avatar_emoji: string; color: string | null; avatar_url: string | null }>
```

b) W zapytaniu o dzieci dodaj `avatar_url`:

```ts
    supabase.from('app_users').select('id, name, avatar_emoji, color, avatar_url').eq('role', 'child'),
```

c) W pętli budującej mapę `children` dodaj `avatar_url`:

```ts
  for (const c of childRes.data ?? []) {
    children[c.id] = { name: c.name, avatar_emoji: c.avatar_emoji, color: c.color, avatar_url: c.avatar_url }
  }
```

d) W `computeBanner`, w OBU miejscach zwracających `kind: 'info'` (gałąź rodzica
oraz gałąź końcowa dla dziecka) dołóż `childAvatarUrl`:

```ts
      return {
        kind: 'info',
        childName: children[todayDutyId].name,
        childEmoji: children[todayDutyId].avatar_emoji,
        childAvatarUrl: children[todayDutyId].avatar_url,
      }
```

- [ ] **Step 5: Type-check**

Run: `npm run type-check`
Expected: brak błędów (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/auth/session.ts "src/app/(auth)/actions.ts" src/lib/duty/queries.ts
git -c commit.gpgsign=false commit -m "Zdjęcia: avatar_url w typach i loaderach (session, family, duty)"
```

---

### Task 5: Wspólny komponent Avatar

**Files:**
- Create: `src/components/ui/Avatar.tsx`

**Interfaces:**
- Consumes: nic (czysty komponent prezentacyjny, server-safe).
- Produces: `Avatar({ url, emoji, color, size, alt }: { url?: string | null; emoji: string; color?: string | null; size?: number; alt?: string })`. Gdy `url` — okrągły `<img>` `object-cover`; inaczej emoji w kółku z tłem `color + '22'`. `size` w px (domyślnie 40). Rozmiar emoji ~ `size * 0.5`.

- [ ] **Step 1: Write the component**

Create `src/components/ui/Avatar.tsx`:

```tsx
// Wspólny avatar: zdjęcie (jeśli url) albo emoji w kolorowym kółku (fallback).
export function Avatar({
  url,
  emoji,
  color,
  size = 40,
  alt = '',
}: {
  url?: string | null
  emoji: string
  color?: string | null
  size?: number
  alt?: string
}) {
  const dim = { width: size, height: size }

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        style={dim}
        className="rounded-full object-cover"
      />
    )
  }

  return (
    <span
      style={{ ...dim, backgroundColor: (color ?? '#00897b') + '22', fontSize: size * 0.5 }}
      className="flex items-center justify-center rounded-full leading-none"
    >
      {emoji}
    </span>
  )
}
```

- [ ] **Step 2: Type-check + lint (sprawdza dyrektywę eslint-disable dla <img>)**

Run: `npm run type-check && npm run lint`
Expected: type-check bez błędów; lint bez ostrzeżeń (użycie `<img>` świadome, wyłączone regułą inline).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Avatar.tsx
git -c commit.gpgsign=false commit -m "Zdjęcia: wspólny komponent Avatar (zdjęcie else emoji)"
```

---

### Task 6: Server action setAvatarUrl

**Files:**
- Create: `src/app/(child)/profile-actions.ts`

**Interfaces:**
- Consumes: `createClient` (server), tabela `app_users` (RLS `updatable by self or parent`).
- Produces: `setAvatarUrl(url: string, targetUserId: string): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Write the action**

Create `src/app/(child)/profile-actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProfileActionResult = { ok: true } | { ok: false; error: string }

// Zapis URL-a zdjęcia profilowego. RLS 'app_users updatable by self or parent'
// autoryzuje: dziecko tylko siebie, rodzic siebie i dzieci.
export async function setAvatarUrl(
  url: string,
  targetUserId: string
): Promise<ProfileActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('app_users')
    .update({ avatar_url: url })
    .eq('id', targetUserId)
  if (error) {
    if (error.message.includes('row-level security')) {
      return { ok: false, error: 'Brak uprawnień do zmiany tego zdjęcia' }
    }
    return { ok: false, error: 'Nie udało się zapisać zdjęcia' }
  }
  revalidatePath('/profil')
  revalidatePath('/panel')
  return { ok: true }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: brak błędów (exit 0).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(child)/profile-actions.ts"
git -c commit.gpgsign=false commit -m "Zdjęcia: server action setAvatarUrl (RLS self-or-parent)"
```

---

### Task 7: Komponent AvatarUploader

**Files:**
- Create: `src/components/profile/AvatarUploader.tsx`

**Interfaces:**
- Consumes: `createClient` z `@/lib/supabase/client`, `buildAvatarPath`, `resizeToSquareWebp`, `setAvatarUrl`, `LoadingOverlay`, `react-hot-toast`, `useRouter`.
- Produces: `AvatarUploader({ targetUserId, label }: { targetUserId: string; label?: string })`.

- [ ] **Step 1: Write the component**

Create `src/components/profile/AvatarUploader.tsx`:

```tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { buildAvatarPath } from '@/lib/avatar/path'
import { resizeToSquareWebp } from '@/lib/avatar/resize'
import { setAvatarUrl } from '@/app/(child)/profile-actions'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

export function AvatarUploader({
  targetUserId,
  label = 'Zmień zdjęcie',
}: {
  targetUserId: string
  label?: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // pozwól wybrać ten sam plik ponownie
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Wybierz plik graficzny')
      return
    }

    setBusy(true)
    try {
      const blob = await resizeToSquareWebp(file)
      const path = buildAvatarPath(targetUserId)
      const supabase = createClient()
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/webp' })
      if (upErr) {
        toast.error('Nie udało się wgrać zdjęcia')
        return
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const res = await setAvatarUrl(data.publicUrl, targetUserId)
      if (res.ok) {
        toast.success('Zdjęcie zaktualizowane')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    } catch {
      toast.error('Nie udało się przetworzyć obrazu')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <LoadingOverlay show={busy} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="text-sm font-medium text-teal underline disabled:opacity-60"
      >
        {label}
      </button>
    </>
  )
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npm run lint`
Expected: type-check bez błędów; lint bez ostrzeżeń.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/AvatarUploader.tsx
git -c commit.gpgsign=false commit -m "Zdjęcia: komponent AvatarUploader (skalowanie + upload + zapis)"
```

---

### Task 8: Użycie Avatar + uploader na ekranie /profil (dziecko)

**Files:**
- Modify: `src/app/(child)/profil/page.tsx`

**Interfaces:**
- Consumes: `Avatar`, `AvatarUploader`, `requireUser` (`CurrentUser` ma teraz `avatar_url`).

- [ ] **Step 1: Zamień emoji-kółko na Avatar + dodaj uploader**

W `src/app/(child)/profil/page.tsx` dodaj importy po istniejących:

```ts
import { Avatar } from '@/components/ui/Avatar'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
```

Zamień blok:

```tsx
        <span
          className="flex h-24 w-24 items-center justify-center rounded-full text-5xl"
          style={{ backgroundColor: (user.color ?? '#00897b') + '22' }}
        >
          {user.avatar_emoji}
        </span>
```

na:

```tsx
        <Avatar url={user.avatar_url} emoji={user.avatar_emoji} color={user.color} size={96} alt={user.name} />
```

Bezpośrednio po `<p className="text-ink-3">{user.coin_balance} 🪙 na koncie</p>`
(wciąż wewnątrz kontenera wyśrodkowanego) dodaj:

```tsx
        <AvatarUploader targetUserId={user.id} />
```

- [ ] **Step 2: Type-check + build**

Run: `npm run type-check && npm run build`
Expected: type-check bez błędów; build sukces; `/profil` bez błędów.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(child)/profil/page.tsx"
git -c commit.gpgsign=false commit -m "Zdjęcia: Avatar + uploader na ekranie profilu dziecka"
```

---

### Task 9: Panel rodzica — Avatar przy dzieciach + uploadery (rodzic i dzieci)

**Files:**
- Modify: `src/app/(parent)/panel/page.tsx`

**Interfaces:**
- Consumes: `Avatar`, `AvatarUploader`, `requireUser` (`user.avatar_url`, `user.id`), select dzieci z `avatar_url`.

- [ ] **Step 1: Importy + avatar_url w selekcie dzieci**

W `src/app/(parent)/panel/page.tsx` dodaj importy po istniejących:

```ts
import { Avatar } from '@/components/ui/Avatar'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
```

W zapytaniu o dzieci dodaj `avatar_url`:

```ts
    .select('id, name, avatar_emoji, color, coin_balance, avatar_url')
```

- [ ] **Step 2: Profil rodzica z uploaderem (nad kaflami statystyk)**

Bezpośrednio po `</header>` (a przed blokiem `{duty && ...}`) wstaw kartę profilu rodzica:

```tsx
      <Card className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <Avatar url={user.avatar_url} emoji={user.avatar_emoji} color={user.color} size={40} alt={user.name} />
          <span className="font-medium text-ink">{user.name}</span>
        </div>
        <AvatarUploader targetUserId={user.id} label="Zmień moje zdjęcie" />
      </Card>
```

- [ ] **Step 3: Avatar + uploader przy każdym dziecku**

Zamień w liście dzieci blok emoji-kółka:

```tsx
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                  style={{ backgroundColor: (c.color ?? '#00897b') + '22' }}
                >
                  {c.avatar_emoji}
                </span>
                <span className="font-medium text-ink">{c.name}</span>
```

na:

```tsx
                <Avatar url={c.avatar_url} emoji={c.avatar_emoji} color={c.color} size={40} alt={c.name} />
                <div className="flex flex-col">
                  <span className="font-medium text-ink">{c.name}</span>
                  <AvatarUploader targetUserId={c.id} label="Zmień zdjęcie" />
                </div>
```

- [ ] **Step 4: Type-check + build**

Run: `npm run type-check && npm run build`
Expected: type-check bez błędów; build sukces; `/panel` bez błędów.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(parent)/panel/page.tsx"
git -c commit.gpgsign=false commit -m "Zdjęcia: panel rodzica — Avatar + uploadery (rodzic i dzieci)"
```

---

### Task 10: Avatar w paskach dyżuru i PersonPicker

**Files:**
- Modify: `src/components/duty/DutyWeek.tsx`
- Modify: `src/components/duty/DutyBanner.tsx`
- Modify: `src/components/auth/PersonPicker.tsx`

**Interfaces:**
- Consumes: `Avatar`; `people` w DutyWeek ma `avatar_url`; `DutyBannerState.info.childAvatarUrl`; `FamilyMember.avatar_url`.

- [ ] **Step 1: DutyWeek — typ people + Avatar w kaflu**

W `src/components/duty/DutyWeek.tsx` dodaj import:

```ts
import { Avatar } from '@/components/ui/Avatar'
```

Zmień typ propu `people`:

```ts
  people: Record<string, { name: string; avatar_emoji: string; color: string | null; avatar_url: string | null }>
```

Zamień linię pokazującą sam emoji:

```tsx
              <span className="mt-1 text-lg" title={child?.name ?? ''}>
                {child?.avatar_emoji ?? '—'}
              </span>
```

na:

```tsx
              <span className="mt-1" title={child?.name ?? ''}>
                {child ? (
                  <Avatar url={child.avatar_url} emoji={child.avatar_emoji} color={child.color} size={28} alt={child.name} />
                ) : (
                  '—'
                )}
              </span>
```

- [ ] **Step 2: DutyBanner — Avatar w wariancie info**

W `src/components/duty/DutyBanner.tsx` dodaj import:

```ts
import { Avatar } from '@/components/ui/Avatar'
```

Zamień blok wariantu `info`:

```tsx
  if (state.kind === 'info') {
    return (
      <div className={`${base} bg-surface`}>
        <p className="text-sm text-ink-3">Dziś dyżur pełni</p>
        <p className="font-display text-lg font-bold text-ink">
          {state.childEmoji} {state.childName}
        </p>
      </div>
    )
  }
```

na:

```tsx
  if (state.kind === 'info') {
    return (
      <div className={`${base} bg-surface flex items-center gap-3`}>
        <Avatar url={state.childAvatarUrl} emoji={state.childEmoji} size={40} alt={state.childName} />
        <div>
          <p className="text-sm text-ink-3">Dziś dyżur pełni</p>
          <p className="font-display text-lg font-bold text-ink">{state.childName}</p>
        </div>
      </div>
    )
  }
```

- [ ] **Step 3: PersonPicker — Avatar w siatce i na ekranie PIN**

W `src/components/auth/PersonPicker.tsx` dodaj import:

```ts
import { Avatar } from '@/components/ui/Avatar'
```

Zamień emoji-kółko na ekranie PIN (wybrana osoba):

```tsx
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
            style={{ backgroundColor: (selected.color ?? '#00897b') + '22' }}
          >
            {selected.avatar_emoji}
          </span>
```

na:

```tsx
          <Avatar url={selected.avatar_url} emoji={selected.avatar_emoji} color={selected.color} size={80} alt={selected.name} />
```

Zamień emoji-kółko w siatce osób:

```tsx
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{ backgroundColor: (m.color ?? '#00897b') + '22' }}
            >
              {m.avatar_emoji}
            </span>
```

na:

```tsx
            <Avatar url={m.avatar_url} emoji={m.avatar_emoji} color={m.color} size={64} alt={m.name} />
```

- [ ] **Step 4: Type-check + build + lint**

Run: `npm run type-check && npm run lint && npm run build`
Expected: wszystko bez błędów; build sukces.

- [ ] **Step 5: Commit**

```bash
git add src/components/duty/DutyWeek.tsx src/components/duty/DutyBanner.tsx src/components/auth/PersonPicker.tsx
git -c commit.gpgsign=false commit -m "Zdjęcia: Avatar w paskach dyżuru i ekranie wyboru osoby"
```

---

### Task 11: Weryfikacja końcowa + zastosowanie na produkcji

**Files:** — (weryfikacja + deploy migracji)

- [ ] **Step 1: Pełna lokalna weryfikacja**

Run: `npm test && npm run lint && npm run type-check && npm run build`
Expected: `pass 10` (rotation 7 + path 3), lint czysty, type-check czysty, build sukces.

- [ ] **Step 2: Zastosuj migrację 0007 na produkcji (za zgodą użytkownika)**

Poproś użytkownika o potwierdzenie zastosowania na prod, następnie:

Run: `npx supabase db push`
Expected: `Applying migration 0007_avatar_url.sql...` bez `ERROR`; `npx supabase migration list` pokazuje `0007 | 0007`.

- [ ] **Step 3: Ręczny scenariusz (na produkcji, `npm run dev` lub wdrożenie)**

1. Zaloguj jako **Hania** → `/profil` → „Zmień zdjęcie" → wybierz zdjęcie z telefonu → toast „Zdjęcie zaktualizowane", avatar zmienia się na zdjęcie.
2. Sprawdź, że zdjęcie widać też na ekranie wyboru osoby (`/login`), w pasku dyżuru i grafiku (`/zadania`), a u rodzica na panelu.
3. Zaloguj jako **rodzic** → panel → przy dziecku „Zmień zdjęcie" → podmiana działa.
4. (Negatywnie) Spróbuj wybrać plik nie-graficzny → toast „Wybierz plik graficzny".

Expected: zachowanie jak wyżej; brak błędów w konsoli.

- [ ] **Step 4: Commit ewentualnych poprawek**

```bash
git add -A
git -c commit.gpgsign=false commit -m "Zdjęcia: weryfikacja końcowa i poprawki"
```

---

## Self-Review

**Spec coverage:**
- Kolumna `avatar_url` + pierwszeństwo nad emoji → Task 1, Task 4, Task 5 (fallback w `Avatar`). ✅
- Publiczny bucket `avatars` + polityki (self-or-parent, folder=userId) → Task 1. ✅
- Ścieżka `{userId}/{uuid}.webp` → Task 2 (`buildAvatarPath`) + test. ✅
- Skalowanie 512² WebP w przeglądarce → Task 3 (`resizeToSquareWebp`). ✅
- Uprawnienia: każdy swoje + rodzic dzieci → RLS Storage (Task 1) + RLS `app_users` (istniejąca) używana w `setAvatarUrl` (Task 6); UI: /profil dziecka (Task 8), panel rodzica swoje+dzieci (Task 9). ✅
- Upload flow (input→resize→upload→getPublicUrl→setAvatarUrl→refresh) → Task 7. ✅
- Wspólny `Avatar` wszędzie: /profil (T8), panel (T9), DutyWeek+DutyBanner+PersonPicker (T10). ✅
- Błędy po polsku (zły typ, upload, zapis, brak canvas) → Task 7 (toasty) + Task 6 (fallback). ✅
- Test jednostkowy `buildAvatarPath` → Task 2. ✅
- Ręczna weryfikacja + deploy migracji → Task 11. ✅

**Placeholder scan:** brak „TBD/TODO"; każdy krok z kodem ma kod; komendy z oczekiwanym wyjściem. Krok bazodanowy (Task 1 Step 2) świadomie oznaczony — Docker niedostępny, deploy w Task 11 za zgodą. ✅

**Type consistency:**
- `buildAvatarPath(userId): string` — def Task 2, użycie Task 7. ✅
- `resizeToSquareWebp(file, size?): Promise<Blob>` — def Task 3, użycie Task 7. ✅
- `setAvatarUrl(url, targetUserId): Promise<ProfileActionResult>` — def Task 6, użycie Task 7. ✅
- `Avatar({ url, emoji, color, size, alt })` — def Task 5, użycie Task 8/9/10. ✅
- `AvatarUploader({ targetUserId, label? })` — def Task 7, użycie Task 8/9. ✅
- `avatar_url` dodane spójnie w `AppUser`/`CurrentUser`/`FamilyMember`/`DutyView.children` (Task 4) przed użyciem (Task 8/9/10). ✅
- `DutyBannerState.info.childAvatarUrl` — def Task 4, ustawiane w `computeBanner` Task 4, czytane Task 10. ✅
- `DutyWeek` prop `people` z `avatar_url` — typ Task 10 zgodny z mapą `children` z Task 4; wywołania (`/zadania`, `/panel`) przekazują `duty.children`, który już ma `avatar_url`. ✅

## Poza zakresem (YAGNI)
- Interaktywne kadrowanie (zoom/przesuwanie) — center-crop.
- Wiele zdjęć / galeria.
- Czyszczenie starych plików w buckecie.
- Prywatny bucket / signed URL.
