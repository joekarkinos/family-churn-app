'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { logout } from '@/app/(auth)/actions'

export function LogoutButton() {
  const [pending, startTransition] = useTransition()
  return (
    <>
      <LoadingOverlay show={pending} />
      <Button
        variant="secondary"
        fullWidth
        disabled={pending}
        onClick={() => startTransition(() => logout())}
      >
        Wyloguj się
      </Button>
    </>
  )
}
