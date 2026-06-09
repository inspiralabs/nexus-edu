import { LayoutDashboard, ShieldAlert, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: LayoutDashboard,
    iconClassName: 'text-primary',
    title: 'Data Siswa',
    description:
      'Kelola data siswa SD, SMP, dan SMA dalam satu platform terintegrasi',
  },
  {
    icon: ShieldAlert,
    iconClassName: 'text-secondary',
    title: 'Kedisiplinan',
    description:
      'Pantau, catat, dan tindaklanjuti pelanggaran serta penghargaan siswa',
  },
  {
    icon: Trophy,
    iconClassName: 'text-primary',
    title: 'Prestasi',
    description:
      'Dokumentasikan pencapaian siswa dalam berbagai kejuaraan dan kompetisi',
  },
] as const

function FeaturesSection() {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {features.map((feature) => (
        <Card
          key={feature.title}
          className="cursor-default transition-shadow hover:shadow-md"
        >
          <CardContent className="flex flex-col gap-3 p-6">
            <feature.icon
              className={`h-8 w-8 ${feature.iconClassName}`}
              aria-hidden="true"
            />
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {feature.title}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {feature.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}

export { FeaturesSection }
