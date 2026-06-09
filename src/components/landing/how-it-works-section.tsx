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
    title: 'Daftar Akun',
    description:
      'Guru mendaftar dengan mengisi form registrasi. Akun akan aktif setelah mendapat persetujuan Admin.',
  },
  {
    number: '02',
    icon: LayoutDashboard,
    title: 'Akses Dashboard',
    description:
      'Setelah akun aktif, login dan akses semua fitur: Data Siswa, Kedisiplinan, dan Prestasi.',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Kelola & Cetak',
    description:
      'Input data, pantau statistik lewat grafik, dan cetak laporan kapan saja dengan format siap print.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-background px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            CARA KERJA
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-50 md:text-4xl">
            Mulai dalam 3 Langkah
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            Proses sederhana untuk mulai menggunakan SQA Platform.
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
