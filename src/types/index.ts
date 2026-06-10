// ─── User / Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'parent' | 'child'

export interface AppUser {
  id: string
  name: string
  role: UserRole
  avatar_emoji: string
  color?: string            // akcent osoby (np. turkusowy dla Hani)
  pin_hash: string          // bcrypt hash, never stored in client state
  coin_balance: number
  bank_account_last4?: string  // Millennium Junior account, last 4 digits
  created_at: string
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskDifficulty = 'easy' | 'medium' | 'hard'
export type TaskStatus = 'open' | 'claimed' | 'in_review' | 'done' | 'expired'
export type DeadlineType = 'end_of_day' | 'week' | 'custom'

export interface Task {
  id: string
  title: string
  description?: string
  emoji: string
  photo_url?: string           // zdjęcie dodane przez rodzica przy tworzeniu
  template_id?: string
  created_by: string           // user id rodzica
  assigned_to?: string         // user id dziecka, null = ktokolwiek
  coins_reward: number
  difficulty: TaskDifficulty
  expires_at: string           // ISO timestamp
  deadline_type: DeadlineType
  status: TaskStatus
  requires_photo_proof: boolean
  claimed_by?: string
  claimed_at?: string
  created_at: string
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface Submission {
  id: string
  task_id: string
  child_id: string
  photo_url?: string
  note?: string
  submitted_at: string
  reviewed_at?: string
  review_status: ReviewStatus
  parent_feedback?: string
  bonus_coins?: number         // dodatkowe monety za wyjątkową pracę
}

// ─── Task Templates ──────────────────────────────────────────────────────────

export interface TaskTemplate {
  id: string
  title: string
  description: string | null     // kolumna nullable w bazie
  emoji: string
  default_coins: number
  default_difficulty: TaskDifficulty
  suggested_checklist: string[]  // lista kroków
  room: string | null            // np. "salon", "lazienka_taty"; nullable w bazie
}

// ─── Comments (dlaczego nikt nie wziął) ─────────────────────────────────────

export type CommentReason =
  | 'too_hard'
  | 'too_little_coins'
  | 'unclear'
  | 'no_time'
  | 'other'

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  reason?: CommentReason
  text?: string
  created_at: string
}

// ─── Coin Transactions ───────────────────────────────────────────────────────

export type TransactionType = 'earned' | 'withdrawn' | 'bonus' | 'adjusted'

export interface CoinTransaction {
  id: string
  child_id: string
  amount: number               // positive = earned, negative = withdrawn
  type: TransactionType
  task_id?: string
  note?: string
  created_at: string
}

// ─── Withdrawal Requests ─────────────────────────────────────────────────────

export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected'

export interface WithdrawalRequest {
  id: string
  child_id: string
  amount_coins: number
  amount_pln: number           // 1:1
  status: WithdrawalStatus
  requested_at: string
  paid_at?: string
  paid_by?: string             // parent user id
  parent_note?: string
}
