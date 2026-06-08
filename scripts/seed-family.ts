/**
 * Seed rodziny Karkinosów jako użytkowników Supabase Auth + profili app_users.
 *
 * Model "PIN bramkuje Supabase Auth":
 *   - każdy członek rodziny = użytkownik Auth z deterministycznym e-mailem,
 *   - hasło Auth jest wyprowadzane z AUTH_DERIVE_SECRET (nieznane nikomu),
 *   - PIN (bcrypt) trafia do app_users.pin_hash i służy do logowania w UI.
 *
 * Uruchomienie:
 *   npx tsx scripts/seed-family.ts
 *
 * Wymagane zmienne środowiskowe (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   AUTH_DERIVE_SECRET           — losowy długi sekret
 * Opcjonalnie PIN-y (domyślnie poniżej): PIN_TATA, PIN_MAMA, PIN_HANIA, PIN_MARIA, PIN_SONIA
 */
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { authEmail, derivePassword } from '../src/lib/auth/credentials'
import type { UserRole } from '../src/types'

type SeedPerson = {
  name: string
  role: UserRole
  avatar_emoji: string
  color: string
  pinEnv: string
  pinDefault: string
}

const FAMILY: SeedPerson[] = [
  { name: 'Tata',  role: 'parent', avatar_emoji: '👨', color: '#2e7d32', pinEnv: 'PIN_TATA',  pinDefault: '1111' },
  { name: 'Mama',  role: 'parent', avatar_emoji: '👩', color: '#1565c0', pinEnv: 'PIN_MAMA',  pinDefault: '2222' },
  { name: 'Hania', role: 'child',  avatar_emoji: '🧒', color: '#00897b', pinEnv: 'PIN_HANIA', pinDefault: '3333' },
  { name: 'Maria', role: 'child',  avatar_emoji: '👧', color: '#8e24aa', pinEnv: 'PIN_MARIA', pinDefault: '4444' },
  { name: 'Sonia', role: 'child',  avatar_emoji: '👩‍🦰', color: '#e53935', pinEnv: 'PIN_SONIA', pinDefault: '5555' },
]

function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`✖ Brak zmiennej środowiskowej: ${key}`)
    process.exit(1)
  }
  return v
}

async function main() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const deriveSecret = requireEnv('AUTH_DERIVE_SECRET')

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  for (const person of FAMILY) {
    const email = authEmail(person.name)
    const pin = process.env[person.pinEnv] ?? person.pinDefault

    // 1) Utwórz (lub znajdź istniejącego) użytkownika Auth z tymczasowym hasłem.
    let userId: string
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: 'tymczasowe-' + person.name, // nadpisane poniżej hasłem wyprowadzonym
      user_metadata: { name: person.name },
    })

    if (created.error) {
      // Najpewniej użytkownik już istnieje — odszukaj po e-mailu.
      const { data: list, error: listErr } = await admin.auth.admin.listUsers()
      if (listErr) throw listErr
      const existing = list.users.find((u) => u.email === email)
      if (!existing) throw created.error
      userId = existing.id
      console.log(`• ${person.name}: użytkownik już istnieje`)
    } else {
      userId = created.data.user.id
      console.log(`• ${person.name}: utworzono użytkownika Auth`)
    }

    // 2) Ustaw ostateczne, wyprowadzone hasło Auth (nieznane nikomu).
    const password = derivePassword(userId, deriveSecret)
    const upd = await admin.auth.admin.updateUserById(userId, { password })
    if (upd.error) throw upd.error

    // 3) Zahashuj PIN i zapisz profil app_users.
    const pin_hash = await bcrypt.hash(pin, 10)
    const { error: profileErr } = await admin.from('app_users').upsert(
      {
        id: userId,
        name: person.name,
        role: person.role,
        avatar_emoji: person.avatar_emoji,
        color: person.color,
        pin_hash,
      },
      { onConflict: 'id' }
    )
    if (profileErr) throw profileErr
    console.log(`  ↳ profil zapisany (rola: ${person.role}, PIN: ${pin})`)
  }

  console.log('\n✓ Seed rodziny zakończony.')
}

main().catch((err) => {
  console.error('✖ Seed nie powiódł się:', err)
  process.exit(1)
})
