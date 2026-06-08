'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ListTodo,
  CheckCircle2,
  Coins,
  User,
  LayoutDashboard,
  PlusCircle,
  ClipboardCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const CHILD_NAV: NavItem[] = [
  { href: '/zadania', label: 'Zadania', icon: ListTodo },
  { href: '/moje-zadania', label: 'Moje', icon: CheckCircle2 },
  { href: '/monety', label: 'Monety', icon: Coins },
  { href: '/profil', label: 'Profil', icon: User },
]

const PARENT_NAV: NavItem[] = [
  { href: '/panel', label: 'Panel', icon: LayoutDashboard },
  { href: '/dodaj', label: 'Dodaj', icon: PlusCircle },
  { href: '/zatwierdz', label: 'Zatwierdź', icon: ClipboardCheck },
  { href: '/wyplaty', label: 'Wypłaty', icon: Wallet },
]

export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = role === 'parent' ? PARENT_NAV : CHILD_NAV

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-border bg-white/95 backdrop-blur">
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                  active ? 'text-teal' : 'text-ink-3'
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 1.8} />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
