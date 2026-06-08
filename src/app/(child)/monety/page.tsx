import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { WalletCard } from '@/components/wallet/WalletCard'
import { TransactionHistory } from '@/components/wallet/TransactionHistory'
import { WithdrawalForm } from '@/components/wallet/WithdrawalForm'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'
import type { CoinTransaction, WithdrawalRequest } from '@/types'

export const dynamic = 'force-dynamic'

const WD_STATUS: Record<WithdrawalRequest['status'], { label: string; tone: 'amber' | 'green' | 'red' }> = {
  pending: { label: 'Oczekuje', tone: 'amber' },
  approved: { label: 'Zatwierdzona', tone: 'amber' },
  paid: { label: 'Wypłacona', tone: 'green' },
  rejected: { label: 'Odrzucona', tone: 'red' },
}

export default async function MonetyPage() {
  const user = await requireUser('child')
  const supabase = await createClient()

  const [{ data: txData }, { data: wdData }] = await Promise.all([
    supabase
      .from('coin_transactions')
      .select('*')
      .eq('child_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('child_id', user.id)
      .order('requested_at', { ascending: false })
      .limit(20),
  ])

  const transactions = (txData ?? []) as CoinTransaction[]
  const withdrawals = (wdData ?? []) as WithdrawalRequest[]

  return (
    <main className="flex flex-col gap-5 px-4 pt-6">
      <WalletCard balance={user.coin_balance} />

      <Card>
        <h2 className="mb-3 font-display font-semibold text-ink">Wypłata</h2>
        <WithdrawalForm balance={user.coin_balance} />
      </Card>

      {withdrawals.length > 0 && (
        <section>
          <h2 className="mb-2 font-display font-semibold text-ink">Prośby o wypłatę</h2>
          <div className="flex flex-col gap-2">
            {withdrawals.map((wd) => (
              <Card key={wd.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-ink">{wd.amount_coins} 🪙 ({wd.amount_pln} PLN)</p>
                  <p className="text-xs text-ink-3">{formatDate(wd.requested_at)}</p>
                </div>
                <Badge tone={WD_STATUS[wd.status].tone}>{WD_STATUS[wd.status].label}</Badge>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display font-semibold text-ink">Historia</h2>
        <Card>
          <TransactionHistory transactions={transactions} />
        </Card>
      </section>
    </main>
  )
}
