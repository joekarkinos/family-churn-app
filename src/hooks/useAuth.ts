'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

export interface AuthUser {
  id: string
  name: string
  role: UserRole
  avatar_emoji: string
  color: string | null
  coin_balance: number
}

// Hook kliencki: zwraca zalogowanego użytkownika i stan ładowania.
// Do ochrony tras służy middleware — ten hook to wygoda dla komponentów klienta.
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function load() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) {
        if (active) {
          setUser(null)
          setLoading(false)
        }
        return
      }
      const { data } = await supabase
        .from('app_users')
        .select('id, name, role, avatar_emoji, color, coin_balance')
        .eq('id', authUser.id)
        .single()
      if (active) {
        setUser((data as AuthUser) ?? null)
        setLoading(false)
      }
    }

    load()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load())

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
