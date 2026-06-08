import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-white rounded-app shadow-card border border-border/60 p-4',
        interactive && 'cursor-pointer transition-shadow hover:shadow-lift active:scale-[.99]',
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'
