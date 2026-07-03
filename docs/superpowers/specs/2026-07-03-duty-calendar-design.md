# Kalendarz dyżurów z zastępstwami — projekt

Data: 2026-07-03
Status: zatwierdzony

## Cel

Dodać do aplikacji ZadaniaDom kalendarz "kto dziś ma dyżur" dla trzech córek
(Sonia, Hania, Maria) w stałej rotacji. Dziecko na dyżurze widzi na ekranie
głównym informację "Dziś Twój dyżur". Jeśli nie może pełnić dyżuru, może
poprosić dwie siostry o zastępstwo; pierwsza, która zaakceptuje, przejmuje
dzisiejszy dyżur, a prosząca oddaje jej najbliższy własny dyżur (automatyczna
zamiana dwóch dni).

Dyżur jest **wyłącznie informacyjny** — nie tworzy zadań ani monet.

## Rotacja (bazowy grafik)

Deterministyczna, liczona z kodu — **bez** materializowanej tabeli kalendarza.

- Stała kolejność: `['Sonia', 'Hania', 'Maria']` (wg id dzieci).
- Data-kotwica: `2026-07-02` = Sonia.
- Dyżur na datę D:

  ```
  index = ((daysBetween(anchor, D)) mod 3 + 3) mod 3
  dyzurny = order[index]
  ```

- Kontrola: 07-02 Sonia, **07-03 Hania (dziś)**, 07-04 Maria, 07-05 Sonia…

Wszystkie daty liczone jako **dzień lokalny w strefie Europe/Warsaw** (spójnie
z regułą deadline 23:59), nie w UTC. Kotwica i "dziś" wyznaczane w tej strefie.

## Dane (migracja 0006)

### `duty_overrides`
Tylko wyjątki od rotacji. Efektywny dyżurny dla daty = override, jeśli istnieje;
w przeciwnym razie policzona rotacja.

| kolumna     | typ          | uwagi                                        |
|-------------|--------------|----------------------------------------------|
| duty_date   | date         | PK — jedna data = jeden dyżurny               |
| child_id    | uuid         | FK app_users, dziecko                         |
| source      | text         | 'swap' \| 'manual' (na przyszłość rodzic)     |
| created_at  | timestamptz  | default now()                                 |

### `duty_swap_requests`
Prośby o zastępstwo dla konkretnej daty.

| kolumna      | typ          | uwagi                                       |
|--------------|--------------|---------------------------------------------|
| id           | uuid PK      | gen_random_uuid()                            |
| duty_date    | date         | dzień, którego dotyczy prośba                |
| requester_id | uuid         | FK app_users — kto prosi                     |
| status       | text         | 'pending' \| 'accepted' \| 'cancelled'       |
| accepted_by  | uuid null    | FK app_users — kto przejął                   |
| created_at   | timestamptz  | default now()                                |
| resolved_at  | timestamptz  | ustawiane przy accepted/cancelled            |

Częściowy unikalny indeks: co najwyżej jedna `pending` prośba na `(duty_date)`.

### RLS
- Dzieci: SELECT wszystkich override'ów i prośb (muszą widzieć zaproszenie u
  siebie). Modyfikacje wyłącznie przez RPC (SECURITY DEFINER) — brak
  bezpośrednich INSERT/UPDATE z klienta dla dzieci.
- Rodzice: pełny odczyt.

## Logika (RPC, SECURITY DEFINER, atomowo)

### `request_duty_swap(p_duty_date date) → uuid`
- Waliduje: wołający to dziecko i jest efektywnym dyżurnym `p_duty_date`.
- Odrzuca, jeśli istnieje już `pending` prośba dla tej daty.
- Tworzy `pending`, zwraca id.

### `accept_duty_swap(p_request_id uuid) → void`
Reguła "kto pierwszy, ten bierze":
1. `SELECT ... FOR UPDATE` prośby; wymaga `status='pending'`. Jeśli nie —
   wyjątek (druga akceptacja przegrywa wyścig).
2. Wołający ≠ requester, wołający to dziecko.
3. Wyznacza **najbliższy przyszły dyżur akceptującej**: pierwsza data
   `d > today` (Warsaw), dla której efektywny dyżurny = akceptująca
   (uwzględnia istniejące override'y).
4. Zapisuje 2 override'y (upsert po `duty_date`):
   - `p_duty_date → accepted_by` (akceptująca bierze dziś),
   - `d → requester_id` (prosząca oddaje ten dzień).
5. Ustawia prośbę `accepted`, `accepted_by`, `resolved_at=now()`.

### `cancel_duty_swap(p_request_id uuid) → void`
- Tylko requester; tylko gdy `pending`; ustawia `cancelled`, `resolved_at`.

## UI

### Ekran główny dziecka (`/zadania`)
Baner nad listą zadań (nowy komponent `DutyBanner`, client):
- Jeśli wołający jest dziś na dyżurze: „🧹 Dziś Twój dyżur, {imię}!" +
  przycisk „Nie mogę dziś — poproś siostry".
- Jeśli ma aktywną `pending` prośbę: „Czekam na zastępstwo…" + „Anuluj".
- Jeśli inna siostra ma `pending` prośbę na dziś: „{imię} prosi o zastępstwo
  dziś" + „Zgadzam się". Po akceptacji krótki komunikat: „Bierzesz dziś dyżur,
  a {imię} odda Ci {data}".

### Mini-kalendarz (komponent `DutyWeek`)
Najbliższe ~5 dni z imieniem dyżurnego (rotacja + override'y). Pokazywany pod
banerem. Read-only.

## Powiadomienia
Na razie **in-app** (baner). FCM push to osobne, niezrobione TODO — nie wchodzi
w zakres. Kod zostawia miejsce na dołożenie powiadomienia przy `accept`.

## Testy
- Czysta funkcja rotacji: kotwica → poprawny dyżurny dla serii dat (w tym przed
  kotwicą, ujemny modulo).
- `accept_duty_swap` happy path: 2 override'y, poprawna „najbliższa" data.
- Wyścig: druga akceptacja `pending`→ już `accepted` dostaje błąd.
- Brak uprawnień: nie-dyżurny nie może `request`, requester nie może `accept`
  własnej prośby.
- Wyznaczanie najbliższego dyżuru uwzględnia istniejące override'y.

## Poza zakresem (YAGNI)
- FCM push.
- Ręczna edycja grafiku przez rodzica (zostawiamy `source='manual'` na później).
- Historia/log zamian poza wierszami w `duty_swap_requests`.
