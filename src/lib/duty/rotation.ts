// Rotacja dyżurów — czyste funkcje na stringach dat 'YYYY-MM-DD'.
// UWAGA: to jest referencyjna (i testowana) implementacja rotacji.
// Mirror w SQL: supabase/migrations/0006_duty_calendar.sql → funkcja duty_on().
// Przy zmianie kolejności/kotwicy/algorytmu — zaktualizuj OBA miejsca.

// Pozycja 0 = Sonia (patrz duty_rotation + seed-family.ts). Kotwica: tego dnia dyżur ma pozycja 0.
export const ANCHOR_DATE = '2026-07-02'
const CYCLE = 3

// 'YYYY-MM-DD' -> liczba dni od epoki (UTC midnight), bez pułapek stref.
function toDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

function fromDayNumber(dayNum: number): string {
  const dt = new Date(dayNum * 86_400_000)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function diffDaysStr(aStr: string, bStr: string): number {
  return toDayNumber(aStr) - toDayNumber(bStr)
}

export function addDaysStr(dateStr: string, days: number): string {
  return fromDayNumber(toDayNumber(dateStr) + days)
}

// Indeks rotacji 0..CYCLE-1 (ujemne modulo obsłużone).
export function dutyIndexForDate(dateStr: string, anchorStr: string = ANCHOR_DATE): number {
  const diff = diffDaysStr(dateStr, anchorStr)
  return ((diff % CYCLE) + CYCLE) % CYCLE
}

export function effectiveDutyChildId(
  dateStr: string,
  rotation: { position: number; child_id: string }[],
  overrides: { duty_date: string; child_id: string }[],
  anchorStr: string = ANCHOR_DATE
): string | null {
  const ov = overrides.find((o) => o.duty_date === dateStr)
  if (ov) return ov.child_id
  const idx = dutyIndexForDate(dateStr, anchorStr)
  const row = rotation.find((r) => r.position === idx)
  return row ? row.child_id : null
}

export function buildDutyCalendar(
  fromStr: string,
  days: number,
  rotation: { position: number; child_id: string }[],
  overrides: { duty_date: string; child_id: string }[],
  anchorStr: string = ANCHOR_DATE
): { duty_date: string; child_id: string | null }[] {
  const out: { duty_date: string; child_id: string | null }[] = []
  for (let i = 0; i < days; i++) {
    const duty_date = addDaysStr(fromStr, i)
    out.push({ duty_date, child_id: effectiveDutyChildId(duty_date, rotation, overrides, anchorStr) })
  }
  return out
}
