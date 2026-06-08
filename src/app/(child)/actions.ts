'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { CommentReason } from '@/types'

export type ActionResult = { ok: true } | { ok: false; error: string }

// Przyjęcie zadania (reguła #2: 1 zadanie = 1 wykonawca). RPC jest atomowe.
export async function claimTask(taskId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('claim_task', { p_task_id: taskId })
  if (error) {
    return { ok: false, error: tłumaczBłąd(error.message) }
  }
  revalidatePath('/zadania')
  revalidatePath('/moje-zadania')
  return { ok: true }
}

// Zgłoszenie wykonania zadania. Tworzy submission i przełącza status zadania.
export async function submitTask(
  taskId: string,
  note: string,
  photoUrl?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Nie zalogowano' }

  const { error: subErr } = await supabase.from('submissions').insert({
    task_id: taskId,
    child_id: user.id,
    note: note || null,
    photo_url: photoUrl || null,
  })
  if (subErr) return { ok: false, error: tłumaczBłąd(subErr.message) }

  const { error: taskErr } = await supabase
    .from('tasks')
    .update({ status: 'in_review' })
    .eq('id', taskId)
    .eq('claimed_by', user.id)
  if (taskErr) return { ok: false, error: tłumaczBłąd(taskErr.message) }

  revalidatePath('/moje-zadania')
  revalidatePath('/zadania')
  return { ok: true }
}

// Komentarz: dlaczego nie wziąłem zadania (reguła #10).
export async function commentTask(
  taskId: string,
  reason: CommentReason,
  text?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Nie zalogowano' }

  const { error } = await supabase.from('task_comments').insert({
    task_id: taskId,
    user_id: user.id,
    reason,
    text: text || null,
  })
  if (error) return { ok: false, error: tłumaczBłąd(error.message) }

  revalidatePath('/zadania')
  return { ok: true }
}

// Składanie prośby o wypłatę (reguła #5: min 1 moneta).
export async function requestWithdrawal(amountCoins: number): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('request_withdrawal', { p_amount_coins: amountCoins })
  if (error) return { ok: false, error: tłumaczBłąd(error.message) }
  revalidatePath('/monety')
  return { ok: true }
}

// Komunikaty z RPC już są po polsku; reszta to fallback.
function tłumaczBłąd(msg: string): string {
  if (msg.includes('row-level security')) return 'Brak uprawnień do tej operacji'
  return msg
}
