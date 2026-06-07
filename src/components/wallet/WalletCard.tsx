import { coinsToPln } from '@/lib/format'

// Karta salda monet dziecka.
export function WalletCard({ balance }: { balance: number }) {
  return (
    <div className="rounded-app bg-ink p-6 text-white shadow-lift">
      <p className="text-sm text-white/60">Twoje monety</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-5xl font-bold">{balance}</span>
        <span className="text-2xl">🪙</span>
      </div>
      <p className="mt-1 text-sm text-amber-light">= {coinsToPln(balance)}</p>
    </div>
  )
}
