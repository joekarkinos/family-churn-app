import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export interface CurrentUser {
  id: string
  name: string
  role: UserRole
  avatar_emoji: string
  color: string | null
  coin_balance: number
}

// Zwraca zalogowanego użytkownika lub null. Czytane przez klienta SSR (RLS na app_users
// pozwala czytać profile zalogowanym).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('app_users')
    .select('id, name, role, avatar_emoji, color, coin_balance')
    .eq('id', user.id)
    .single()

  if (error || !data) return null
  return data as CurrentUser
}

// Wymusza zalogowanie + (opcjonalnie) rolę. Przekierowuje, jeśli brak dostępu.
export async function requireUser(role?: UserRole): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (role && user.role !== role) {
    redirect(user.role === 'parent' ? '/panel' : '/zadania')
  }
  return user
}
