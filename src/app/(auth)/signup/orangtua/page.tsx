'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle, Eye, EyeOff, Heart } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { Combobox } from '@/components/shared/combobox'
import { useDebounce } from '@/hooks/use-debounce'
import { signupOrangTua } from '@/lib/auth/actions'
import { searchStudents } from '@/lib/queries/students'
import type { Student } from '@/lib/supabase/types'

const signupOrangTuaSchema = z.object({
  nama_lengkap: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  pekerjaan: z.string().optional(),
  siswa_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 anak'),
  email: z.string().email('Format email tidak valid'),
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh huruf, angka, dan underscore'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Password tidak cocok',
  path: ['confirm_password'],
})

type SignupOrangTuaFormValues = z.infer<typeof signupOrangTuaSchema>

export default function SignupOrangTuaPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [siswaSearch, setSiswaSearch] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([])

  const debouncedSiswaSearch = useDebounce(siswaSearch, 300)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupOrangTuaFormValues>({
    resolver: zodResolver(signupOrangTuaSchema),
    defaultValues: {
      nama_lengkap: '',
      pekerjaan: '',
      siswa_ids: [],
      email: '',
      username: '',
      password: '',
      confirm_password: '',
    },
  })

  // Search query for students across all units
  const { data: searchedSiswa = [], isLoading: isSiswaSearching } = useQuery({
    queryKey: ['students-search-ortu-signup', debouncedSiswaSearch],
    queryFn: () => searchStudents(debouncedSiswaSearch),
  })

  const comboboxOptions = useMemo(() => {
    // Filter out already selected students from showing in combobox options
    const unselected = searchedSiswa.filter(
      (s) => !selectedStudents.some((selected) => selected.id === s.id)
    )
    return unselected.map((s) => ({
      value: s.id,
      label: `${s.nama} - ${s.kelas} (${s.unit})`,
    }))
  }, [searchedSiswa, selectedStudents])

  const toggleStudent = (student: Student) => {
    const isSelected = selectedStudents.some((s) => s.id === student.id)
    let nextSelected: Student[]
    if (isSelected) {
      nextSelected = selectedStudents.filter((s) => s.id !== student.id)
    } else {
      nextSelected = [...selectedStudents, student]
    }
    setSelectedStudents(nextSelected)
    setValue(
      'siswa_ids',
      nextSelected.map((s) => s.id),
      { shouldValidate: true }
    )
  }

  const handleSelectSiswa = (id: string) => {
    const student = searchedSiswa.find((s) => s.id === id)
    if (student) {
      toggleStudent(student)
      setSiswaSearch('') // Clear search term
    }
  }

  // Generate read-only class string
  const kelasAnakString = useMemo(() => {
    const classes = selectedStudents.map((s) => s.kelas).filter(Boolean)
    const uniqueClasses = Array.from(new Set(classes))
    return uniqueClasses.join(', ')
  }, [selectedStudents])

  const onSubmit = (values: SignupOrangTuaFormValues) => {
    setServerError(null)
    startTransition(async () => {
      const result = await signupOrangTua({
        nama_lengkap: values.nama_lengkap,
        pekerjaan: values.pekerjaan,
        siswa_ids: values.siswa_ids,
        email: values.email,
        username: values.username,
        password: values.password,
      })

      if (result.error) {
        setServerError(result.error)
        toast({
          title: 'Pendaftaran Gagal',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      if (result.success) {
        setIsSuccess(true)
        toast({
          title: 'Pendaftaran Berhasil',
          description: 'Akun Orang Tua Anda berhasil didaftarkan.',
        })
      }
    })
  }

  if (isSuccess) {
    return (
      <Card className="mx-auto w-full max-w-md border border-[var(--border)] bg-[var(--surface)]">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <CheckCircle className="h-16 w-16 text-secondary" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Pendaftaran Berhasil!
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Akun Orang Tua Anda sedang menunggu persetujuan dari Admin. Anda akan dapat
            login setelah akun diaktifkan.
          </p>
          <Link
            href="/login"
            className="text-sm font-semibold text-primary hover:underline mt-2"
          >
            Kembali ke halaman login
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto w-full max-w-lg border border-[var(--border)] bg-[var(--surface)]">
      <CardHeader className="text-center pb-4">
        <div className="mb-2 flex justify-center items-center gap-2">
          <Image
            src="/icon.png"
            alt="Logo AMANAH"
            width={40}
            height={40}
            className="h-8 w-auto object-contain rounded-md"
            priority
          />
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            AMANAH Platform
          </span>
        </div>
        <CardTitle className="text-2xl font-bold text-[var(--text-primary)]">
          Daftar Orang Tua
        </CardTitle>
        <CardDescription className="text-sm text-[var(--text-secondary)]">
          Untuk memantau perkembangan akademik dan kepesantrenan anak
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

          {/* Nama Lengkap */}
          <div className="space-y-2">
            <Label htmlFor="nama_lengkap">Nama Lengkap</Label>
            <Input
              id="nama_lengkap"
              placeholder="Masukkan nama lengkap orang tua"
              {...register('nama_lengkap')}
            />
            {errors.nama_lengkap && (
              <p className="text-xs text-status-red">{errors.nama_lengkap.message}</p>
            )}
          </div>

          {/* Pekerjaan */}
          <div className="space-y-2">
            <Label htmlFor="pekerjaan">Pekerjaan (opsional)</Label>
            <Input
              id="pekerjaan"
              placeholder="Masukkan pekerjaan (contoh: PNS, Karyawan Swasta, Wiraswasta)"
              {...register('pekerjaan')}
            />
            {errors.pekerjaan && (
              <p className="text-xs text-status-red">{errors.pekerjaan.message}</p>
            )}
          </div>

          {/* Anak Saya */}
          <div className="space-y-2">
            <Label>Anak Saya</Label>
            <div className="relative">
              <Combobox
                options={comboboxOptions}
                onSelect={handleSelectSiswa}
                onSearch={setSiswaSearch}
                placeholder="Cari nama anak..."
                isLoading={isSiswaSearching}
                emptyMessage={
                  siswaSearch.length > 0
                    ? 'Anak tidak ditemukan'
                    : 'Tidak ada data siswa'
                }
              />
            </div>
            {siswaSearch.length > 0 && comboboxOptions.length === 0 && !isSiswaSearching && (
              <p className="text-xs text-status-red italic mt-1">
                Anak tidak ditemukan
              </p>
            )}
            {errors.siswa_ids && (
              <p className="text-xs text-status-red">{errors.siswa_ids.message}</p>
            )}

            {/* List selected children */}
            {selectedStudents.length > 0 && (
              <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-md border border-[var(--border)] p-2 bg-[var(--surface-2)]">
                {selectedStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-2 p-1.5 hover:bg-[var(--surface)] rounded transition-colors duration-200"
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {student.nama} - {student.kelas} ({student.unit})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-status-red hover:text-status-red hover:bg-status-red-bg font-semibold"
                      onClick={() => toggleStudent(student)}
                    >
                      Hapus
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kelas Anak (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="kelas_anak">Kelas Anak</Label>
            <Input
              id="kelas_anak"
              type="text"
              readOnly
              disabled
              value={kelasAnakString || '-'}
              className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-secondary)] select-none"
            />
            <p className="text-[10px] text-[var(--text-tertiary)] italic">
              Terisi otomatis berdasarkan anak yang Anda pilih di atas
            </p>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Masukkan email aktif"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-status-red">{errors.email.message}</p>
            )}
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Masukkan username unik"
              autoComplete="username"
              {...register('username')}
            />
            <p className="text-xs text-[var(--text-tertiary)]">
              Hanya huruf, angka, dan underscore
            </p>
            {errors.username && (
              <p className="text-xs text-status-red">{errors.username.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Masukkan password minimal 8 karakter"
                className="pr-10"
                {...register('password')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 text-[var(--text-secondary)] hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.password && (
              <p className="text-xs text-status-red">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Konfirmasi Password</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Ulangi password"
                className="pr-10"
                {...register('confirm_password')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 text-[var(--text-secondary)] hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.confirm_password && (
              <p className="text-xs text-status-red">{errors.confirm_password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full mt-6 bg-secondary hover:bg-secondary-hover text-white" isLoading={isPending}>
            Daftar Sebagai Orang Tua
          </Button>

          <p className="text-center text-sm mt-4">
            <span className="text-[var(--text-secondary)]">Sudah memiliki akun? </span>
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Masuk
            </Link>
          </p>

          <p className="text-center text-xs text-[var(--text-tertiary)] mt-2">
            <Link href="/signup" className="hover:underline text-[var(--text-secondary)] font-medium">
              ← Pilih Peran Lain
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
