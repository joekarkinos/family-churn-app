import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

async function count(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  filter: (q: any) => any
): Promise<number> {
  const q = filter(supabase.from(table).select('id', { count: 'exact', head: true }))
  const { count } = await q
  return count ?? 0
}

export default async function PanelPage() {
  const user = await requireUser('parent')
  const supabase = await createClient()

  const [openTasks, pendingReviews, pendingWithdrawals] = await Promise.all([
    count(supabase, 'tasks', (q) => q.eq('status', 'open')),
    count(supabase, 'submissions', (q) => q.eq('review_status', 'pending')),
    count(supabase, 'withdrawal_requests', (q) => q.eq('status', 'pending')),
  ])

  const { data: children } = await supabase
    .from('app_users')
    .select('id, name, avatar_emoji, color, coin_balance')
    .eq('role', 'child')
    .order('name')

  return (
    <main className="flex flex-col gap-5 px-4 pt-6">
      <header>
        <p className="text-sm text-ink-3">Cześć, {user.name} {user.avatar_emoji}</p>
        <h1 className="font-display text-2xl font-bold text-ink">Panel rodzica</h1>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatTile href="/zatwierdz" value={pendingReviews} label="Do sprawdzenia" highlight={pendingReviews > 0} />
        <StatTile href="/wyplaty" value={pendingWithdrawals} label="Wypłaty" highlight={pendingWithdrawals > 0} />
        <StatTile href="/zadania-rodzic" value={openTasks} label="Otwarte" />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display font-semibold text-ink">Dzieci</h2>
          <Link href="/statystyki" className="text-sm text-teal">Statystyki →</Link>
        </div>
        <div className="flex flex-col gap-2">
          {(children ?? []).map((c) => (
            <Card key={c.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                  style={{ backgroundColor: (c.color ?? '#00897b') + '22' }}
                >
                  {c.avatar_emoji}
                </span>
                <span className="font-medium text-ink">{c.name}</span>
              </div>
              <span className="font-display font-semibold text-ink">{c.coin_balance} 🪙</span>
            </Card>
          ))}
        </div>
      </section>

      <Link
        href="/dodaj"
        className="rounded-app bg-teal py-3 text-center font-medium text-white shadow-card"
      >
        + Dodaj zadanie
      </Link>
    </main>
  )
}

function StatTile({
  href,
  value,
  label,
  highlight,
}: {
  href: string
  value: number
  label: string
  highlight?: boolean
}) {
  return (
    <Link href={href}>
      <Card className={'flex flex-col items-center py-4 ' + (highlight ? 'ring-2 ring-teal' : '')}>
        <span className="font-display text-3xl font-bold text-ink">{value}</span>
        <span className="text-center text-xs text-ink-3">{label}</span>
      </Card>
    </Link>
  )
}
