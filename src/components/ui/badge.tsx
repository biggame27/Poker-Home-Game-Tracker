'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-primary/10 text-primary border-transparent',
  secondary: 'bg-muted text-muted-foreground border-transparent',
  destructive: 'bg-red-500/10 text-red-600 border-transparent',
  outline: 'bg-transparent border border-border text-foreground',
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
          variantStyles[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = 'Badge'
