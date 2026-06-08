import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { ReviewCard, type PendingReview } from '@/components/tasks/ReviewCard'

export const dynamic = 'force-dynamic'

export default async function ZatwierdzPage() {
  await requireUser('parent')
  const supabase = await createClient()

  // Zgłoszenia oczekujące + powiązane zadanie i dziecko (RLS pozwala rodzicowi).
  const { data } = await supabase
    .from('submissions')
    .select(
      `id, note, photo_url, submitted_at,
       child:app_users!submissions_child_id_fkey(name, avatar_emoji),
       task:tasks!submissions_task_id_fkey(title, emoji, coins_reward)`
    )
    .eq('review_status', 'pending')
    .order('submitted_at', { ascending: true })

  const reviews: PendingReview[] = (data ?? []).map((row: any) => ({
    id: row.id,
    note: row.note,
    photo_url: row.photo_url,
    submitted_at: row.submitted_at,
    childName: row.child?.name ?? '—',
    childEmoji: row.child?.avatar_emoji ?? '👤',
    taskTitle: row.task?.title ?? 'Zadanie',
    taskEmoji: row.task?.emoji ?? '📋',
    coinsReward: row.task?.coins_reward ?? 0,
  }))

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 font-display text-2xl font-bold text-ink">Do zatwierdzenia</h1>

      {reviews.length === 0 ? (
        <div className="mt-16 text-center text-ink-3">
          <p className="text-4xl mb-2">✅</p>
          <p>Brak zgłoszeń do sprawdzenia.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </main>
  )
}
