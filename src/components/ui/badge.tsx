import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:
          'border border-primary/20 bg-primary/10 text-primary',
        success:
          'border border-status-green/20 bg-status-green-bg text-status-green',
        warning:
          'border border-status-yellow/20 bg-status-yellow-bg text-status-yellow',
        destructive:
          'border border-status-red/20 bg-status-red-bg text-status-red',
        secondary:
          'border border-secondary/20 bg-secondary-light text-secondary',
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--text-secondary)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
