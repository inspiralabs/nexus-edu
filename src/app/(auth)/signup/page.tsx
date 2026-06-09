'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signup } from '@/lib/auth/actions'

const signupSchema = z
  .object({
    nama_lengkap: z.string().min(2, 'Nama minimal 2 karakter'),
    guru_mapel: z.string().min(1, 'Guru mapel wajib diisi'),
    email: z.string().email('Format email tidak valid'),
    username: z
      .string()
      .min(3, 'Username minimal 3 karakter')
      .regex(
        /^[a-zA-Z0-9_]+$/,
        'Username hanya boleh huruf, angka, dan underscore'
      ),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Password tidak cocok',
    path: ['confirm_password'],
  })

type SignupFormValues = z.infer<typeof signupSchema>

function PasswordField({
  id,
  label,
  showPassword,
  onToggle,
  error,
  registration,
}: {
  id: string
  label: string
  showPassword: boolean
  onToggle: () => void
  error?: string
  registration: ReturnType<typeof useForm<SignupFormValues>>['register']
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          className="pr-10"
          {...registration(id as keyof SignupFormValues)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-9 w-9"
          onClick={onToggle}
          aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-status-red">{error}</p>}
    </div>
  )
}

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      nama_lengkap: '',
      guru_mapel: '',
      email: '',
      username: '',
      password: '',
      confirm_password: '',
    },
  })

  const onSubmit = (values: SignupFormValues) => {
    setServerError(null)
    startTransition(async () => {
      const result = await signup({
        nama_lengkap: values.nama_lengkap,
        guru_mapel: values.guru_mapel,
        email: values.email,
        username: values.username,
        password: values.password,
      })

      if (result.error) {
        setServerError(result.error)
        return
      }

      if (result.success) {
        setIsSuccess(true)
      }
    })
  }

  if (isSuccess) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <CheckCircle className="h-16 w-16 text-primary" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Pendaftaran Berhasil!
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Akun Anda sedang menunggu persetujuan dari Admin. Anda akan dapat
            login setelah akun diaktifkan.
          </p>
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Kembali ke halaman login
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mb-2 flex justify-center">
          <Image
            src="/SQA.png"
            alt="Logo SQA"
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>
        <CardTitle>Daftar Akun Baru</CardTitle>
        <CardDescription>Isi form berikut untuk mendaftar</CardDescription>
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
            <Label htmlFor="nama_lengkap">Nama Lengkap</Label>
            <Input
              id="nama_lengkap"
              placeholder="Masukkan nama lengkap"
              {...register('nama_lengkap')}
            />
            {errors.nama_lengkap && (
              <p className="text-xs text-status-red">
                {errors.nama_lengkap.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="guru_mapel">Guru Mapel / Jabatan</Label>
            <Input
              id="guru_mapel"
              placeholder="Masukkan guru mapel atau jabatan"
              {...register('guru_mapel')}
            />
            {errors.guru_mapel && (
              <p className="text-xs text-status-red">
                {errors.guru_mapel.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Masukkan email"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-status-red">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Masukkan username"
              autoComplete="username"
              {...register('username')}
            />
            <p className="text-xs text-[var(--text-tertiary)]">
              Hanya huruf, angka, dan underscore
            </p>
            {errors.username && (
              <p className="text-xs text-status-red">
                {errors.username.message}
              </p>
            )}
          </div>

          <PasswordField
            id="password"
            label="Password"
            showPassword={showPassword}
            onToggle={() => setShowPassword((prev) => !prev)}
            error={errors.password?.message}
            registration={register}
          />

          <PasswordField
            id="confirm_password"
            label="Konfirmasi Password"
            showPassword={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((prev) => !prev)}
            error={errors.confirm_password?.message}
            registration={register}
          />

          <Button type="submit" className="w-full" isLoading={isPending}>
            Daftar
          </Button>

          <p className="text-center text-sm">
            <span className="text-[var(--text-secondary)]">
              Sudah punya akun?{' '}
            </span>
            <Link href="/login" className="text-primary hover:underline">
              Masuk
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
