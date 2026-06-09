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
      'Simpan dan kelola database siswa SD, SMP, hingga SMA secara terpusat. Dilengkapi fitur import massal sekali klik untuk menghemat waktu Anda',
    highlights: ['CRUD lengkap', 'Import massal', 'Filter per unit'],
  },
  {
    icon: ShieldAlert,
    title: 'Kedisiplinan',
    description:
      'Rekam setiap poin pelanggaran maupun penghargaan siswa secara digital. Pantau grafik kedisiplinan dan terbitkan laporan instan kapan saja.',
    highlights: ['Status tracking', 'Filter & laporan', 'Multi kategori'],
  },
  {
    icon: Trophy,
    title: 'Prestasi',
    description:
      'Catat dan dokumentasikan pencapaian gemilang siswa mulai tingkat lokal hingga internasional demi reputasi sekolah yang akurat.',
    highlights: ['8 tingkat kejuaraan', 'Laporan cetak', 'Dashboard analitik'],
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="bg-background px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            FITUR UNGGULAN
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-50 md:text-4xl">
            Satu Aplikasi, Segala Kemudahan untuk Guru
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
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
                  'bg-surface p-6 transition-all duration-200',
                  'hover:border-primary/40 hover:shadow-md'
                )}
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {feature.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {feature.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-slate-600 dark:text-slate-400"
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
