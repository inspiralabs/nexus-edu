import { BookOpen, Check, GraduationCap, Heart } from 'lucide-react'
import { APP_FULL_NAME } from '@/lib/constants'

const PILLARS = [
  {
    id: 'guru',
    icon: GraduationCap,
    title: 'Untuk Guru',
    description:
      'Input presensi, nilai harian, nilai akhir semester, dan rekap rapor secara digital dan sistematis.',
  },
  {
    id: 'musyrif',
    icon: BookOpen,
    title: 'Untuk Musyrif',
    description:
      'Catat mutabaah ibadah harian, poin kedisiplinan, dan prestasi santri secara terukur dan konsisten.',
  },
  {
    id: 'orangtua',
    icon: Heart,
    title: 'Untuk Orang Tua',
    description:
      'Pantau perkembangan anak dari rumah: nilai, kehadiran, ibadah, dan prestasi secara real-time.',
  },
] as const

const VALUES = [
  'Powerful & Digitalized',
  'User-Friendly',
  'Amanah & Akurat',
] as const

export function AboutSection() {
  return (
    <section id="about" className="bg-surface-2/30 px-6 py-20">
      <div className="mx-auto max-w-6xl">
        {/* Label & Heading */}
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            TENTANG AMANAH
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-50 md:text-4xl">
            Mengapa AMANAH?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
            AMANAH ({APP_FULL_NAME}) adalah platform ekosistem digital sekolah terpadu yang hadir
            sebagai solusi total untuk menjembatani komunikasi, transparansi, dan pemantauan
            perkembangan anak secara real-time. Dirancang khusus untuk institusi pendidikan modern
            dan berasrama.
          </p>
        </div>

        {/* 3 Pilar Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon
            return (
              <div
                key={pillar.id}
                className="flex flex-col items-center rounded-xl border border-border bg-surface p-6 text-center shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md dark:bg-surface"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {pillar.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* Nilai Utama */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {VALUES.map((value) => (
            <div key={value} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-light">
                <Check className="h-3 w-3 text-primary" />
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
