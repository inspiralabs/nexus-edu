'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
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
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 0)
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
        'sticky top-0 z-50 transition-colors duration-300',
        scrolled
          ? 'border-b border-border bg-surface/80 backdrop-blur-md'
          : 'bg-transparent'
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

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-sm"
          onClick={() => router.push('/login')}
        >
          Masuk
        </Button>
      </div>
    </header>
  )
}
