import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

interface ChildStat {
  id: string
  name: string
  avatar_emoji: string
  color: string | null
  coin_balance: number
  doneTasks: number
  earnedTotal: number
}

export default async function StatystykiPage() {
  await requireUser('parent')
  const supabase = await createClient()

  const { data: children } = await supabase
    .from('app_users')
    .select('id, name, avatar_emoji, color, coin_balance')
    .eq('role', 'child')
    .order('name')

  const stats: ChildStat[] = await Promise.all(
    (children ?? []).map(async (c) => {
      const [{ count: doneTasks }, { data: earned }] = await Promise.all([
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('claimed_by', c.id)
          .eq('status', 'done'),
        supabase
          .from('coin_transactions')
          .select('amount')
          .eq('child_id', c.id)
          .gt('amount', 0),
      ])
      const earnedTotal = (earned ?? []).reduce((s, t) => s + (t.amount ?? 0), 0)
      return {
        id: c.id,
        name: c.name,
        avatar_emoji: c.avatar_emoji,
        color: c.color,
        coin_balance: c.coin_balance,
        doneTasks: doneTasks ?? 0,
        earnedTotal,
      }
    })
  )

  const maxEarned = Math.max(1, ...stats.map((s) => s.earnedTotal))
  const ranked = [...stats].sort((a, b) => b.earnedTotal - a.earnedTotal)

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 font-display text-2xl font-bold text-ink">Statystyki</h1>

      <div className="flex flex-col gap-3">
        {ranked.map((s, i) => (
          <Card key={s.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                  style={{ backgroundColor: (s.color ?? '#00897b') + '22' }}
                >
                  {s.avatar_emoji}
                </span>
                <div>
                  <p className="font-medium text-ink">
                    {i === 0 && '🏆 '}
                    {s.name}
                  </p>
                  <p className="text-xs text-ink-3">{s.doneTasks} ukończonych zadań</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-ink">{s.earnedTotal} 🪙</p>
                <p className="text-xs text-ink-3">saldo: {s.coin_balance}</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink/5">
              <div
                className="h-full rounded-full bg-teal"
                style={{ width: `${(s.earnedTotal / maxEarned) * 100}%` }}
              />
            </div>
          </Card>
        ))}
      </div>
    </main>
  )
}
