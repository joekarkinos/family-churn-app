// Supabase Edge Function — runs every minute via cron
// Marks expired tasks and sends push notifications to parents

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date().toISOString()

  // Expire open/claimed tasks past their deadline
  const { data: expired, error } = await supabase
    .from('tasks')
    .update({ status: 'expired' })
    .in('status', ['open', 'claimed'])
    .lt('expires_at', now)
    .select('id, title, created_by')

  if (error) {
    console.error('Expire tasks error:', error)
    return new Response(JSON.stringify({ error }), { status: 500 })
  }

  console.log(`Expired ${expired?.length ?? 0} tasks`)

  // TODO: Send push notification to parents about expired unclaimed tasks
  // Will use FCM via notify-push function

  return new Response(JSON.stringify({ expired: expired?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
