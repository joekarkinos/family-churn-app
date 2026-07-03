import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { DifficultyBadge, StatusBadge, CoinBadge } from '@/components/ui/Badge'
import { ReactivateButton } from '@/components/tasks/ReactivateButton'
import { formatDeadline } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Task } from '@/types'

interface TaskCardProps {
  task: Task
  href?: string
  showStatus?: boolean
  canReactivate?: boolean
}

export function TaskCard({ task, href, showStatus, canReactivate }: TaskCardProps) {
  const deadline = formatDeadline(task.expires_at)
  const isWeek = task.deadline_type === 'week'
  const isExpired = task.status === 'expired' || deadline.expired

  const content = (
    <Card interactive={!!href} className="flex items-start gap-3">
      <span className="text-3xl leading-none">{task.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-ink truncate">{task.title}</h3>
          <CoinBadge coins={task.coins_reward} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={task.difficulty} />
          {showStatus && <StatusBadge status={task.status} />}
          {isWeek && <span className="text-xs text-teal font-medium">⭐ tydzień</span>}
          <span
            className={cn(
              'text-xs',
              deadline.expired ? 'text-red-500' : 'text-ink-3'
            )}
          >
            {deadline.text}
          </span>
          {canReactivate && !href && isExpired && <ReactivateButton taskId={task.id} />}
        </div>
      </div>
    </Card>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
