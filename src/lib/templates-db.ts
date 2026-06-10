import { createClient } from '@/lib/supabase/server'
import type { TaskTemplate } from '@/types'

// Pobiera wszystkie szablony z bazy (źródło prawdy), sortowane po tytule.
// Błąd → log + pusta lista (UI pokaże brak szablonów zamiast się wywalić).
export async function getTemplates(): Promise<TaskTemplate[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('task_templates')
    .select('id, title, description, emoji, default_coins, default_difficulty, suggested_checklist, room')
    .order('title', { ascending: true })

  if (error) {
    console.error('getTemplates error:', error)
    return []
  }
  return (data ?? []) as TaskTemplate[]
}

// Pojedynczy szablon po id (np. do checklisty na szczególe zadania).
// Brak/usunięty → null.
export async function getTemplate(id: string): Promise<TaskTemplate | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('task_templates')
    .select('id, title, description, emoji, default_coins, default_difficulty, suggested_checklist, room')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as TaskTemplate
}
