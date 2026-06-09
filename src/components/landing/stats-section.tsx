const stats = [
  {
    value: '3',
    label: 'Unit Sekolah',
    subLabel: 'SD • SMP • SMA',
  },
  {
    value: '1',
    label: 'Platform',
    subLabel: 'Terintegrasi',
  },
  {
    value: '100%',
    label: 'Digital',
    subLabel: 'Paperless',
  },
] as const

function StatsSection() {
  return (
    <section className="flex flex-col items-center justify-center gap-10 sm:flex-row sm:gap-16">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col items-center text-center">
          <span className="text-3xl font-bold text-primary">{stat.value}</span>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {stat.label}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {stat.subLabel}
          </span>
        </div>
      ))}
    </section>
  )
}

export { StatsSection }
