import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { TaskCard } from '@/components/tasks/TaskCard'
import type { Task } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ZadaniaPage() {
  await requireUser('parent')
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .order('expires_at', { ascending: true })

  const openTasks = (tasks ?? []) as Task[]

  return (
    <main className="flex flex-col gap-5 px-4 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/panel" className="text-ink-3 hover:text-ink">←</Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Otwarte zadania</h1>
          <p className="text-sm text-ink-3">{openTasks.length} dostępnych</p>
        </div>
      </header>

      {openTasks.length === 0 ? (
        <p className="text-center text-ink-3 py-12">Brak otwartych zadań</p>
      ) : (
        <div className="flex flex-col gap-3">
          {openTasks.map((task) => (
            <TaskCard key={task.id} task={task} showStatus />
          ))}
        </div>
      )}
    </main>
  )
}
