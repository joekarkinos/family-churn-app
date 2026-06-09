'use client'

import { Loader2 } from 'lucide-react'

// Pełnoekranowa nakładka pokazywana, gdy trwa żądanie do serwera.
// Każdy komponent z useTransition renderuje <LoadingOverlay show={pending} />.
// Pozycja fixed → zakrywa cały ekran niezależnie od miejsca montażu.
export function LoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Ładowanie"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 rounded-app bg-white px-8 py-6 shadow-card">
        <Loader2 className="h-8 w-8 animate-spin text-teal" />
        <span className="font-display text-sm text-ink-2">Czekaj…</span>
      </div>
    </div>
  )
}
