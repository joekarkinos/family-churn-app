'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { reactivateTask } from '@/app/(parent)/actions'

export function ReactivateButton({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const res = await reactivateTask(taskId)
      if (res.ok) {
        toast.success('Zadanie reaktywowane!')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <>
      <LoadingOverlay show={pending} />
      <button
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-medium text-teal underline disabled:opacity-60"
      >
        Reaktywuj
      </button>
    </>
  )
}
