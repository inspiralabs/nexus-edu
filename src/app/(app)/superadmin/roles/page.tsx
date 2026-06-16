'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { KeyRound, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit/log'
import {
  approveUser,
  deleteProfile,
  getAllProfiles,
  revokeUser,
} from '@/lib/queries/admin'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const
const ALL_ROLES: Role[] = ['user', 'admin', 'superadmin']

type RoleFilter = 'all' | Role
type StatusFilter = 'all' | 'active' | 'pending'

type AuditProfileRow = Pick<
  Profile,
  | 'id'
  | 'user_id'
  | 'nama_lengkap'
  | 'username'
  | 'role'
  | 'is_approved'
  | 'avatar_url'
  | 'email'
  | 'created_at'
  | 'updated_at'
>

function profileToAuditData(profile: AuditProfileRow): Record<string, unknown> {
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

async function fetchProfileById(profileId: string): Promise<Profile> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single()

  if (error) throw new Error(error.message)
  return data as Profile
}

async function changeProfileRoleAsSuperadmin(
  profileId: string,
  newRole: Role,
  changingUserId: string
): Promise<void> {
  const supabase = createClient()
  const oldProfile = await fetchProfileById(profileId)
  const updatedAt = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole, updated_at: updatedAt })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  const verifiedProfile = await fetchProfileById(profileId)

  if (verifiedProfile.role !== newRole) {
    throw new Error('Gagal mengubah role pengguna')
  }

  await logAudit(
    changingUserId,
    'CHANGE_ROLE',
    'profiles',
    profileId,
    profileToAuditData(oldProfile),
    profileToAuditData(verifiedProfile)
  )
}

async function deleteProfileAsSuperadmin(
  profileId: string,
  deletingUserId: string,
  currentProfileId: string
): Promise<void> {
  if (profileId === currentProfileId) {
    throw new Error('Tidak dapat menghapus akun sendiri')
  }

  const supabase = createClient()
  const oldProfile = await fetchProfileById(profileId)

  const { error } = await supabase.from('profiles').delete().eq('id', profileId)

  if (error) throw new Error(error.message)

  const { data: remainingProfile, error: verifyError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle()

  if (verifyError) throw new Error(verifyError.message)

  if (remainingProfile) {
    throw new Error('Gagal menghapus pengguna')
  }

  await logAudit(
    deletingUserId,
    'DELETE',
    'profiles',
    profileId,
    profileToAuditData(oldProfile),
    null
  )
}

function formatTanggal(value: string): string {
  try {
    return format(parseISO(value), 'dd/MM/yyyy')
  } catch {
    return format(new Date(value), 'dd/MM/yyyy')
  }
}

export default function SuperadminRolesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isSuperadmin, isLoading: authLoading, profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)

  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      router.replace('/dashboard')
    }
  }, [authLoading, isSuperadmin, router])

  useEffect(() => {
    setPage(1)
  }, [roleFilter, statusFilter])

  const profileFilters = useMemo(
    () => ({
      role: roleFilter === 'all' ? undefined : roleFilter,
      isApproved:
        statusFilter === 'all'
          ? undefined
          : statusFilter === 'active',
      page,
      pageSize,
    }),
    [roleFilter, statusFilter, page, pageSize]
  )

  const { data: profilesResult, isLoading } = useQuery({
    queryKey: ['superadmin-all-profiles', profileFilters],
    queryFn: () => getAllProfiles(profileFilters),
    enabled: isSuperadmin,
  })

  const getUserId = useCallback((): string => {
    const userId = profile?.user_id
    if (!userId) throw new Error('Sesi tidak valid')
    return userId
  }, [profile?.user_id])

  const invalidateProfiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['superadmin-all-profiles'] })
    queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
  }, [queryClient])

  const approvalMutation = useMutation({
    mutationFn: ({
      profileId,
      approved,
    }: {
      profileId: string
      approved: boolean
    }) =>
      approved
        ? approveUser(profileId, getUserId())
        : revokeUser(profileId, getUserId()),
    onSuccess: () => {
      invalidateProfiles()
      toast({
        title: 'Berhasil',
        description: 'Status persetujuan berhasil diperbarui',
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

  const roleMutation = useMutation({
    mutationFn: ({
      profileId,
      newRole,
    }: {
      profileId: string
      newRole: Role
    }) => changeProfileRoleAsSuperadmin(profileId, newRole, getUserId()),
    onSuccess: () => {
      invalidateProfiles()
      toast({
        title: 'Berhasil',
        description: 'Role pengguna berhasil diubah',
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

  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast({
        title: 'Berhasil',
        description: 'Email reset dikirim',
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

  const deleteMutation = useMutation({
    mutationFn: async (target: Profile) => {
      const userId = getUserId()
      if (!profile?.id) throw new Error('Sesi tidak valid')

      if (target.role === 'user' || target.role === 'admin') {
        await deleteProfile(target.id, userId)
        return
      }

      await deleteProfileAsSuperadmin(target.id, userId, profile.id)
    },
    onSuccess: () => {
      invalidateProfiles()
      setDeleteTarget(null)
      toast({
        title: 'Berhasil',
        description: 'Akun berhasil dihapus',
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

  const isActionPending =
    approvalMutation.isPending ||
    roleMutation.isPending ||
    resetPasswordMutation.isPending ||
    deleteMutation.isPending

  const columns = useMemo<ColumnDef<Profile>[]>(() => {
    const rowOffset = (page - 1) * pageSize

    return [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => rowOffset + row.index + 1,
      },
      {
        accessorKey: 'nama_lengkap',
        header: 'Nama',
        enableSorting: false,
      },
      {
        accessorKey: 'username',
        header: 'Username',
        enableSorting: false,
        cell: ({ row }) => `@${row.original.username}`,
      },
      {
        accessorKey: 'email',
        header: 'Email',
        enableSorting: false,
        cell: ({ row }) => row.original.email ?? '-',
      },
      {
        accessorKey: 'role',
        header: 'Role',
        enableSorting: false,
        cell: ({ row }) => (
          <Select
            value={row.original.role}
            disabled={isActionPending || row.original.id === profile?.id}
            onValueChange={(value) =>
              roleMutation.mutate({
                profileId: row.original.id,
                newRole: value as Role,
              })
            }
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        accessorKey: 'is_approved',
        header: 'Disetujui',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.original.is_approved}
              disabled={isActionPending || row.original.id === profile?.id}
              onCheckedChange={(checked) =>
                approvalMutation.mutate({
                  profileId: row.original.id,
                  approved: checked,
                })
              }
              aria-label={`Toggle persetujuan ${row.original.nama_lengkap}`}
            />
            <Badge
              variant={row.original.is_approved ? 'success' : 'warning'}
            >
              {row.original.is_approved ? 'Aktif' : 'Pending'}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Tgl Daftar',
        enableSorting: false,
        cell: ({ row }) => formatTanggal(row.original.created_at),
      },
      {
        id: 'actions',
        header: 'Aksi',
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original
          const isSelf = item.id === profile?.id

          return (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  isActionPending || !item.email || isSelf
                }
                onClick={() => {
                  if (!item.email) return
                  resetPasswordMutation.mutate(item.email)
                }}
              >
                <KeyRound className="mr-1 h-4 w-4" />
                Reset
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isActionPending || isSelf}
                onClick={() => setDeleteTarget(item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      },
    ]
  }, [
    page,
    pageSize,
    isActionPending,
    profile?.id,
    approvalMutation,
    roleMutation,
    resetPasswordMutation,
  ])

  const handleSortChange = useCallback(() => {
    // Server-side pagination without client sort
  }, [])

  if (authLoading || !isSuperadmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Role Management" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={roleFilter}
          onValueChange={(value) => setRoleFilter(value as RoleFilter)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Role</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="superadmin">Superadmin</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={profilesResult?.data ?? []}
        pagination={{
          page,
          pageSize,
          total: profilesResult?.total ?? 0,
        }}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onSortChange={handleSortChange}
        isLoading={isLoading}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Hapus Akun"
        description={
          deleteTarget
            ? `Apakah Anda yakin ingin menghapus akun ${deleteTarget.nama_lengkap}? Tindakan ini tidak dapat dibatalkan.`
            : ''
        }
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteMutation.mutate(deleteTarget)
        }}
      />
    </div>
  )
}
