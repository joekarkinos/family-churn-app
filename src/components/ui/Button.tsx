import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-teal text-white hover:bg-teal-dark active:bg-teal-dark disabled:bg-ink-3',
  secondary: 'bg-white text-ink border border-border hover:bg-surface active:bg-surface',
  ghost: 'bg-transparent text-ink-2 hover:bg-black/5 active:bg-black/10',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-600',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-app-sm',
  md: 'h-11 px-4 text-base rounded-app',
  lg: 'h-14 px-6 text-lg rounded-app',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium font-sans',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    />
  )
)
Button.displayName = 'Button'
