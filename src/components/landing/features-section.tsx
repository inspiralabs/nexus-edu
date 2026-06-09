import { ShieldAlert, Trophy, Users, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  highlights: string[]
}

const features: Feature[] = [
  {
    icon: Users,
    title: 'Data Siswa',
    description:
      'Kelola data lengkap siswa SD, SMP, dan SMA. Input, edit, dan impor data secara massal dengan mudah.',
    highlights: ['CRUD lengkap', 'Import massal', 'Filter per unit'],
  },
  {
    icon: ShieldAlert,
    title: 'Kedisiplinan',
    description:
      'Catat pelanggaran dan penghargaan siswa secara digital. Pantau status dan buat laporan instan.',
    highlights: ['Status tracking', 'Filter & laporan', 'Multi kategori'],
  },
  {
    icon: Trophy,
    title: 'Prestasi',
    description:
      'Dokumentasikan pencapaian siswa dari tingkat sekolah hingga internasional secara terstruktur.',
    highlights: ['8 tingkat kejuaraan', 'Laporan cetak', 'Dashboard analitik'],
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="bg-surface-2/50 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            FITUR UNGGULAN
          </p>
          <h2 className="mt-3 text-3xl font-bold text-text-primary md:text-4xl">
            Semua yang Guru Butuhkan
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary">
            Satu platform terintegrasi untuk mengelola data siswa, kedisiplinan,
            dan prestasi.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon

            return (
              <Card
                key={feature.title}
                className={cn(
                  'p-6 transition-all duration-200',
                  'hover:border-primary/40 hover:shadow-md'
                )}
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {feature.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {feature.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text-secondary"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
