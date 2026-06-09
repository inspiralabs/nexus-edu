'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const onSubmit = (values: LoginFormValues) => {
    setServerError(null)
    startTransition(async () => {
      const normalizedUsername = values.username.trim().toLowerCase()

      const { data: profileByUsername, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .ilike('username', normalizedUsername)
        .single()

      if (profileError || !profileByUsername?.email) {
        setServerError('Username tidak ditemukan')
        return
      }

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: profileByUsername.email,
          password: values.password,
        })

      if (authError || !authData.user) {
        setServerError('Password salah')
        return
      }

      const { data: profile, error: approvalError } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('user_id', authData.user.id)
        .single()

      if (approvalError || !profile) {
        await supabase.auth.signOut()
        setServerError('Username tidak ditemukan')
        return
      }

      if (!profile.is_approved) {
        await supabase.auth.signOut()
        setServerError(
          'Akun belum disetujui oleh Admin. Silakan hubungi administrator.'
        )
        return
      }

      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mb-2 flex justify-center">
        <Link 
          href="/" 
          className="transition-opacity hover:opacity-80 block mx-auto w-fit"
          aria-label="Kembali ke Beranda"
        >
            <Image
              src="/SQA.png"
              alt="Logo SQA"
              width={120}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
        </div>
        <CardDescription>
        <span className="text-sm font-medium tracking-tight text-slate-600 dark:text-slate-800">
          Masuk ke akun Anda
        </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-status-red/20 bg-status-red-bg px-4 py-3 text-sm text-status-red">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Masukkan username"
              autoComplete="username"
              {...register('username')}
            />
            {errors.username && (
              <p className="text-xs text-status-red">
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Masukkan password"
                autoComplete="current-password"
                className="pr-10"
                {...register('password')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-xs text-status-red">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            isLoading={isPending}
          >
            Masuk
          </Button>

          <p className="text-center text-sm">
            <span className="text-[var(--text-secondary)]">
              Belum punya akun?{' '}
            </span>
            <Link
              href="/signup"
              className="text-primary hover:underline"
            >
              Daftar di sini
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
