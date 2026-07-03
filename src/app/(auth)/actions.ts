'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { authEmail, derivePassword } from '@/lib/auth/credentials'
import type { UserRole } from '@/types'

export interface FamilyMember {
  id: string
  name: string
  role: UserRole
  avatar_emoji: string
  avatar_url: string | null
  color: string | null
}

// Lista osób do ekranu wyboru. Czytane service-rolem, bo użytkownik jest
// jeszcze niezalogowany (RLS blokuje anon). Zwracamy WYŁĄCZNIE pola publiczne —
// nigdy pin_hash ani danych bankowych.
export async function getFamilyMembers(): Promise<FamilyMember[]> {
  noStore() // nie cache'uj — avatar_url zmienia się przy zmianie zdjęcia
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('app_users')
    .select('id, name, role, avatar_emoji, color, avatar_url')
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('getFamilyMembers error:', error)
    return []
  }
  return data ?? []
}

export type LoginResult = { ok: true; role: UserRole } | { ok: false; error: string }

// Weryfikacja PIN-u, a następnie zalogowanie ukrytym hasłem Auth.
export async function loginWithPin(userId: string, pin: string): Promise<LoginResult> {
  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, error: 'PIN musi mieć 4 cyfry' }
  }

  const admin = createAdminClient()
  const { data: user, error } = await admin
    .from('app_users')
    .select('id, name, role, pin_hash')
    .eq('id', userId)
    .single()

  if (error || !user) {
    return { ok: false, error: 'Nie znaleziono osoby' }
  }

  const pinOk = await bcrypt.compare(pin, user.pin_hash)
  if (!pinOk) {
    return { ok: false, error: 'Nieprawidłowy PIN' }
  }

  // PIN poprawny → zaloguj prawdziwą sesję Supabase ukrytym hasłem.
  const secret = process.env.AUTH_DERIVE_SECRET
  if (!secret) {
    console.error('Brak AUTH_DERIVE_SECRET')
    return { ok: false, error: 'Błąd konfiguracji serwera' }
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: authEmail(user.name),
    password: derivePassword(user.id, secret),
  })

  if (signInError) {
    console.error('signIn error:', signInError)
    return { ok: false, error: 'Logowanie nie powiodło się' }
  }

  return { ok: true, role: user.role as UserRole }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
