// ─── User / Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'parent' | 'child'

export interface AppUser {
  id: string
  name: string
  role: UserRole
  avatar_emoji: string
  avatar_url?: string | null   // zdjęcie profilowe (ma pierwszeństwo nad emoji)
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

// ─── Dyżury (kalendarz + zastępstwa) ─────────────────────────────

export interface DutyRotationRow {
  position: number
  child_id: string
}

export interface DutyOverride {
  duty_date: string      // 'YYYY-MM-DD'
  child_id: string
  source: 'swap' | 'manual'
}

export type DutySwapStatus = 'pending' | 'accepted' | 'cancelled'

export interface DutySwapRequest {
  id: string
  duty_date: string
  requester_id: string
  status: DutySwapStatus
  accepted_by?: string | null
  created_at: string
  resolved_at?: string | null
}

export interface DutyDay {
  duty_date: string
  child_id: string | null
}

// Stan banera dyżuru dla zalogowanego dziecka na ekranie głównym.
export type DutyBannerState =
  | { kind: 'none' }                                              // brak dyżuru dziś, brak zaproszenia
  | { kind: 'info'; childName: string; childEmoji: string; childAvatarUrl?: string | null } // ktoś inny na dyżurze, brak zaproszenia
  | { kind: 'on_duty' }                                           // ja na dyżurze, mogę poprosić
  | { kind: 'awaiting'; requestId: string }                       // ja na dyżurze, czekam na zastępstwo
  | { kind: 'invited'; requestId: string; requesterName: string } // siostra prosi mnie o zastępstwo dziś

