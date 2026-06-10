import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { getTemplates } from '@/lib/templates-db'
import { TemplateManager } from '@/components/tasks/TemplateManager'

export const dynamic = 'force-dynamic'

export default async function SzablonyPage() {
  await requireUser('parent')
  const templates = await getTemplates()

  return (
    <main className="px-4 pt-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-ink">Szablony zadań</h1>
        <Link href="/dodaj" className="text-sm font-medium text-teal">
          ← Dodaj zadanie
        </Link>
      </div>
      <TemplateManager templates={templates} />
    </main>
  )
}
