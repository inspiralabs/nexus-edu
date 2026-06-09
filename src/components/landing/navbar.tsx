'use client'

import { Moon, Sun } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/components/providers/theme-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function SqaLogo() {
  return (
    <span className="text-xl font-bold">
      <span className="text-primary">S</span>
      <span className="text-secondary">Q</span>
      <span className="text-primary">A</span>
    </span>
  )
}

export function Navbar() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setIsVisible(window.scrollY > 50)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleAnchorClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
      event.preventDefault()

      if (targetId === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' })
    },
    []
  )

  return (
    <header
      className={cn(
        'fixed left-0 right-0 top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-md transition-transform duration-300 ease-in-out',
        isVisible ? 'translate-y-0' : '-translate-y-full'
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a
          href="#"
          onClick={(event) => handleAnchorClick(event, 'top')}
          className="cursor-pointer"
          aria-label="Kembali ke atas"
        >
          <SqaLogo />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            onClick={(event) => handleAnchorClick(event, 'features')}
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            Fitur
          </a>
          <a
            href="#how-it-works"
            onClick={(event) => handleAnchorClick(event, 'how-it-works')}
            className="text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            Cara Kerja
          </a>
        </nav>

        <div className="flex items-center gap-2">
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
          <Button
            type="button"
            size="sm"
            className="bg-primary text-white hover:bg-primary-hover"
            onClick={() => router.push('/login')}
          >
            Masuk
          </Button>
        </div>
      </div>
    </header>
  )
}
