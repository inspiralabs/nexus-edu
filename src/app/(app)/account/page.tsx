'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit/log'
import {
  changePassword,
  updateProfile,
  uploadAvatar,
} from '@/lib/queries/profile'
import { getAllMapel } from '@/lib/queries/admin-extended'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/lib/supabase/types'

const profileSchema = z.object({
  nama_lengkap: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
})

const passwordSchema = z
  .object({
    password_baru: z
      .string()
      .min(8, 'Password baru minimal 8 karakter'),
    konfirmasi_password: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((data) => data.password_baru === data.konfirmasi_password, {
    message: 'Konfirmasi password tidak cocok',
    path: ['konfirmasi_password'],
  })

type ProfileFormValues = z.infer<typeof profileSchema>
type PasswordFormValues = z.infer<typeof passwordSchema>

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getRoleLabel(role: Role): string {
  if (role === 'superadmin') return 'Super Admin'
  if (role === 'admin') return 'Admin'
  return 'User'
}

function getRoleBadgeVariant(
  role: Role
): 'default' | 'secondary' | 'outline' {
  if (role === 'superadmin') return 'secondary'
  if (role === 'admin') return 'default'
  return 'outline'
}

function profileToRecord(profile: Profile): Record<string, unknown> {
  return {
    id: profile.id,
    user_id: profile.user_id,
    nama_lengkap: profile.nama_lengkap,
    username: profile.username,
    role: profile.role,
    is_approved: profile.is_approved,
    avatar_url: profile.avatar_url,
    email: profile.email,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }
}

async function refreshAuthContext(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.refreshSession()
  if (error) throw new Error(error.message)
}

export default function AccountPage() {
  const router = useRouter()
  const { profile, isLoading, refreshProfile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nama_lengkap: '',
    },
  })

  const { data: allMapel = [] } = useQuery({
    queryKey: ['all-mapel'],
    queryFn: () => getAllMapel(),
    enabled: profile?.role === 'user',
  })

  const userMapelNames = useMemo(() => {
    if (!profile?.mapel_ids || profile.mapel_ids.length === 0) return '-'
    return profile.mapel_ids
      .map((id) => allMapel.find((m) => m.id === id)?.nama_mapel)
      .filter(Boolean)
      .join(', ') || '-'
  }, [profile?.mapel_ids, allMapel])

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password_baru: '',
      konfirmasi_password: '',
    },
  })

  useEffect(() => {
    if (profile) {
      profileForm.reset({
        nama_lengkap: profile.nama_lengkap,
      })
      setAvatarPreview(profile.avatar_url)
    }
  }, [profile, profileForm])

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!profile?.user_id) {
        throw new Error('Profil tidak ditemukan')
      }
      return uploadAvatar(profile.user_id, file)
    },
    onSuccess: async (publicUrl) => {
      if (profile?.user_id) {
        await logAudit(
          profile.user_id,
          'UPDATE',
          'profiles',
          profile.id,
          profileToRecord(profile),
          { ...profileToRecord(profile), avatar_url: publicUrl }
        )
      }
      await refreshProfile()
      router.refresh()
      setAvatarPreview(publicUrl)
      toast({
        title: 'Berhasil',
        description: 'Foto profil berhasil diperbarui',
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!profile?.user_id) {
        throw new Error('Profil tidak ditemukan')
      }
      return updateProfile(profile.user_id, values)
    },
    onSuccess: async (updatedProfile) => {
      if (profile?.user_id) {
        await logAudit(
          profile.user_id,
          'UPDATE',
          'profiles',
          updatedProfile.id,
          profileToRecord(profile),
          profileToRecord(updatedProfile)
        )
      }
      await refreshAuthContext()
      profileForm.reset({
        nama_lengkap: updatedProfile.nama_lengkap,
      })
      toast({
        title: 'Berhasil',
        description: 'Profil berhasil diperbarui',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: (values: PasswordFormValues) =>
      changePassword(values.password_baru),
    onSuccess: async () => {
      if (profile?.user_id) {
        await logAudit(
          profile.user_id,
          'UPDATE',
          'profiles',
          profile.id,
          profileToRecord(profile),
          { ...profileToRecord(profile), password_changed: true }
        )
      }
      passwordForm.reset({
        password_baru: '',
        konfirmasi_password: '',
      })
      toast({
        title: 'Berhasil',
        description: 'Password berhasil diubah',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    uploadAvatarMutation.mutate(file)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sm text-text-secondary">
        Profil tidak ditemukan
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              {avatarPreview && (
                <AvatarImage
                  src={avatarPreview}
                  alt={profile.nama_lengkap}
                />
              )}
              <AvatarFallback className="text-lg">
                {getInitials(profile.nama_lengkap)}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={uploadAvatarMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              Ganti Foto
            </Button>
          </div>

          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                Email
              </span>
              <span className="text-sm text-text-secondary">
                {profile.email ?? '-'}
              </span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                Username
              </span>
              <span className="text-sm text-text-secondary">
                {profile.username}
              </span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                Role
              </span>
              <Badge variant={getRoleBadgeVariant(profile.role)}>
                {getRoleLabel(profile.role)}
              </Badge>
            </div>
            {profile.role === 'user' && (
              <>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Tipe Pendidik
                  </span>
                  <span className="text-sm text-text-secondary font-medium">
                    {profile.tipe_role === 'guru' ? 'Guru DIKNAS' : profile.tipe_role === 'musyrif' ? 'Musyrif/ah' : profile.tipe_role === 'guru_musyrif' ? 'Guru & Musyrif' : '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Mata Pelajaran
                  </span>
                  <span className="text-sm text-text-secondary font-medium">
                    {userMapelNames}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit((values) =>
              updateProfileMutation.mutate(values)
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nama_lengkap">Nama Lengkap</Label>
              <Input
                id="nama_lengkap"
                {...profileForm.register('nama_lengkap')}
              />
              {profileForm.formState.errors.nama_lengkap && (
                <p className="text-xs text-status-red">
                  {profileForm.formState.errors.nama_lengkap.message}
                </p>
              )}
            </div>



            <Button
              type="submit"
              isLoading={updateProfileMutation.isPending}
            >
              Simpan Perubahan
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ganti Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((values) =>
              changePasswordMutation.mutate(values)
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="password_baru">Password Baru</Label>
              <div className="relative">
                <Input
                  id="password_baru"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-10"
                  {...passwordForm.register('password_baru')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {passwordForm.formState.errors.password_baru && (
                <p className="text-xs text-status-red">
                  {passwordForm.formState.errors.password_baru.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="konfirmasi_password">
                Konfirmasi Password Baru
              </Label>
              <div className="relative">
                <Input
                  id="konfirmasi_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-10"
                  {...passwordForm.register('konfirmasi_password')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password baru' : 'Tampilkan konfirmasi password baru'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {passwordForm.formState.errors.konfirmasi_password && (
                <p className="text-xs text-status-red">
                  {passwordForm.formState.errors.konfirmasi_password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              isLoading={changePasswordMutation.isPending}
            >
              Ganti Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
