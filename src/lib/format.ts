import { formatDistanceToNow, isPast } from 'date-fns'
import { pl } from 'date-fns/locale'

// Czytelny opis deadline'u po polsku, np. "za 3 godziny" / "wygasło".
export function formatDeadline(expiresAt: string): { text: string; expired: boolean } {
  const date = new Date(expiresAt)
  if (isPast(date)) {
    return { text: 'wygasło', expired: true }
  }
  return { text: 'za ' + formatDistanceToNow(date, { locale: pl }), expired: false }
}

// Pełna data po polsku.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Liczba monet → "X PLN" (reguła #1: 1 moneta = 1 PLN).
export function coinsToPln(coins: number): string {
  return `${coins} PLN`
}
