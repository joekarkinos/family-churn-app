import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import type { TaskDifficulty, TaskStatus } from '@/types'

type Tone = 'neutral' | 'teal' | 'amber' | 'green' | 'red' | 'purple'

const tones: Record<Tone, string> = {
  neutral: 'bg-ink/5 text-ink-2',
  teal: 'bg-teal-bg text-teal-dark',
  amber: 'bg-amber-bg text-amber',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-sans',
        tones[tone],
        className
      )}
      {...props}
    />
  )
}

// ─── Warianty domenowe ───────────────────────────────────────────────────────

const DIFFICULTY_META: Record<TaskDifficulty, { label: string; tone: Tone }> = {
  easy: { label: 'Łatwe', tone: 'green' },
  medium: { label: 'Średnie', tone: 'amber' },
  hard: { label: 'Trudne', tone: 'red' },
}

export function DifficultyBadge({ difficulty }: { difficulty: TaskDifficulty }) {
  const meta = DIFFICULTY_META[difficulty]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

const STATUS_META: Record<TaskStatus, { label: string; tone: Tone }> = {
  open: { label: 'Otwarte', tone: 'teal' },
  claimed: { label: 'W toku', tone: 'amber' },
  in_review: { label: 'Zgłoszone', tone: 'purple' },
  done: { label: 'Zatwierdzone', tone: 'green' },
  expired: { label: 'Wygasłe', tone: 'neutral' },
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

// Odznaka z liczbą monet.
export function CoinBadge({ coins }: { coins: number }) {
  return (
    <Badge tone="amber" className="font-semibold">
      🪙 {coins}
    </Badge>
  )
}
