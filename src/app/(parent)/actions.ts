'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { TASK_TEMPLATES } from '@/lib/templates'
import type { DeadlineType } from '@/types'

export type ActionResult = { ok: true } | { ok: false; error: string }

// Oblicza expires_at na podstawie typu deadline'u.
//  - end_of_day → dziś 23:59 lokalnego czasu (reguła #3)
//  - week       → +7 dni (reguła #4)
function computeExpiry(deadline: DeadlineType): string {
  const now = new Date()
  if (deadline === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() + 7)
    return d.toISOString()
  }
  // end_of_day (i custom traktujemy jak dziś 23:59 w razie braku daty)
  const eod = new Date(now)
  eod.setHours(23, 59, 0, 0)
  return eod.toISOString()
}

// Sprawdza, czy istnieje już otwarte zadanie z tego samego szablonu (reguła #9).
export async function checkDuplicate(templateId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId)
    .eq('status', 'open')
  return (count ?? 0) > 0
}

// Tworzy zadanie z szablonu. force=true pomija ostrzeżenie o duplikacie.
export async function createTaskFromTemplate(
  templateId: string,
  deadline: DeadlineType,
  force = false
): Promise<ActionResult & { duplicate?: boolean }> {
  const template = TASK_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return { ok: false, error: 'Nieznany szablon' }

  if (!force && (await checkDuplicate(templateId))) {
    return { ok: false, error: 'Takie zadanie jest już otwarte', duplicate: true }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Nie zalogowano' }

  const { error } = await supabase.from('tasks').insert({
    title: template.title,
    description: template.description,
    emoji: template.emoji,
    template_id: template.id,
    created_by: user.id,
    coins_reward: template.default_coins,
    difficulty: template.default_difficulty,
    deadline_type: deadline,
    expires_at: computeExpiry(deadline),
    status: 'open',
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/panel')
  revalidatePath('/dodaj')
  return { ok: true }
}

// Zatwierdzenie zgłoszenia → atomowe przyznanie monet (RPC).
export async function approveSubmission(
  submissionId: string,
  bonusCoins = 0,
  feedback?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('approve_submission', {
    p_submission_id: submissionId,
    p_bonus_coins: bonusCoins,
    p_feedback: feedback ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/zatwierdz')
  revalidatePath('/panel')
  return { ok: true }
}

// Odrzucenie zgłoszenia (zadanie wraca do 'claimed').
export async function rejectSubmission(
  submissionId: string,
  feedback?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reject_submission', {
    p_submission_id: submissionId,
    p_feedback: feedback ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/zatwierdz')
  revalidatePath('/panel')
  return { ok: true }
}

// Oznaczenie wypłaty jako zapłaconej (po przelewie, reguła #6).
export async function markWithdrawalPaid(
  withdrawalId: string,
  note?: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_withdrawal_paid', {
    p_withdrawal_id: withdrawalId,
    p_note: note ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/wyplaty')
  revalidatePath('/panel')
  return { ok: true }
}
