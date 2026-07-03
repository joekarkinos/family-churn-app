'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProfileActionResult = { ok: true } | { ok: false; error: string }

// Zapis URL-a zdjęcia profilowego. RLS 'app_users updatable by self or parent'
// autoryzuje: dziecko tylko siebie, rodzic siebie i dzieci.
export async function setAvatarUrl(
  url: string,
  targetUserId: string
): Promise<ProfileActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('app_users')
    .update({ avatar_url: url })
    .eq('id', targetUserId)
  if (error) {
    if (error.message.includes('row-level security')) {
      return { ok: false, error: 'Brak uprawnień do zmiany tego zdjęcia' }
    }
    return { ok: false, error: 'Nie udało się zapisać zdjęcia' }
  }
  revalidatePath('/profil')
  revalidatePath('/panel')
  return { ok: true }
}
