'use client'

import { GraduationCap, Heart } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-8 flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex items-center gap-3">
          <Image
            src="/icon.png"
            alt="Logo AMANAH Platform"
            width={48}
            height={48}
            className="h-12 w-auto object-contain rounded-md"
            priority
          />
          <span className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            AMANAH Platform
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Mulai Pendaftaran
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Pilih jalur pendaftaran yang sesuai dengan peran Anda di sekolah/pesantren
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Card 1: Guru / Musyrif */}
        <Card 
          className="group relative flex flex-col justify-between overflow-hidden border border-[var(--border)] bg-[var(--surface)] transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg cursor-pointer"
          onClick={() => router.push('/signup/guru')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          
          <CardHeader className="relative pb-4">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold text-[var(--text-primary)] transition-colors duration-300 group-hover:text-primary">
              Guru / Musyrif
            </CardTitle>
            <CardDescription className="text-sm text-[var(--text-secondary)] mt-2">
              Untuk pendidik yang ingin mengelola data akademik atau kepesantrenan
            </CardDescription>
          </CardHeader>
          
          <CardContent className="relative pt-0 pb-6 mt-auto">
            <Button 
              type="button" 
              className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold"
              onClick={(e) => {
                e.stopPropagation()
                router.push('/signup/guru')
              }}
            >
              Daftar Sebagai Guru
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Orang Tua */}
        <Card 
          className="group relative flex flex-col justify-between overflow-hidden border border-[var(--border)] bg-[var(--surface)] transition-all duration-300 hover:-translate-y-1 hover:border-secondary hover:shadow-lg cursor-pointer"
          onClick={() => router.push('/signup/orangtua')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          
          <CardHeader className="relative pb-4">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-light text-secondary transition-colors duration-300 group-hover:bg-secondary group-hover:text-secondary-foreground">
              <Heart className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold text-[var(--text-primary)] transition-colors duration-300 group-hover:text-secondary">
              Orang Tua
            </CardTitle>
            <CardDescription className="text-sm text-[var(--text-secondary)] mt-2">
              Untuk orang tua yang ingin memantau perkembangan anak
            </CardDescription>
          </CardHeader>
          
          <CardContent className="relative pt-0 pb-6 mt-auto">
            <Button 
              type="button" 
              className="w-full bg-secondary hover:bg-secondary-hover text-secondary-foreground font-semibold"
              onClick={(e) => {
                e.stopPropagation()
                router.push('/signup/orangtua')
              }}
            >
              Daftar Sebagai Orang Tua
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Masuk ke Akun
          </Link>
        </p>
      </div>
    </div>
  )
}
