'use client'

import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function CtaSection() {
  const router = useRouter()

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-light to-secondary-light p-12">
          <Sparkles className="mx-auto mb-6 h-10 w-10 text-primary" />
          <h2 className="text-3xl font-bold text-text-primary">Siap Memulai?</h2>
          <p className="mt-4 text-text-secondary">
            Bergabung dan mulai kelola data sekolah secara digital hari ini.
          </p>
          <Button
            type="button"
            size="lg"
            className="mx-auto mt-8 gap-2"
            onClick={() => router.push('/signup')}
          >
            Daftar Sekarang
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="mt-4 text-sm text-text-secondary">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
