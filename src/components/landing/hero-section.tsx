'use client'

import { ArrowRight, Monitor, Sparkles, Zap, Shield, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ScreenshotCardProps {
  title: string
  src: string
  alt: string
  delayClass: string
}

function ScreenshotCard({ title, src, alt, delayClass }: ScreenshotCardProps) {
  const [hasError, setHasError] = useState(false)

  return (
    <div
      className={cn(
        'group relative animate-fade-in-up overflow-hidden rounded-xl border border-border bg-surface shadow-2xl',
        'shadow-[0_20px_60px_-10px] shadow-primary/15',
        'ring-1 ring-primary/20 transition-all duration-300 hover:ring-primary/40',
        delayClass
      )}
    >
      {hasError ? (
        <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 bg-surface-2">
          <Monitor className="h-10 w-10 text-slate-500" />
          <p className="text-sm font-medium text-slate-900">{title}</p>
          <p className="text-xs text-slate-600">
            Screenshot akan ditampilkan di sini
          </p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={640}
          height={400}
          className="h-auto w-full object-cover object-top"
          onError={() => setHasError(true)}
        />
      )}

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="h-28 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
        <p className="absolute bottom-0 left-0 right-0 p-4 text-base font-semibold tracking-tight text-slate-50 md:p-5 md:text-lg">
          {title}
        </p>
      </div>
    </div>
  )
}

export function HeroSection() {
  const router = useRouter()
  const [bgError, setBgError] = useState(false)

  return (
    <div className="w-full bg-background">
      {/* 1. HERO SECTION - TINGGI DIKUNCI AGAR TIDAK TERIKUT KEATAS */}
      <section className="relative flex h-[620px] w-full flex-col items-center overflow-hidden px-6 pt-28">
        <div
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden="true"
        >
          {!bgError && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/hero-bg.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setBgError(true)}
            />
          )}
          {!bgError && (
            <div className="absolute inset-0 bg-background/20" />
          )}
          {bgError && (
            <div className="absolute inset-0 bg-background" />
          )}
          <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        <div className="relative z-10 flex w-full flex-col items-center">
          <div className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-light px-3 py-1 text-xs font-medium text-primary [animation-delay:0ms]">
            <Sparkles className="h-3 w-3" />
            Platform Manajemen Guru Digital
          </div>

          <h1 className="text-center tracking-tight">
            <span className="animate-fade-in-up block text-5xl font-bold text-slate-900 [animation-delay:100ms] md:text-6xl">
              Pangkas Waktu Administrasi,
            </span>
            <span className="animate-fade-in-up block bg-gradient-to-r from-primary to-secondary bg-clip-text text-5xl font-bold text-transparent [animation-delay:100ms] md:text-6xl">
              Fokus Cetak Generasi Berprestasi.
            </span>
          </h1>

          <p className="animate-fade-in-up mt-4 max-w-2xl text-center text-lg text-slate-600 [animation-delay:200ms]">
            Satu platform terintegrasi untuk menyederhanakan rekam data siswa, kedisiplinan, hingga pencapaian prestasi dalam hitungan detik.
          </p>

          <Button
            type="button"
            size="lg"
            className="animate-fade-in-up mt-6 gap-2 px-8 py-6 bg-primary [animation-delay:300ms] hover:bg-primary-hover"
            onClick={() => router.push('/login')}
          >
            Mulai Kelola Sekarang
            <ArrowRight className="h-4 w-4" />
          </Button>

          {/* SaaS Feature Badges */}
          <div className="animate-fade-in-up mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-slate-400 [animation-delay:400ms]">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className='text-slate-500 dark:text-slate-400'>Lebih Efisien</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className='text-slate-500 dark:text-slate-400'>Data Terjaga</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className='text-slate-500 dark:text-slate-400'>Hemat Waktu</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SCREENSHOT BRIDGE - POSITION ABSOLUTE MELAYANG BEBAS */}
      <section className="relative z-20 w-full px-6">
        <div className="absolute left-1/2 top-0 w-full max-w-7xl -translate-x-1/2 -translate-y-[100px] px-6">
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <ScreenshotCard
              title="Dashboard Kedisiplinan"
              src="/screenshots/dashboard-kedisiplinan.png"
              alt="Dashboard Kedisiplinan SQA Platform"
              delayClass="[animation-delay:500ms]"
            />
            <ScreenshotCard
              title="Dashboard Prestasi"
              src="/screenshots/dashboard-prestasi.png"
              alt="Dashboard Prestasi SQA Platform"
              delayClass="[animation-delay:600ms]"
            />
          </div>
        </div>
        {/* Spacer untuk mendorong konten section berikutnya agar pas */}
        <div className="h-[260px] md:h-[220px]" aria-hidden="true" />
      </section>
    </div>
  )
}