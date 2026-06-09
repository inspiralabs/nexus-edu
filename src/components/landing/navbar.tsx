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
        'fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md transition-transform duration-300 ease-in-out',
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
            className="text-sm text-slate-600 transition-colors hover:text-slate-900"
          >
            Fitur
          </a>
          <a
            href="#how-it-works"
            onClick={(event) => handleAnchorClick(event, 'how-it-works')}
            className="text-sm text-slate-600 transition-colors hover:text-slate-900"
          >
            Cara Kerja
          </a>
        </nav>

        <Button
          type="button"
          size="sm"
          className="bg-primary hover:bg-primary-hover"
          onClick={() => router.push('/login')}
        >
          Masuk
        </Button>
      </div>
    </header>
  )
}
