import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { TaskCard } from '@/components/tasks/TaskCard'
import type { Task } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ZadaniaPage() {
  const user = await requireUser('child')
  const supabase = await createClient()

  // Otwarte zadania (nieprzyjęte) — RLS dodatkowo to gwarantuje.
  // expires_at > now(): wygasłe zadania znikają natychmiast, nie czekamy na cron expire-tasks.
  // Zadania tygodniowe na górze (reguła #4), potem wg najbliższego deadline'u.
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .order('deadline_type', { ascending: true }) // 'week' < 'end_of_day' alfabetycznie? -> sortujemy w JS
    .order('expires_at', { ascending: true })

  const tasks = (data ?? []) as Task[]
  // Pewne sortowanie: tygodniowe najpierw, potem reszta po deadline.
  tasks.sort((a, b) => {
    const aw = a.deadline_type === 'week' ? 0 : 1
    const bw = b.deadline_type === 'week' ? 0 : 1
    if (aw !== bw) return aw - bw
    return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
  })

  return (
    <main className="px-4 pt-6">
      <header className="mb-4">
        <p className="text-sm text-ink-3">Cześć, {user.name} {user.avatar_emoji}</p>
        <h1 className="font-display text-2xl font-bold text-ink">Dostępne zadania</h1>
      </header>

      {error && (
        <p className="text-red-500 text-sm">Nie udało się wczytać zadań.</p>
      )}

      {tasks.length === 0 && !error ? (
        <div className="mt-16 text-center text-ink-3">
          <p className="text-4xl mb-2">🎉</p>
          <p>Brak zadań do wzięcia.</p>
          <p className="text-sm">Zajrzyj później!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} href={`/zadania/${task.id}`} />
          ))}
        </div>
      )}
    </main>
  )
}
