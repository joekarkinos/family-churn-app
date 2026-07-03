'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/format'

export type DutyActionResult = { ok: true; message?: string } | { ok: false; error: string }

// Dziecko na dyżurze prosi siostry o zastępstwo (dziś).
export async function requestDutySwap(dutyDate: string): Promise<DutyActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('request_duty_swap', { p_duty_date: dutyDate })
  if (error) return { ok: false, error: tłumaczBłąd(error.message) }
  revalidatePath('/zadania')
  return { ok: true, message: 'Poproszono siostry o zastępstwo' }
}

// Siostra akceptuje zastępstwo (kto pierwszy, ten bierze). Zwraca komunikat o oddanym dniu.
export async function acceptDutySwap(requestId: string): Promise<DutyActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_duty_swap', { p_request_id: requestId })
  if (error) return { ok: false, error: tłumaczBłąd(error.message) }
  revalidatePath('/zadania')
  // RPC zwraca setof jednego wiersza (swap_date, given_back_date).
  const row = Array.isArray(data) ? data[0] : data
  const back = row?.given_back_date
  const message = back
    ? `Bierzesz dziś dyżur. Siostra odda Ci dzień ${formatDate(back + 'T00:00:00')}`
    : 'Bierzesz dziś dyżur'
  return { ok: true, message }
}

// Prosząca wycofuje własną prośbę.
export async function cancelDutySwap(requestId: string): Promise<DutyActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_duty_swap', { p_request_id: requestId })
  if (error) return { ok: false, error: tłumaczBłąd(error.message) }
  revalidatePath('/zadania')
  return { ok: true, message: 'Anulowano prośbę' }
}

// Komunikaty z RPC już są po polsku; reszta to fallback.
function tłumaczBłąd(msg: string): string {
  if (msg.includes('row-level security')) return 'Brak uprawnień do tej operacji'
  if (msg.includes('duty_swap_one_pending_per_date')) return 'Prośba o zastępstwo na ten dzień już istnieje'
  return msg
}
