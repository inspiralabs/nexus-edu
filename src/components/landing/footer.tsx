import Image from 'next/image'
import { CREATOR_WHATSAPP, INSPIRALABS_URL } from '@/lib/constants'

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Image
            src="/SQA.png"
            alt="Logo AMANAH"
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
          />
          <span className="block text-sm font-medium tracking-tight text-slate-500 dark:text-slate-400">
            AMANAH Platform
          </span>
        </div>

        <p className="text-center text-xs text-slate-600 dark:text-slate-400 md:text-right">
          ©2026{' '}
          <a
            href={INSPIRALABS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            InspiraLabs
          </a>{' '}
          ·{' '}
          <a
            href={CREATOR_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Unggul Sulaiman, S.Kom
          </a>
        </p>
      </div>
    </footer>
  )
}
