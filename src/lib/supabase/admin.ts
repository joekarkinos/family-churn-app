import { createClient } from '@supabase/supabase-js'

// Klient z kluczem service_role — OMIJA RLS. Używać WYŁĄCZNIE po stronie serwera
// (server actions, route handlers, skrypty). Nigdy nie importować w komponentach klienta.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
