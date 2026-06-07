'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { logout } from '@/app/(auth)/actions'

export function LogoutButton() {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="secondary"
      fullWidth
      disabled={pending}
      onClick={() => startTransition(() => logout())}
    >
      Wyloguj się
    </Button>
  )
}
