'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { Trash2, UserCheck, UserCog, UserX } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import {
  approveUser,
  changeUserRole,
  deleteProfile,
  getAllProfiles,
  revokeUser,
} from '@/lib/queries/admin'
import type { Profile, Role } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const
const ASSIGNABLE_ROLES: Role[] = ['user', 'admin']

type RoleFilter = 'all' | Role
type StatusFilter = 'all' | 'active' | 'pending'

function formatTanggal(value: string): string {
  try {
    return format(parseISO(value), 'dd/MM/yyyy')
  } catch {
    return format(new Date(value), 'dd/MM/yyyy')
  }
}

function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'admin':
      return 'secondary'
    case 'user':
    case 'superadmin':
      return 'default'
    default:
      return 'outline'
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'superadmin':
      return 'Superadmin'
    case 'admin':
      return 'Admin'
    case 'user':
      return 'User'
    default:
      return role
  }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAdmin, isLoading: authLoading, profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([])
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/dashboard')
    }
  }, [authLoading, isAdmin, router])

  const queryOptions = useMemo(
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

  const { data, isLoading } = useQuery({
    queryKey: ['admin-profiles', queryOptions],
    queryFn: () => getAllProfiles(queryOptions),
    enabled: isAdmin,
  })

  const getUserId = useCallback((): string => {
    const userId = profile?.user_id
    if (!userId) throw new Error('Sesi tidak valid')
    return userId
  }, [profile?.user_id])

  const invalidateProfiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    queryClient.invalidateQueries({ queryKey: ['admin-pending-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-recent-audit'] })
  }, [queryClient])

  const approveMutation = useMutation({
    mutationFn: (profileId: string) =>
      approveUser(profileId, getUserId()),
    onSuccess: () => {
      invalidateProfiles()
      toast({
        title: 'Berhasil',
        description: 'User berhasil disetujui',
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

  const revokeMutation = useMutation({
    mutationFn: (profileId: string) =>
      revokeUser(profileId, getUserId()),
    onSuccess: () => {
      invalidateProfiles()
      toast({
        title: 'Berhasil',
        description: 'Persetujuan user berhasil dicabut',
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

  const changeRoleMutation = useMutation({
    mutationFn: ({
      profileId,
      newRole,
    }: {
      profileId: string
      newRole: Role
    }) => changeUserRole(profileId, newRole, getUserId()),
    onSuccess: () => {
      invalidateProfiles()
      toast({
        title: 'Berhasil',
        description: 'Role user berhasil diubah',
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
    mutationFn: (profileIds: string[]) =>
      Promise.all(profileIds.map((id) => deleteProfile(id, getUserId()))),
    onSuccess: (_, profileIds) => {
      invalidateProfiles()
      setSelectedRows((prev) =>
        prev.filter((id) => !profileIds.includes(id))
      )
      setDeleteTargetIds([])
      setIsDeleteOpen(false)
      setIsBulkDeleteOpen(false)
      toast({
        title: 'Berhasil',
        description:
          profileIds.length > 1
            ? `${profileIds.length} user berhasil dihapus`
            : 'User berhasil dihapus',
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

  const bulkApproveMutation = useMutation({
    mutationFn: (profileIds: string[]) =>
      Promise.all(profileIds.map((id) => approveUser(id, getUserId()))),
    onSuccess: (_, profileIds) => {
      invalidateProfiles()
      toast({
        title: 'Berhasil',
        description: `${profileIds.length} user berhasil disetujui`,
      })
      setSelectedRows([])
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleSortChange = useCallback(() => {
    // Sorting handled server-side via created_at DESC in query
  }, [])

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
        accessorKey: 'guru_mapel',
        header: 'Guru Mapel',
        enableSorting: false,
        cell: ({ row }) => row.original.guru_mapel ?? '-',
      },
      {
        accessorKey: 'role',
        header: 'Role',
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={getRoleBadgeVariant(row.original.role ?? '')}>
            {row.original.role || 'Belum Ada Role'}
          </Badge>
        ),
      },
      {
        accessorKey: 'is_approved',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const isApproved = row.original.is_approved === true
          return (
            <Badge variant={isApproved ? 'success' : 'warning'}>
              {isApproved ? 'Aktif' : 'Pending'}
            </Badge>
          )
        },
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
          const isSuperadmin = item.role === 'superadmin'

          return (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={
                  item.is_approved ? 'Cabut persetujuan' : 'Setujui user'
                }
                onClick={() => {
                  if (item.is_approved) {
                    revokeMutation.mutate(item.id)
                  } else {
                    approveMutation.mutate(item.id)
                  }
                }}
                disabled={
                  approveMutation.isPending || revokeMutation.isPending
                }
              >
                {item.is_approved ? (
                  <UserX className="h-4 w-4" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
              </Button>

              {!isSuperadmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Ubah role"
                    >
                      <UserCog className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {ASSIGNABLE_ROLES.map((role) => (
                      <DropdownMenuItem
                        key={role}
                        disabled={item.role === role}
                        onClick={() =>
                          changeRoleMutation.mutate({
                            profileId: item.id,
                            newRole: role,
                          })
                        }
                      >
                        Jadikan {getRoleLabel(role)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Hapus user"
                onClick={() => {
                  setDeleteTargetIds([item.id])
                  setIsDeleteOpen(true)
                }}
              >
                <Trash2 className="h-4 w-4 text-status-red" />
              </Button>
            </div>
          )
        },
      },
    ]
  }, [page, pageSize, approveMutation, revokeMutation, changeRoleMutation])

  const selectedPendingIds = useMemo(() => {
    const rows = data?.data ?? []
    return selectedRows.filter((id) => {
      const item = rows.find((row) => row.id === id)
      return item && !item.is_approved
    })
  }, [data?.data, selectedRows])

  if (authLoading || !isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kelola User" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setRoleFilter(value as RoleFilter)
            setPage(1)
          }}
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
          onValueChange={(value) => {
            setStatusFilter(value as StatusFilter)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <span className="text-sm text-[var(--text-primary)]">
            {selectedRows.length} item terpilih
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              selectedPendingIds.length === 0 || bulkApproveMutation.isPending
            }
            onClick={() => bulkApproveMutation.mutate(selectedPendingIds)}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Setujui Terpilih
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setIsBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus Terpilih
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pagination={{
          page,
          pageSize,
          total: data?.total ?? 0,
        }}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onSortChange={handleSortChange}
        selectedRows={selectedRows}
        onSelectRows={setSelectedRows}
        isLoading={isLoading}
      />

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus User"
        description="Apakah Anda yakin ingin menghapus profil user ini? Akun autentikasi tidak dihapus dari sistem."
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTargetIds)}
      />

      <ConfirmDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        title="Hapus User Terpilih"
        description={`Apakah Anda yakin ingin menghapus ${selectedRows.length} profil user terpilih? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(selectedRows)}
      />
    </div>
  )
}
