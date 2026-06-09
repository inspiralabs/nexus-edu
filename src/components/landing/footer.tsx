'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/providers/theme-provider'
import { Button } from '@/components/ui/button'

function SqaLogo() {
  return (
    <span className="font-bold">
      <span className="text-primary">S</span>
      <span className="text-secondary">Q</span>
      <span className="text-primary">A</span>
    </span>
  )
}

export function Footer() {
  const { theme, setTheme } = useTheme()

  return (
    <footer className="border-t border-border px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="text-center md:text-left">
          <SqaLogo />
          <p className="mt-1 text-xs text-text-tertiary">
            Sekolah Quran Asy Syahid
          </p>
        </div>

        <p className="hidden text-xs text-text-tertiary md:block">
          ©2026 InspiraLabs · Unggul Sulaiman, S.Kom
        </p>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle tema gelap/terang"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-text-tertiary md:hidden">
        ©2026 InspiraLabs · Unggul Sulaiman, S.Kom
      </p>
    </footer>
  )
}
