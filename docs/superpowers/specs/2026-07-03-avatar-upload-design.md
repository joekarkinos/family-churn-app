# Zmiana zdjęcia profilowego — projekt

Data: 2026-07-03
Status: zatwierdzony

## Cel

Umożliwić członkom rodziny ustawienie prawdziwego zdjęcia profilowego (zamiast
samego emoji). Każdy może zmienić własne zdjęcie; rodzic dodatkowo może zmienić
zdjęcie dowolnego dziecka. Zdjęcie zastępuje emoji wszędzie w aplikacji przez
wspólny komponent `Avatar`.

## Reguły / decyzje

- **Rodzaj**: prawdziwe zdjęcie z telefonu (upload), nie wybór emoji.
- **Uprawnienia**: każdy edytuje swoje; rodzic edytuje też zdjęcia dzieci.
- **Prywatność**: publiczny bucket `avatars`, ścieżka nieodgadywalna
  (`{userId}/{uuid}.webp`). Kto zna link — zobaczy; link losowy.
- **Rozmiar**: skalowanie w przeglądarce do 512×512 (center-crop) + kompresja
  do WebP przed uploadem. Limit bucketa 2 MB (zapas ponad rozmiar po kompresji).
- **Fallback**: gdy brak `avatar_url` — dotychczasowy emoji w kolorowym kółku.
- **Zasięg**: podmiana emoji→zdjęcie WSZĘDZIE (wspólny `Avatar`).
- Język UI/błędów: wyłącznie polski.

## Dane

Migracja `0007_avatar_url.sql`:
- `alter table public.app_users add column avatar_url text;` (nullable).
- Utworzenie publicznego bucketa `avatars` (insert do `storage.buckets`
  z `public = true`, `file_size_limit`, `allowed_mime_types`).
- Polityki RLS na `storage.objects` dla bucketa `avatars`:
  - SELECT: publiczny (`bucket_id = 'avatars'`).
  - INSERT/UPDATE/DELETE: `bucket_id = 'avatars'` i
    (`(storage.foldername(name))[1] = auth.uid()::text` **lub** `public.is_parent()`).
    Pierwszy segment ścieżki = docelowy `userId`, więc dziecko pisze tylko do
    swojego folderu; rodzic (is_parent) może pisać do dowolnego.

`CurrentUser` (w `src/lib/auth/session.ts`) i `getCurrentUser` rozszerzone o
`avatar_url: string | null`. Typ `AppUser` w `src/types/index.ts` już ma
`avatar_emoji`; dodać `avatar_url?: string | null`.

## Ścieżka w Storage

Czysta funkcja `buildAvatarPath(userId: string): string` →
`` `${userId}/${uuid()}.webp` ``. Testowalna (prefiks = userId, rozszerzenie
`.webp`). `uuid` z `crypto.randomUUID()` (dostępne w przeglądarce i Node 24).

## Upload (klient) — `AvatarUploader`

`'use client'`, props: `{ targetUserId: string; canEdit: boolean }`.
1. `<input type="file" accept="image/*">`.
2. Walidacja: typ zaczyna się od `image/`; inaczej toast błędu.
3. Skalowanie przez `<canvas>`: wczytaj do `Image`, center-crop do kwadratu,
   narysuj 512×512, `canvas.toBlob(..., 'image/webp', 0.85)`.
4. `supabase.storage.from('avatars').upload(buildAvatarPath(targetUserId), blob,
   { contentType: 'image/webp' })` (klient przeglądarkowy). Nazwa losowa (uuid),
   więc bez `upsert` — każdy upload to nowy obiekt.
5. `getPublicUrl(path)` → wywołanie server action `setAvatarUrl(publicUrl,
   targetUserId)`.
6. `LoadingOverlay` w trakcie; toast sukcesu/błędu; `router.refresh()`.

Server action `setAvatarUrl(url: string, targetUserId: string)` w
`src/app/(child)/profile-actions.ts` (współdzielone; nie zależy od segmentu):
`update app_users set avatar_url = url where id = targetUserId`. RLS
`app_users updatable by self or parent` już autoryzuje. `revalidatePath` dla
`/profil` i `/panel`.

## Komponent wyświetlania — `Avatar`

`src/components/ui/Avatar.tsx` (server-safe, bez `'use client'`):
`Avatar({ url, emoji, color, size = 40 })` — gdy `url`: okrągły `<img>` z
`object-cover`, `width/height=size`; inaczej emoji wyśrodkowane w kółku z tłem
`color + '22'`. Rozmiar sterowany propem (px).

Podmiana istniejących miejsc pokazujących sam emoji:
- `src/app/(child)/profil/page.tsx` (duży, 96px).
- `src/app/(parent)/panel/page.tsx` (lista dzieci, 40px).
- `src/components/duty/DutyWeek.tsx` (mały, ~28px).
- `src/components/duty/DutyBanner.tsx` (wariant `info`).
- `src/components/auth/PersonPicker.tsx`.

By to umożliwić, źródła danych avatarów muszą dostarczać `avatar_url`:
- `loadDutyView` (`children` mapa) — dodać `avatar_url` do selectu i typu mapy.
- panel: select dzieci — dodać `avatar_url`.
- `PersonPicker` — jego zapytanie o osoby dodać `avatar_url`.

`DutyBannerState.info` rozszerzyć o `childAvatarUrl?: string | null`.

## UI — gdzie zmiana

- `/profil` (dziecko): pod avatarem `AvatarUploader` (`targetUserId = user.id`,
  `canEdit = true`).
- Panel rodzica: przy profilu rodzica i każdym dziecku możliwość zmiany
  (rodzic: swoje + dzieci). Realizacja: `AvatarUploader` z `targetUserId`
  dziecka. Minimalnie — na `/profil` rodzica brak (rodzic nie ma /profil);
  dodać mały uploader własnego zdjęcia rodzica na panelu.

## Błędy

- Zły typ pliku → toast „Wybierz plik graficzny".
- Błąd uploadu Storage → toast z komunikatem (fallback po polsku).
- Błąd zapisu `avatar_url` → toast „Nie udało się zapisać zdjęcia".
- Brak canvas/`toBlob` (bardzo stare przeglądarki) → toast błędu, brak crash.

## Testy

- Jednostkowy: `buildAvatarPath` — zwraca `${userId}/<uuid>.webp`, prefiks =
  userId, kończy się `.webp`. (Node `--test`, mock `crypto.randomUUID`
  niepotrzebny — sprawdzamy regex.)
- Type-check + `next build`.
- Ręczna weryfikacja na produkcji: upload zdjęcia jako dziecko, podmiana widoczna
  na /profil, panelu, paskach dyżuru; rodzic zmienia zdjęcie dziecka.

## Poza zakresem (YAGNI)

- Kadrowanie interaktywne (przesuwanie/zoom) — bierzemy center-crop.
- Wiele zdjęć / galeria — jedno zdjęcie na osobę.
- Usuwanie starych plików z bucketa przy podmianie (losowa nazwa = stare pliki
  zostają w buckecie; akceptowalne dla małej apki; ewentualne czyszczenie
  osobnym zadaniem).
- Prywatny bucket / signed URL.
