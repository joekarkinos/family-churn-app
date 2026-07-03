import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { TaskCard } from '@/components/tasks/TaskCard'
import type { Task } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ZadaniaPage() {
  await requireUser('parent')
  const supabase = await createClient()

  // Otwarte + wygasłe — rodzic musi widzieć wygasłe, żeby móc je reaktywować.
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['open', 'expired'])
    .order('expires_at', { ascending: true })

  const allTasks = (tasks ?? []) as Task[]
  const openCount = allTasks.filter((t) => t.status === 'open').length
  const expiredCount = allTasks.length - openCount

  return (
    <main className="flex flex-col gap-5 px-4 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/panel" className="text-ink-3 hover:text-ink">←</Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Zadania</h1>
          <p className="text-sm text-ink-3">
            {openCount} otwartych{expiredCount > 0 ? ` · ${expiredCount} wygasłych` : ''}
          </p>
        </div>
      </header>

      {allTasks.length === 0 ? (
        <p className="text-center text-ink-3 py-12">Brak zadań</p>
      ) : (
        <div className="flex flex-col gap-3">
          {allTasks.map((task) => (
            <TaskCard key={task.id} task={task} showStatus canReactivate />
          ))}
        </div>
      )}
    </main>
  )
}
