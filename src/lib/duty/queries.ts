import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { formatInTimeZone } from 'date-fns-tz'
import { effectiveDutyChildId, buildDutyCalendar, addDaysStr } from './rotation'
import type {
  DutyRotationRow,
  DutyOverride,
  DutySwapRequest,
  DutyDay,
  DutyBannerState,
} from '@/types'

const TZ = 'Europe/Warsaw'
const CALENDAR_DAYS = 5

export interface DutyView {
  today: string
  currentUserId: string
  children: Record<string, { name: string; avatar_emoji: string; color: string | null; avatar_url: string | null }>
  calendar: DutyDay[]
  banner: DutyBannerState
}

// „Dziś" w strefie Europe/Warsaw jako 'YYYY-MM-DD'.
export function warsawToday(): string {
  return formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')
}

export async function loadDutyView(): Promise<DutyView | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const today = warsawToday()
  const horizonEnd = addDaysStr(today, CALENDAR_DAYS - 1)

  const [rotRes, childRes, ovRes, reqRes] = await Promise.all([
    supabase.from('duty_rotation').select('position, child_id'),
    supabase.from('app_users').select('id, name, avatar_emoji, color, avatar_url').eq('role', 'child'),
    supabase
      .from('duty_overrides')
      .select('duty_date, child_id, source')
      .gte('duty_date', today)
      .lte('duty_date', horizonEnd),
    supabase
      .from('duty_swap_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('duty_date', today),
  ])

  if (rotRes.error || childRes.error || ovRes.error || reqRes.error) {
    return null
  }

  const rotation = (rotRes.data ?? []) as DutyRotationRow[]
  const overrides = (ovRes.data ?? []) as DutyOverride[]
  const pending = (reqRes.data ?? []) as DutySwapRequest[]

  const children: DutyView['children'] = {}
  for (const c of childRes.data ?? []) {
    children[c.id] = { name: c.name, avatar_emoji: c.avatar_emoji, color: c.color, avatar_url: c.avatar_url }
  }

  const calendar = buildDutyCalendar(today, CALENDAR_DAYS, rotation, overrides)
  const todayDutyId = effectiveDutyChildId(today, rotation, overrides)
  const todayRequest = pending[0]

  const banner = computeBanner(user.id, user.role, todayDutyId, todayRequest, children)

  return { today, currentUserId: user.id, children, calendar, banner }
}

function computeBanner(
  userId: string,
  role: 'parent' | 'child',
  todayDutyId: string | null,
  request: DutySwapRequest | undefined,
  children: DutyView['children']
): DutyBannerState {
  // Rodzic nie pełni dyżurów — zawsze widok informacyjny (kto dziś dyżuruje).
  if (role === 'parent') {
    if (todayDutyId && children[todayDutyId]) {
      return {
        kind: 'info',
        childName: children[todayDutyId].name,
        childEmoji: children[todayDutyId].avatar_emoji,
        childAvatarUrl: children[todayDutyId].avatar_url,
      }
    }
    return { kind: 'none' }
  }

  const iAmOnDuty = todayDutyId === userId

  if (iAmOnDuty) {
    if (request && request.requester_id === userId) {
      return { kind: 'awaiting', requestId: request.id }
    }
    return { kind: 'on_duty' }
  }

  // Nie ja na dyżurze: jeśli dyżurna siostra prosi o zastępstwo — zaproszenie.
  if (request && request.requester_id !== userId) {
    const requester = children[request.requester_id]
    return {
      kind: 'invited',
      requestId: request.id,
      requesterName: requester?.name ?? 'Siostra',
    }
  }

  if (todayDutyId && children[todayDutyId]) {
    return {
      kind: 'info',
      childName: children[todayDutyId].name,
      childEmoji: children[todayDutyId].avatar_emoji,
    }
  }
  return { kind: 'none' }
}
