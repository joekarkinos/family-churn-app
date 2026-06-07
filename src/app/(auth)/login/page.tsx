import { getFamilyMembers } from '../actions'
import { PersonPicker } from '@/components/auth/PersonPicker'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const members = await getFamilyMembers()

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <p className="font-display text-sm uppercase tracking-widest text-teal">ZadaniaDom</p>
      </div>
      <PersonPicker members={members} />
    </main>
  )
}
