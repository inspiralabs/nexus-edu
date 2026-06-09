import {
  FileText,
  LayoutDashboard,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'

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
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            CARA KERJA
          </p>
          <h2 className="mt-3 text-3xl font-bold text-text-primary md:text-4xl">
            Mulai dalam 3 Langkah
          </h2>
          <p className="mt-4 text-text-secondary">
            Proses sederhana untuk mulai menggunakan SQA Platform.
          </p>
        </div>

        <div className="relative mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div
            className="absolute left-1/6 right-1/6 top-8 hidden h-px bg-border md:block"
            aria-hidden="true"
          />

          {steps.map((step) => (
            <div key={step.number} className="relative text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white shadow-lg shadow-primary/20">
                {step.number}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-text-primary">
                {step.title}
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-text-secondary">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
