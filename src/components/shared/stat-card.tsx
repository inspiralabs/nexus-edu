import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  description?: string
  variant?: 'default' | 'primary' | 'secondary'
}

const iconVariantClasses = {
  default: 'bg-[var(--surface-2)] text-[var(--text-secondary)]',
  primary: 'bg-primary-light text-primary',
  secondary: 'bg-secondary-light text-secondary',
} as const

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = 'default',
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconVariantClasses[variant]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-[var(--text-secondary)]">{title}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">
            {value}
          </p>
          {description && (
            <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { StatCard }
