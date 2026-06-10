import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { DifficultyBadge, CoinBadge } from '@/components/ui/Badge'
import { formatDeadline } from '@/lib/format'
import { getTemplate } from '@/lib/templates-db'
import { TaskActions } from '@/components/tasks/TaskActions'
import type { Task } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  await requireUser('child')
  const supabase = await createClient()

  const { data, error } = await supabase.from('tasks').select('*').eq('id', params.id).single()
  if (error || !data) notFound()
  const task = data as Task

  const deadline = formatDeadline(task.expires_at)
  const template = task.template_id ? await getTemplate(task.template_id) : null

  return (
    <main className="px-4 pt-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="text-5xl">{task.emoji}</span>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CoinBadge coins={task.coins_reward} />
            <DifficultyBadge difficulty={task.difficulty} />
            <span className={deadline.expired ? 'text-red-500 text-sm' : 'text-ink-3 text-sm'}>
              {deadline.text}
            </span>
          </div>
        </div>
      </div>

      {task.description && <p className="text-ink-2 mb-5">{task.description}</p>}

      {template && template.suggested_checklist.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display font-semibold text-ink mb-2">Co zrobić</h2>
          <ul className="flex flex-col gap-1.5">
            {template.suggested_checklist.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-ink-2 text-sm">
                <span className="text-teal">○</span>
                {step}
              </li>
            ))}
          </ul>
        </section>
      )}

      <TaskActions taskId={task.id} status={task.status} />
    </main>
  )
}
