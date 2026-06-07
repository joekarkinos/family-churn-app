import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Determine role and redirect
  const { data: user } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (user?.role === 'parent') {
    redirect('/panel')
  } else {
    redirect('/zadania')
  }
}
