'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/templates-db'
import type { DeadlineType, TaskDifficulty } from '@/types'
import type { TemplateInput } from '@/lib/templates'

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
  const template = await getTemplate(templateId)
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

// Reaktywacja wygasłego zadania: nowy termin (ten sam typ), wraca do puli otwartych.
// Czyścimy claimed_by/claimed_at — reguła #2 (1 zadanie = 1 wykonawca).
export async function reactivateTask(taskId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: task, error: fetchErr } = await supabase
    .from('tasks')
    .select('deadline_type')
    .eq('id', taskId)
    .single()
  if (fetchErr || !task) return { ok: false, error: 'Zadanie nie istnieje' }

  // .select() zwraca zaktualizowane wiersze — brak wierszy (np. blokada RLS
  // albo zadanie zniknęło) traktujemy jako błąd, żeby nie pokazać fałszywego sukcesu.
  const { data: updated, error } = await supabase
    .from('tasks')
    .update({
      status: 'open',
      expires_at: computeExpiry(task.deadline_type as DeadlineType),
      claimed_by: null,
      claimed_at: null,
    })
    .eq('id', taskId)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!updated || updated.length === 0) {
    return { ok: false, error: 'Nie udało się reaktywować zadania' }
  }
  revalidatePath('/zadania-rodzic') // lista rodzica
  revalidatePath('/zadania') // reaktywowane zadanie wraca też do puli dziecka
  revalidatePath('/panel')
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

// ─── Szablony zadań (CRUD, tylko rodzic) ───────────────────────────

const DIFFICULTIES: TaskDifficulty[] = ['easy', 'medium', 'hard']

// Walidacja wspólna dla create/update. Zwraca oczyszczone dane lub błąd.
function validateTemplate(
  input: TemplateInput
): { ok: true; value: TemplateInput } | { ok: false; error: string } {
  const title = input.title?.trim() ?? ''
  if (!title) return { ok: false, error: 'Tytuł nie może być pusty' }

  if (!Number.isInteger(input.default_coins) || input.default_coins < 1) {
    return { ok: false, error: 'Nagroda musi być liczbą całkowitą ≥ 1' }
  }

  if (!DIFFICULTIES.includes(input.default_difficulty)) {
    return { ok: false, error: 'Nieprawidłowy poziom trudności' }
  }

  if (input.suggested_checklist != null && !Array.isArray(input.suggested_checklist)) {
    return { ok: false, error: 'Lista kroków ma nieprawidłowy format' }
  }
  const checklist = (input.suggested_checklist ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const room = input.room?.trim() || null
  const emoji = input.emoji?.trim() || '📋'

  return {
    ok: true,
    value: {
      title,
      description: input.description?.trim() ?? '',
      emoji,
      default_coins: input.default_coins,
      default_difficulty: input.default_difficulty,
      suggested_checklist: checklist,
      room,
    },
  }
}

export async function createTemplate(input: TemplateInput): Promise<ActionResult> {
  const v = validateTemplate(input)
  if (!v.ok) return { ok: false, error: v.error }

  const supabase = await createClient()
  const id = crypto.randomUUID()
  const { error } = await supabase.from('task_templates').insert({
    id,
    title: v.value.title,
    description: v.value.description,
    emoji: v.value.emoji,
    default_coins: v.value.default_coins,
    default_difficulty: v.value.default_difficulty,
    suggested_checklist: v.value.suggested_checklist,
    room: v.value.room,
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/szablony')
  revalidatePath('/dodaj')
  return { ok: true }
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Brak identyfikatora szablonu' }
  const v = validateTemplate(input)
  if (!v.ok) return { ok: false, error: v.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('task_templates')
    .update({
      title: v.value.title,
      description: v.value.description,
      emoji: v.value.emoji,
      default_coins: v.value.default_coins,
      default_difficulty: v.value.default_difficulty,
      suggested_checklist: v.value.suggested_checklist,
      room: v.value.room,
    })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/szablony')
  revalidatePath('/dodaj')
  return { ok: true }
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Brak identyfikatora szablonu' }

  const supabase = await createClient()
  const { error } = await supabase.from('task_templates').delete().eq('id', id)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/szablony')
  revalidatePath('/dodaj')
  return { ok: true }
}
