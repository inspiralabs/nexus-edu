import {
  FileText,
  LayoutDashboard,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Step {
  number: string
  icon: LucideIcon
  title: string
  description: string
}

const steps: Step[] = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Isi Form Registrasi',
    description:
      'Daftarkan akun Anda dengan cepat. Admin akan melakukan verifikasi kilat demi keamanan data sekolah',
  },
  {
    number: '02',
    icon: LayoutDashboard,
    title: 'Eksplorasi Dashboard',
    description:
      'Masuk ke sistem dan langsung nikmati akses penuh ke fitur pengelolaan siswa, poin kedisiplinan, dan rekam prestasi.',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Kelola & Cetak Instan',
    description:
      'Pantau perkembangan siswa lewat visual grafik yang informatif, lalu unduh laporan siap cetak dalam sekali klik.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-background mb-28 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            CARA KERJA
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-50 md:text-4xl">
            Mulai dalam 3 Langkah
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Semudah ini memulai di SQA Platform.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <Card
              key={step.number}
              className={cn(
                'bg-surface p-6 text-center transition-all duration-200',
                'hover:border-primary/40 hover:shadow-md'
              )}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/20">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {step.title}
              </h3>
              <p className="mx-auto mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {step.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
