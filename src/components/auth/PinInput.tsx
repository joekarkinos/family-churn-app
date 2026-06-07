'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface PinInputProps {
  length?: number
  onComplete: (pin: string) => void
  disabled?: boolean
  error?: boolean
  // Klucz do wyczyszczenia/reset PIN-u z zewnątrz (np. po błędzie).
  resetSignal?: number
}

// Wprowadzanie PIN-u przez klawiaturę numeryczną na ekranie (mobile-first).
export function PinInput({
  length = 4,
  onComplete,
  disabled,
  error,
  resetSignal = 0,
}: PinInputProps) {
  const [digits, setDigits] = useState('')
  const firedRef = useRef(false)

  useEffect(() => {
    setDigits('')
    firedRef.current = false
  }, [resetSignal])

  useEffect(() => {
    if (digits.length === length && !firedRef.current) {
      firedRef.current = true
      onComplete(digits)
    }
  }, [digits, length, onComplete])

  function press(d: string) {
    if (disabled) return
    setDigits((prev) => (prev.length >= length ? prev : prev + d))
  }
  function backspace() {
    if (disabled) return
    firedRef.current = false
    setDigits((prev) => prev.slice(0, -1))
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Kropki pokazujące postęp */}
      <div className="flex gap-4" aria-label="Postęp PIN">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-colors',
              error
                ? 'border-red-500'
                : i < digits.length
                  ? 'bg-teal border-teal'
                  : 'border-ink-3'
            )}
          />
        ))}
      </div>

      {/* Klawiatura numeryczna */}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <PinKey key={d} onClick={() => press(d)} disabled={disabled}>
            {d}
          </PinKey>
        ))}
        <span />
        <PinKey onClick={() => press('0')} disabled={disabled}>
          0
        </PinKey>
        <PinKey onClick={backspace} disabled={disabled} aria-label="Usuń">
          ⌫
        </PinKey>
      </div>
    </div>
  )
}

function PinKey({
  children,
  onClick,
  disabled,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'h-16 w-16 rounded-full text-2xl font-display font-semibold',
        'bg-white border border-border shadow-card text-ink',
        'transition-transform active:scale-90 disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50'
      )}
    >
      {children}
    </button>
  )
}
