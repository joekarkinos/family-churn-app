import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { getTemplates } from '@/lib/templates-db'
import { CreateTaskPicker } from '@/components/tasks/CreateTaskPicker'

export const dynamic = 'force-dynamic'

export default async function DodajPage() {
  await requireUser('parent')
  const templates = await getTemplates()

  return (
    <main className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-ink">Dodaj zadanie</h1>
        <Link href="/szablony" className="text-sm font-medium text-teal">
          ⚙️ Zarządzaj szablonami
        </Link>
      </div>
      <CreateTaskPicker templates={templates} />
    </main>
  )
}
