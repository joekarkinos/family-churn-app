// Dane wejściowe formularza szablonu (bez id — id nadaje serwer).
export interface TemplateInput {
  title: string
  description: string
  emoji: string
  default_coins: number
  default_difficulty: import('@/types').TaskDifficulty
  suggested_checklist: string[]
  room: string | null
}
