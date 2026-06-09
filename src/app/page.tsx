'use client'

import { Moon, Sun } from 'lucide-react'
import { FeaturesSection } from '@/components/landing/features-section'
import { HeroSection } from '@/components/landing/hero-section'
import { StatsSection } from '@/components/landing/stats-section'
import { useTheme } from '@/components/providers/theme-provider'
import { Button } from '@/components/ui/button'

export default function Home() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:repeating-linear-gradient(0deg,var(--text-tertiary)_0,var(--text-tertiary)_1px,transparent_1px,transparent_24px),repeating-linear-gradient(90deg,var(--text-tertiary)_0,var(--text-tertiary)_1px,transparent_1px,transparent_24px)]"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-50 flex items-center justify-between bg-transparent px-4 py-4">
        <span className="text-lg font-bold text-primary">SQA</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle tema"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </header>

      <main className="relative">
        <HeroSection />

        <div className="mx-auto max-w-5xl px-4">
          <FeaturesSection />
        </div>

        <div className="mt-12 border-y border-[var(--border)] bg-[var(--surface-2)] py-12">
          <StatsSection />
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-[var(--text-tertiary)]">
        ©2026 InspiraLabs · Unggul Sulaiman, S.Kom
      </footer>
    </div>
  )
}
