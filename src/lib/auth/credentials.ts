import { createHmac } from 'crypto'

// ─── Model "PIN bramkuje Supabase Auth" ──────────────────────────────────────
// Każdy członek rodziny ma prawdziwego użytkownika Supabase Auth.
// E-mail jest deterministyczny (na podstawie sluga osoby), a hasło Supabase
// NIE jest nikomu znane — wyprowadzamy je z sekretu serwera + id użytkownika.
// Dzięki temu po weryfikacji PIN-u serwer może wykonać signInWithPassword,
// a żadne realne hasło nie jest przechowywane ani pokazywane.

const EMAIL_DOMAIN = 'zadaniadom.local'

/** Slug osoby używany w e-mailu logowania, np. "Hania" → "hania". */
export function personSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // usuń ogonki/akcenty
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Deterministyczny e-mail Supabase Auth dla osoby. */
export function authEmail(name: string): string {
  return `${personSlug(name)}@${EMAIL_DOMAIN}`
}

/**
 * Ukryte hasło Supabase Auth danej osoby — wyprowadzone z sekretu serwera.
 * To samo wejście (secret + userId) zawsze daje to samo hasło, więc seed i
 * logowanie liczą je niezależnie, bez przechowywania hasła w bazie.
 */
export function derivePassword(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(userId).digest('hex')
}
