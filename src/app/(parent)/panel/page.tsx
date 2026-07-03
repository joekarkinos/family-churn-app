import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { Card } from '@/components/ui/Card'
import { loadDutyView } from '@/lib/duty/queries'
import { DutyBanner } from '@/components/duty/DutyBanner'
import { DutyWeek } from '@/components/duty/DutyWeek'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarUploader } from '@/components/profile/AvatarUploader'

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
    .select('id, name, avatar_emoji, color, coin_balance, avatar_url')
    .eq('role', 'child')
    .order('name')

  const duty = await loadDutyView()

  return (
    <main className="flex flex-col gap-5 px-4 pt-6">
      <header>
        <p className="text-sm text-ink-3">Cześć, {user.name} {user.avatar_emoji}</p>
        <h1 className="font-display text-2xl font-bold text-ink">Panel rodzica</h1>
      </header>

      <Card className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <Avatar url={user.avatar_url} emoji={user.avatar_emoji} color={user.color} size={40} alt={user.name} />
          <span className="font-medium text-ink">{user.name}</span>
        </div>
        <AvatarUploader targetUserId={user.id} label="Zmień moje zdjęcie" />
      </Card>

      {duty && (
        <div>
          <DutyBanner state={duty.banner} today={duty.today} />
          <DutyWeek calendar={duty.calendar} people={duty.children} today={duty.today} />
        </div>
      )}

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
                <Avatar url={c.avatar_url} emoji={c.avatar_emoji} color={c.color} size={40} alt={c.name} />
                <div className="flex flex-col">
                  <span className="font-medium text-ink">{c.name}</span>
                  <AvatarUploader targetUserId={c.id} label="Zmień zdjęcie" />
                </div>
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
