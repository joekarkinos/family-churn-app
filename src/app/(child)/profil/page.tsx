import { requireUser } from '@/lib/auth/session'
import { Card } from '@/components/ui/Card'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarUploader } from '@/components/profile/AvatarUploader'

export const dynamic = 'force-dynamic'

export default async function ProfilPage() {
  const user = await requireUser('child')

  return (
    <main className="flex flex-col gap-5 px-4 pt-6">
      <div className="flex flex-col items-center gap-2">
        <Avatar url={user.avatar_url} emoji={user.avatar_emoji} color={user.color} size={96} alt={user.name} />
        <h1 className="font-display text-2xl font-bold text-ink">{user.name}</h1>
        <p className="text-ink-3">{user.coin_balance} 🪙 na koncie</p>
        <AvatarUploader targetUserId={user.id} />
      </div>

      <Card>
        <LogoutButton />
      </Card>
    </main>
  )
}
