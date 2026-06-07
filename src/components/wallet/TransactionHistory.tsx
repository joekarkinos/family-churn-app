import { formatDate } from '@/lib/format'
import type { CoinTransaction } from '@/types'

const TYPE_LABEL: Record<CoinTransaction['type'], string> = {
  earned: 'Zarobione',
  bonus: 'Bonus',
  withdrawn: 'Wypłata',
  adjusted: 'Korekta',
}

export function TransactionHistory({ transactions }: { transactions: CoinTransaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-ink-3">Brak transakcji.</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {transactions.map((tx) => {
        const positive = tx.amount >= 0
        return (
          <li key={tx.id} className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {tx.note ?? TYPE_LABEL[tx.type]}
              </p>
              <p className="text-xs text-ink-3">{formatDate(tx.created_at)}</p>
            </div>
            <span
              className={
                'font-display font-semibold ' + (positive ? 'text-green-600' : 'text-red-500')
              }
            >
              {positive ? '+' : ''}
              {tx.amount} 🪙
            </span>
          </li>
        )
      })}
    </ul>
  )
}
