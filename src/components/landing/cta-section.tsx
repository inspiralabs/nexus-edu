'use client'

import { ArrowRight, MessageCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Nomor WhatsApp Pak Unggul (format internasional tanpa +) */
const WHATSAPP_PHONE = '6281284534567'

const WHATSAPP_MESSAGE =
  'Halo Pak Unggul, saya tertarik dengan jasa pembuatan aplikasi custom atau sistem digital untuk institusi kami.'

const WHATSAPP_URL = `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(WHATSAPP_MESSAGE)}`

export function CtaSection() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="w-full rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-light to-secondary-light px-8 py-16 text-center md:px-16">
          <MessageCircle className="mx-auto mb-6 h-10 w-10 text-primary" />
          <h2 className="text-3xl font-bold text-text-primary md:text-4xl">
            Butuh Aplikasi Lain?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-secondary md:text-lg">
            Butuh aplikasi custom atau sistem digital untuk instansi Anda?
            Hubungi Pak Unggul untuk konsultasi dan solusi IT yang sesuai
            kebutuhan Anda.
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: 'lg', variant: 'default' }),
                'inline-flex items-center gap-2 bg-primary text-white hover:bg-primary-hover'
              )}
            >
              Hubungi Pak Unggul
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
