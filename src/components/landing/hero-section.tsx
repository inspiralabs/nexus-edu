'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const animationDelays = ['0s', '0.1s', '0.2s', '0.3s', '0.4s'] as const

function SQALogo() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      aria-hidden="true"
      className="rounded-2xl"
    >
      <defs>
        <linearGradient id="sqa-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary-light)" />
          <stop offset="100%" stopColor="var(--secondary-light)" />
        </linearGradient>
      </defs>
      <rect
        width="80"
        height="80"
        rx="16"
        fill="url(#sqa-logo-gradient)"
      />
      <text
        x="18"
        y="52"
        fill="var(--primary)"
        fontSize="24"
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        S
      </text>
      <text
        x="36"
        y="52"
        fill="var(--secondary)"
        fontSize="24"
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        Q
      </text>
      <text
        x="54"
        y="52"
        fill="var(--primary)"
        fontSize="24"
        fontWeight="700"
        fontFamily="Inter, sans-serif"
      >
        A
      </text>
    </svg>
  )
}

function HeroSection() {
  const router = useRouter()

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>

      <section className="flex flex-col items-center gap-6 px-4 py-20 text-center">
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: animationDelays[0] }}
        >
          <SQALogo />
        </div>

        <h1
          className="animate-fade-in-up text-5xl font-bold tracking-tight text-[var(--text-primary)]"
          style={{ animationDelay: animationDelays[1] }}
        >
          SQA
        </h1>

        <p
          className="animate-fade-in-up max-w-md text-lg text-[var(--text-secondary)]"
          style={{ animationDelay: animationDelays[2] }}
        >
          Platform Digital Yang Membantu Guru Di Lingkungan Sekolah Quran Asy
          Syahid
        </p>

        <div
          className="animate-fade-in-up"
          style={{ animationDelay: animationDelays[3] }}
        >
          <Button size="lg" onClick={() => router.push('/login')}>
            Masuk Ke Aplikasi
          </Button>
        </div>

        <p
          className="animate-fade-in-up text-center text-xs text-[var(--text-tertiary)]"
          style={{ animationDelay: animationDelays[4] }}
        >
          Dibuat dengan hati oleh : Unggul Sulaiman, S.Kom (Guru Informatika),
          2026
        </p>
      </section>
    </>
  )
}

export { HeroSection }
