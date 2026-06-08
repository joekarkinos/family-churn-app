import { requireUser } from '@/lib/auth/session'
import { CreateTaskPicker } from '@/components/tasks/CreateTaskPicker'

export const dynamic = 'force-dynamic'

export default async function DodajPage() {
  await requireUser('parent')
  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 font-display text-2xl font-bold text-ink">Dodaj zadanie</h1>
      <CreateTaskPicker />
    </main>
  )
}
