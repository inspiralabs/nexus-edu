'use client'

import { ArrowRight, Monitor, Sparkles } from 'lucide-react'
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
    <div className={cn('group relative animate-fade-in-up', delayClass)}>
      <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
        {title}
      </p>
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border border-border bg-surface shadow-2xl',
          'shadow-[0_20px_60px_-10px] shadow-primary/15',
          'ring-1 ring-primary/20 transition-all duration-300 group-hover:ring-primary/40'
        )}
      >
        {hasError ? (
          <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 bg-surface-2">
            <Monitor className="h-10 w-10 text-text-tertiary" />
            <p className="text-sm font-medium text-text-primary">{title}</p>
            <p className="text-xs text-text-tertiary">
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
      </div>
    </div>
  )
}

export function HeroSection() {
  const router = useRouter()
  const [bgError, setBgError] = useState(false)

  return (
    <section className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 pb-20 pt-28">
      {!bgError && (
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-bg.jpg"
            alt=""
            className="h-full w-full object-cover opacity-[0.18] dark:opacity-[0.12]"
            onError={() => setBgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[length:24px_24px] opacity-50"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-0 top-0 z-0 h-72 w-72 rounded-full bg-primary/10 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 z-0 h-72 w-72 rounded-full bg-secondary/10 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-light px-3 py-1 text-xs font-medium text-primary [animation-delay:0ms]">
          <Sparkles className="h-3 w-3" />
          Platform Manajemen Guru Digital
        </div>

        <h1 className="text-center tracking-tight">
          <span className="animate-fade-in-up block text-5xl font-bold text-text-primary [animation-delay:100ms] md:text-6xl">
            Kelola Sekolah
          </span>
          <span className="animate-fade-in-up block bg-gradient-to-r from-primary to-secondary bg-clip-text text-5xl font-bold text-transparent [animation-delay:100ms] md:text-6xl">
            Lebih Cerdas
          </span>
        </h1>

        <p className="animate-fade-in-up mt-4 max-w-xl text-center text-lg text-text-secondary [animation-delay:200ms]">
          Platform Digital Yang Membantu Guru Di Lingkungan Sekolah Quran Asy
          Syahid
        </p>

        <Button
          type="button"
          size="lg"
          className="animate-fade-in-up mt-8 gap-2 bg-primary [animation-delay:300ms] hover:bg-primary-hover"
          onClick={() => router.push('/login')}
        >
          Masuk Ke Aplikasi
          <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="animate-fade-in-up mt-4 text-center text-xs text-text-tertiary [animation-delay:400ms]">
          Dibuat dengan hati oleh : Unggul Sulaiman, S.Kom (Guru Informatika),
          2026
        </p>

        <div className="mt-16 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
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
    </section>
  )
}
