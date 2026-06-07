import { requireUser } from '@/lib/auth/session'
import { BottomNav } from '@/components/ui/BottomNav'

export const dynamic = 'force-dynamic'

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  await requireUser('child')
  return (
    <div className="min-h-dvh pb-20">
      {children}
      <BottomNav role="child" />
    </div>
  )
}
