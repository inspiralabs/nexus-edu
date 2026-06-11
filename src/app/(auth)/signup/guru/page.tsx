'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle, Eye, EyeOff, GraduationCap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Combobox } from '@/components/shared/combobox'
import { signup } from '@/lib/auth/actions'
import { getKamarOptions, getMataKuliah } from '@/lib/queries/students'

const signupGuruSchema = z.object({
  nama_lengkap: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  guru_mapel: z.string().optional(),
  tipe_role: z.enum(['guru', 'musyrif', 'guru_musyrif']),
  unit_mengajar: z.array(z.enum(['SD', 'SMP', 'SMA'])).min(1, 'Pilih minimal 1 unit mengajar'),
  mapel_ids: z.array(z.string().uuid()).optional(),
  kamar_ids: z.array(z.string().uuid()).optional(),
  email: z.string().email('Format email tidak valid'),
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh huruf, angka, dan underscore'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Password tidak cocok',
  path: ['confirm_password'],
})

type SignupGuruFormValues = z.infer<typeof signupGuruSchema>

export default function SignupGuruPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  const [mengasuhLebihDari1Kamar, setMengasuhLebihDari1Kamar] = useState(false)
  const [mapelSearch, setMapelSearch] = useState('')
  const [kamarSearch, setKamarSearch] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<SignupGuruFormValues>({
    resolver: zodResolver(signupGuruSchema),
    defaultValues: {
      nama_lengkap: '',
      guru_mapel: '',
      tipe_role: 'guru',
      unit_mengajar: [],
      mapel_ids: [],
      kamar_ids: [],
      email: '',
      username: '',
      password: '',
      confirm_password: '',
    },
  })

  const tipeRole = watch('tipe_role')
  const selectedUnits = watch('unit_mengajar') || []
  const selectedMapelIds = watch('mapel_ids') || []
  const selectedKamarIds = watch('kamar_ids') || []

  // Load Mapel Options based on checked units
  const { data: mapelData = [], isLoading: isMapelLoading } = useQuery({
    queryKey: ['mapel-options', selectedUnits],
    queryFn: () => getMataKuliah(selectedUnits),
    enabled: selectedUnits.length > 0 && (tipeRole === 'guru' || tipeRole === 'guru_musyrif'),
  })

  // Load Kamar Options
  const { data: kamarData = [], isLoading: isKamarLoading } = useQuery({
    queryKey: ['kamar-options', selectedUnits],
    queryFn: () => getKamarOptions(selectedUnits),
    enabled: selectedUnits.length > 0 && (tipeRole === 'musyrif' || tipeRole === 'guru_musyrif'),
  })

  // Clear fields depending on dynamic roles
  useEffect(() => {
    if (tipeRole === 'musyrif') {
      setValue('mapel_ids', [])
    } else if (tipeRole === 'guru') {
      setValue('kamar_ids', [])
    }
  }, [tipeRole, setValue])

  // Reset mapel and kamar selection whenever selected units change
  const serializedUnits = selectedUnits.join(',')
  useEffect(() => {
    setValue('mapel_ids', [])
    setValue('kamar_ids', [])
  }, [serializedUnits, setValue])

  // Limit kamar selection to 1 if not Checked for multi-rooms
  useEffect(() => {
    if (!mengasuhLebihDari1Kamar && selectedKamarIds.length > 1) {
      setValue('kamar_ids', [selectedKamarIds[0]], { shouldValidate: true })
    }
  }, [mengasuhLebihDari1Kamar, selectedKamarIds, setValue])

  const filteredMapel = useMemo(() => {
    if (!mapelSearch) return mapelData
    return mapelData.filter((m) =>
      m.nama_mapel.toLowerCase().includes(mapelSearch.toLowerCase())
    )
  }, [mapelData, mapelSearch])

  const mapelOptions = useMemo(() => {
    return filteredMapel.map((m) => ({ value: m.id, label: `${m.nama_mapel} (${m.unit})` }))
  }, [filteredMapel])

  const filteredKamar = useMemo(() => {
    if (!kamarSearch) return kamarData
    return kamarData.filter((k) =>
      k.nama_kamar.toLowerCase().includes(kamarSearch.toLowerCase())
    )
  }, [kamarData, kamarSearch])

  const kamarOptions = useMemo(() => {
    return filteredKamar.map((k) => ({ value: k.id, label: k.nama_kamar }))
  }, [filteredKamar])

  const toggleUnit = (unit: 'SD' | 'SMP' | 'SMA') => {
    const current = selectedUnits
    const updated = current.includes(unit)
      ? current.filter((u) => u !== unit)
      : [...current, unit]
    setValue('unit_mengajar', updated, { shouldValidate: true })
  }

  const toggleMapel = (id: string) => {
    const current = selectedMapelIds
    const updated = current.includes(id)
      ? current.filter((mId) => mId !== id)
      : [...current, id]
    setValue('mapel_ids', updated, { shouldValidate: true })
  }

  const toggleKamar = (id: string) => {
    const current = selectedKamarIds
    let updated: string[] = []
    if (mengasuhLebihDari1Kamar) {
      updated = current.includes(id)
        ? current.filter((kId) => kId !== id)
        : [...current, id]
    } else {
      updated = current.includes(id) ? [] : [id]
    }
    setValue('kamar_ids', updated, { shouldValidate: true })
  }

  const onSubmit = (values: SignupGuruFormValues) => {
    setServerError(null)
    startTransition(async () => {
      const result = await signup({
        nama_lengkap: values.nama_lengkap,
        guru_mapel: values.guru_mapel,
        tipe_role: values.tipe_role,
        unit_mengajar: values.unit_mengajar,
        mapel_ids: values.mapel_ids,
        kamar_ids: values.kamar_ids,
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
          description: 'Akun Guru / Musyrif Anda berhasil didaftarkan.',
        })
      }
    })
  }

  if (isSuccess) {
    return (
      <Card className="mx-auto w-full max-w-md border border-[var(--border)] bg-[var(--surface)]">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <CheckCircle className="h-16 w-16 text-primary" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Pendaftaran Berhasil!
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Akun Guru / Musyrif Anda sedang menunggu persetujuan dari Admin. Anda akan dapat
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
          Daftar Guru / Musyrif
        </CardTitle>
        <CardDescription className="text-sm text-[var(--text-secondary)]">
          Pendidik akademik atau kepesantrenan
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
              placeholder="Masukkan nama lengkap beserta gelar"
              {...register('nama_lengkap')}
            />
            {errors.nama_lengkap && (
              <p className="text-xs text-status-red">{errors.nama_lengkap.message}</p>
            )}
          </div>

          {/* Guru Mapel / Jabatan */}
          <div className="space-y-2">
            <Label htmlFor="guru_mapel">Guru Mapel / Jabatan</Label>
            <Input
              id="guru_mapel"
              placeholder="Masukkan guru mapel utama atau jabatan saat ini"
              {...register('guru_mapel')}
            />
            {errors.guru_mapel && (
              <p className="text-xs text-status-red">{errors.guru_mapel.message}</p>
            )}
          </div>

          {/* Tipe Select */}
          <div className="space-y-2">
            <Label htmlFor="tipe_role">Tipe Pendidik</Label>
            <Select
              value={tipeRole}
              onValueChange={(value) => setValue('tipe_role', value as 'guru' | 'musyrif' | 'guru_musyrif', { shouldValidate: true })}
            >
              <SelectTrigger id="tipe_role">
                <SelectValue placeholder="Pilih tipe pendidik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guru">Guru DIKNAS</SelectItem>
                <SelectItem value="musyrif">Musyrif/Musyrifah</SelectItem>
                <SelectItem value="guru_musyrif">Guru & Musyrif</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipe_role && (
              <p className="text-xs text-status-red">{errors.tipe_role.message}</p>
            )}
          </div>

          {/* Unit Mengajar (Multi-select) */}
          <div className="space-y-2">
            <Label>Unit Mengajar</Label>
            <div className="flex gap-6 mt-1">
              {(['SD', 'SMP', 'SMA'] as const).map((unit) => (
                <div key={unit} className="flex items-center gap-2">
                  <Checkbox
                    id={`unit-${unit}`}
                    checked={selectedUnits.includes(unit)}
                    onCheckedChange={() => toggleUnit(unit)}
                  />
                  <Label htmlFor={`unit-${unit}`} className="font-normal cursor-pointer text-sm">
                    {unit}
                  </Label>
                </div>
              ))}
            </div>
            {errors.unit_mengajar && (
              <p className="text-xs text-status-red">{errors.unit_mengajar.message}</p>
            )}
          </div>

          {/* Conditional field: Mata Pelajaran (Multi-select combobox) */}
          {(tipeRole === 'guru' || tipeRole === 'guru_musyrif') && (
            <div className="space-y-2">
              <Label>Mata Pelajaran (Multi-select)</Label>
              {selectedUnits.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)] italic">
                  Pilih unit mengajar terlebih dahulu untuk menampilkan daftar mata pelajaran.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Combobox
                      options={mapelOptions}
                      value={selectedMapelIds[0] ?? ''}
                      onSelect={() => {}}
                      onSearch={setMapelSearch}
                      placeholder="Cari mata pelajaran..."
                      isLoading={isMapelLoading}
                      emptyMessage={
                        mapelSearch
                          ? 'Mata pelajaran tidak ditemukan'
                          : 'Belum ada mata pelajaran untuk unit yang dipilih'
                      }
                    />
                  </div>
                  {mapelOptions.length > 0 ? (
                    <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-md border border-[var(--border)] p-2 bg-[var(--surface-2)]">
                      {mapelOptions.map((opt) => (
                        <div key={opt.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`mapel-${opt.value}`}
                            checked={selectedMapelIds.includes(opt.value)}
                            onCheckedChange={() => toggleMapel(opt.value)}
                          />
                          <Label htmlFor={`mapel-${opt.value}`} className="font-normal text-sm cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    mapelSearch && (
                      <p className="text-xs text-status-red italic mt-2">
                        Mata pelajaran tidak ditemukan
                      </p>
                    )
                  )}
                  {selectedMapelIds.length > 0 && (
                    <p className="text-xs text-[var(--text-secondary)]">
                      {selectedMapelIds.length} mata pelajaran dipilih
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Conditional field: Kamar Diasuh (Multi-select combobox) */}
          {(tipeRole === 'musyrif' || tipeRole === 'guru_musyrif') && (
            <div className="space-y-3 border-t border-[var(--border)] pt-3">
              <div className="flex items-center justify-between">
                <Label>Kamar Diasuh</Label>
                {selectedUnits.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="multi-kamar"
                      checked={mengasuhLebihDari1Kamar}
                      onCheckedChange={(checked) => setMengasuhLebihDari1Kamar(!!checked)}
                    />
                    <Label htmlFor="multi-kamar" className="font-normal text-xs cursor-pointer">
                      Mengasuh lebih dari 1 kamar
                    </Label>
                  </div>
                )}
              </div>
              {selectedUnits.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)] italic">
                  Pilih unit mengajar terlebih dahulu untuk menampilkan daftar kamar.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Combobox
                      options={kamarOptions}
                      value={selectedKamarIds[0] ?? ''}
                      onSelect={() => {}}
                      onSearch={setKamarSearch}
                      placeholder="Cari kamar..."
                      isLoading={isKamarLoading}
                      emptyMessage={
                        kamarSearch
                          ? 'Kamar tidak ditemukan'
                          : 'Belum ada kamar untuk unit yang dipilih'
                      }
                    />
                  </div>
                  {kamarOptions.length > 0 ? (
                    <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-md border border-[var(--border)] p-2 bg-[var(--surface-2)]">
                      {kamarOptions.map((opt) => (
                        <div key={opt.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`kamar-${opt.value}`}
                            checked={selectedKamarIds.includes(opt.value)}
                            onCheckedChange={() => toggleKamar(opt.value)}
                          />
                          <Label htmlFor={`kamar-${opt.value}`} className="font-normal text-sm cursor-pointer">
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    kamarSearch && (
                      <p className="text-xs text-status-red italic mt-2">
                        Kamar tidak ditemukan
                      </p>
                    )
                  )}
                  {selectedKamarIds.length > 0 && (
                    <p className="text-xs text-[var(--text-secondary)]">
                      {selectedKamarIds.length} kamar dipilih
                    </p>
                  )}
                </>
              )}
            </div>
          )}

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

          <Button type="submit" className="w-full mt-6 bg-primary hover:bg-primary-hover text-white" isLoading={isPending}>
            Daftar Sebagai Pendidik
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
