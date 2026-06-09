import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      )}
    </div>
  )
}

export { PageHeader }
