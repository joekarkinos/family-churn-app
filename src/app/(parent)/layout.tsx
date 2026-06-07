import { requireUser } from '@/lib/auth/session'
import { BottomNav } from '@/components/ui/BottomNav'

export const dynamic = 'force-dynamic'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  await requireUser('parent')
  return (
    <div className="min-h-dvh pb-20">
      {children}
      <BottomNav role="parent" />
    </div>
  )
}
