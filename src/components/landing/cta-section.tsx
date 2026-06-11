'use client'

import { ArrowRight, MessageCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Nomor WhatsApp Pak Unggul (format internasional tanpa +) */
const WHATSAPP_PHONE = '6289635235132'

const WHATSAPP_MESSAGE =
  'Halo Pak Unggul, saya tertarik dengan jasa pembuatan aplikasi custom untuk kami. Boleh tanya-tanya dulu untuk konsultasi sistemnya, Pak?'

const WHATSAPP_URL = `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(WHATSAPP_MESSAGE)}`

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
        <div className="mt-8 flex justify-center">
          <a
            href={WHATSAPP_URL}
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
        </div>
      </div>
    </section>
  )
}
