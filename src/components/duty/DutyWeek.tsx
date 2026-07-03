import type { DutyDay } from '@/types'

const WEEKDAYS = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.']

// 'YYYY-MM-DD' -> etykieta dnia tygodnia (bez pułapek stref: liczymy z UTC midnight).
function weekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function dayNum(dateStr: string): string {
  return String(Number(dateStr.split('-')[2]))
}

export function DutyWeek({
  calendar,
  people,
  today,
}: {
  calendar: DutyDay[]
  people: Record<string, { name: string; avatar_emoji: string; color: string | null }>
  today: string
}) {
  if (calendar.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-medium text-ink-3">Grafik dyżurów</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {calendar.map((day) => {
          const child = day.child_id ? people[day.child_id] : undefined
          const isToday = day.duty_date === today
          return (
            <div
              key={day.duty_date}
              className={
                'flex min-w-[64px] flex-col items-center rounded-xl px-2 py-2 text-center ' +
                (isToday ? 'bg-teal/15 border border-teal/40' : 'bg-surface')
              }
            >
              <span className="text-[11px] text-ink-3">{weekdayLabel(day.duty_date)}</span>
              <span className="text-xs font-medium text-ink">{dayNum(day.duty_date)}</span>
              <span className="mt-1 text-lg" title={child?.name ?? ''}>
                {child?.avatar_emoji ?? '—'}
              </span>
              <span className="text-[11px] text-ink-3">{child?.name ?? ''}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
