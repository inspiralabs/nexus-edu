'use client'

import { ArrowRight, ExternalLink, MessageCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { CREATOR_WHATSAPP, INSPIRALABS_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function CtaSection() {
  return (
    <section className="w-full bg-gradient-to-br from-primary-light via-background to-secondary-light pt-20 pb-0">
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6 pb-20 text-center">
        <MessageCircle className="mx-auto mb-6 h-10 w-10 text-primary" />
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 md:text-4xl">
          Ingin Digitalisasi Sistem Sekolah Lebih Luas?
        </h2>
        <p className="mx-auto mt-4 max-w-4xl text-base text-slate-600 dark:text-slate-400 md:text-lg">
          Kami siap membangun platform custom atau integrasi sistem digital khusus untuk Anda. Konsultasikan kebutuhan IT Anda bersama tim ahli kami secara gratis.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={CREATOR_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ size: 'lg', variant: 'default' }),
              'inline-flex items-center gap-2 px-8 py-6 bg-primary hover:bg-primary-hover'
            )}
          >
            Konsultasikan Sekarang
            <ArrowRight className="h-5 w-5" />
          </a>
          <a
            href={INSPIRALABS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-secondary px-6 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-secondary-light dark:hover:bg-secondary/10"
          >
            <ExternalLink className="h-4 w-4" />
            Kunjungi InspiraLabs
          </a>
        </div>
      </div>
    </section>
  )
}
