import { requireUser } from '@/lib/auth/session'
import { Card } from '@/components/ui/Card'
import { LogoutButton } from '@/components/auth/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function ProfilPage() {
  const user = await requireUser('child')

  return (
    <main className="flex flex-col gap-5 px-4 pt-6">
      <div className="flex flex-col items-center gap-2">
        <span
          className="flex h-24 w-24 items-center justify-center rounded-full text-5xl"
          style={{ backgroundColor: (user.color ?? '#00897b') + '22' }}
        >
          {user.avatar_emoji}
        </span>
        <h1 className="font-display text-2xl font-bold text-ink">{user.name}</h1>
        <p className="text-ink-3">{user.coin_balance} 🪙 na koncie</p>
      </div>

      <Card>
        <LogoutButton />
      </Card>
    </main>
  )
}
