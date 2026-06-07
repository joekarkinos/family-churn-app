import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import {
  WithdrawalManageCard,
  type PendingWithdrawal,
} from '@/components/wallet/WithdrawalManageCard'

export const dynamic = 'force-dynamic'

export default async function WyplatyPage() {
  await requireUser('parent')
  const supabase = await createClient()

  const { data } = await supabase
    .from('withdrawal_requests')
    .select(
      `id, amount_coins, amount_pln, requested_at,
       child:app_users!withdrawal_requests_child_id_fkey(name, avatar_emoji)`
    )
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })

  const withdrawals: PendingWithdrawal[] = (data ?? []).map((row: any) => ({
    id: row.id,
    amount_coins: row.amount_coins,
    amount_pln: row.amount_pln,
    requested_at: row.requested_at,
    childName: row.child?.name ?? '—',
    childEmoji: row.child?.avatar_emoji ?? '👤',
  }))

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Wypłaty</h1>
      <p className="mb-4 text-sm text-ink-3">
        Zrób przelew w Millennium, potem kliknij „Zapłacono”.
      </p>

      {withdrawals.length === 0 ? (
        <div className="mt-16 text-center text-ink-3">
          <p className="text-4xl mb-2">💸</p>
          <p>Brak próśb o wypłatę.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {withdrawals.map((w) => (
            <WithdrawalManageCard key={w.id} withdrawal={w} />
          ))}
        </div>
      )}
    </main>
  )
}
