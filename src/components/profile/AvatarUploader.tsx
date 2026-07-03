'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { buildAvatarPath } from '@/lib/avatar/path'
import { resizeToSquareWebp } from '@/lib/avatar/resize'
import { setAvatarUrl } from '@/app/(child)/profile-actions'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

export function AvatarUploader({
  targetUserId,
  label = 'Zmień zdjęcie',
}: {
  targetUserId: string
  label?: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // pozwól wybrać ten sam plik ponownie
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Wybierz plik graficzny')
      return
    }

    setBusy(true)
    try {
      const blob = await resizeToSquareWebp(file)
      const path = buildAvatarPath(targetUserId)
      const supabase = createClient()
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/webp' })
      if (upErr) {
        toast.error('Nie udało się wgrać zdjęcia')
        return
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const res = await setAvatarUrl(data.publicUrl, targetUserId)
      if (res.ok) {
        toast.success('Zdjęcie zaktualizowane')
        router.refresh()
      } else {
        toast.error(res.error)
      }
    } catch {
      toast.error('Nie udało się przetworzyć obrazu')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <LoadingOverlay show={busy} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="text-sm font-medium text-teal underline disabled:opacity-60"
      >
        {label}
      </button>
    </>
  )
}
