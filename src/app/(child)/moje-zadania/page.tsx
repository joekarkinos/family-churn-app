import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { Card } from '@/components/ui/Card'
import { StatusBadge, CoinBadge } from '@/components/ui/Badge'
import { SubmissionForm } from '@/components/tasks/SubmissionForm'
import type { Task } from '@/types'

export const dynamic = 'force-dynamic'

export default async function MojeZadaniaPage() {
  const user = await requireUser('child')
  const supabase = await createClient()

  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('claimed_by', user.id)
    .in('status', ['claimed', 'in_review', 'done'])
    .order('claimed_at', { ascending: false })

  const tasks = (data ?? []) as Task[]

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 font-display text-2xl font-bold text-ink">Moje zadania</h1>

      {tasks.length === 0 ? (
        <div className="mt-16 text-center text-ink-3">
          <p className="text-4xl mb-2">📋</p>
          <p>Nie masz jeszcze przyjętych zadań.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <Card key={task.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{task.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-semibold text-ink truncate">{task.title}</h3>
                    <CoinBadge coins={task.coins_reward} />
                  </div>
                  <div className="mt-1.5">
                    <StatusBadge status={task.status} />
                  </div>
                </div>
              </div>
              {task.status === 'claimed' && <SubmissionForm taskId={task.id} />}
              {task.status === 'in_review' && (
                <p className="text-sm text-ink-3">⏳ Czeka na sprawdzenie przez rodzica.</p>
              )}
              {task.status === 'done' && (
                <p className="text-sm text-green-600">✓ Zatwierdzone — monety na koncie!</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
