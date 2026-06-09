'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, UserCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createAdminUsersColumns } from '@/app/(app)/admin/users/columns'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TooltipProvider,
} from '@/components/ui/tooltip'
import { toast } from '@/components/ui/use-toast'
import { createManageableUserByAdmin } from '@/lib/auth/actions'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import {
  approveUser,
  changeUserRole,
  deleteProfile,
  getManageableProfiles,
  revokeUser,
  updateManageableProfile,
} from '@/lib/queries/admin'
import type { ManageableRole } from '@/lib/queries/users'
import type { Profile } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const

type RoleFilter = 'all' | ManageableRole
type StatusFilter = 'all' | 'active' | 'pending'

const editProfileSchema = z.object({
  nama_lengkap: z.string().min(2, 'Nama minimal 2 karakter'),
  username: z
    .string()
    .min(3, 'Username minimal 3 karakter')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username hanya boleh huruf, angka, dan underscore'
    ),
  email: z.string().email('Format email tidak valid'),
  guru_mapel: z.string().min(1, 'Guru mapel wajib diisi'),
  role: z.enum(['user', 'admin']),
})

type EditProfileFormValues = z.infer<typeof editProfileSchema>

const createUserSchema = editProfileSchema.extend({
  password: z.string().min(8, 'Password minimal 8 karakter'),
})

type CreateUserFormValues = z.infer<typeof createUserSchema>

interface RoleChangeTarget {
  profile: Profile
  newRole: ManageableRole
}

function matchesSearch(profile: Profile, search: string): boolean {
  const term = search.trim().toLowerCase()
  if (!term) return true

  return (
    profile.nama_lengkap.toLowerCase().includes(term) ||
    profile.username.toLowerCase().includes(term) ||
    (profile.email?.toLowerCase().includes(term) ?? false)
  )
}

function getRoleChangeLabel(newRole: ManageableRole): string {
  return newRole === 'admin' ? 'Admin' : 'User'
}

export default function AdminUsersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAdmin, isLoading: authLoading, profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([])
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)

  const [roleChangeTarget, setRoleChangeTarget] =
    useState<RoleChangeTarget | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [approvalTarget, setApprovalTarget] = useState<Profile | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const editForm = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      nama_lengkap: '',
      username: '',
      email: '',
      guru_mapel: '',
      role: 'user',
    },
  })

  const createUserForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      nama_lengkap: '',
      username: '',
      email: '',
      password: '',
      guru_mapel: '',
      role: 'user',
    },
  })

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/dashboard')
    }
  }, [authLoading, isAdmin, router])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, statusFilter])

  const profileFilters = useMemo(
    () => ({
      role: roleFilter === 'all' ? undefined : roleFilter,
      isApproved:
        statusFilter === 'all'
          ? undefined
          : statusFilter === 'active',
    }),
    [roleFilter, statusFilter]
  )

  const { data: allProfiles = [], isLoading } = useQuery({
    queryKey: ['admin-profiles-manageable', profileFilters],
    queryFn: () => getManageableProfiles(profileFilters),
    enabled: isAdmin,
  })

  const filteredProfiles = useMemo(
    () => allProfiles.filter((item) => matchesSearch(item, debouncedSearch)),
    [allProfiles, debouncedSearch]
  )

  const paginatedProfiles = useMemo(() => {
    const from = (page - 1) * pageSize
    return filteredProfiles.slice(from, from + pageSize)
  }, [filteredProfiles, page, pageSize])

  const getUserId = useCallback((): string => {
    const userId = profile?.user_id
    if (!userId) throw new Error('Sesi tidak valid')
    return userId
  }, [profile?.user_id])

  const invalidateProfiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-profiles-manageable'] })
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
      setApprovalTarget(null)
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
      setApprovalTarget(null)
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
      newRole: ManageableRole
    }) => changeUserRole(profileId, newRole, getUserId()),
    onSuccess: () => {
      invalidateProfiles()
      setRoleChangeTarget(null)
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

  const updateProfileMutation = useMutation({
    mutationFn: ({
      profileId,
      values,
    }: {
      profileId: string
      values: EditProfileFormValues
    }) => updateManageableProfile(profileId, values, getUserId()),
    onSuccess: () => {
      invalidateProfiles()
      setIsEditOpen(false)
      setEditingProfile(null)
      editForm.reset()
      toast({
        title: 'Berhasil',
        description: 'Data pengguna berhasil diperbarui',
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

  const createUserMutation = useMutation({
    mutationFn: (values: CreateUserFormValues) =>
      createManageableUserByAdmin(values),
    onSuccess: (result) => {
      if (result.error) {
        toast({
          title: 'Gagal',
          description: result.error,
          variant: 'destructive',
        })
        return
      }

      invalidateProfiles()
      setIsAddOpen(false)
      createUserForm.reset()
      toast({
        title: 'Berhasil',
        description: 'Pengguna baru berhasil ditambahkan',
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

  const isActionPending =
    approveMutation.isPending ||
    revokeMutation.isPending ||
    changeRoleMutation.isPending ||
    updateProfileMutation.isPending ||
    deleteMutation.isPending ||
    createUserMutation.isPending

  const handleOpenEdit = useCallback(
    (item: Profile) => {
      setEditingProfile(item)
      editForm.reset({
        nama_lengkap: item.nama_lengkap,
        username: item.username,
        email: item.email ?? '',
        guru_mapel: item.guru_mapel ?? '',
        role: item.role === 'admin' ? 'admin' : 'user',
      })
      setIsEditOpen(true)
    },
    [editForm]
  )

  const columns = useMemo(
    () =>
      createAdminUsersColumns({
        page,
        pageSize,
        onRequestApprovalChange: setApprovalTarget,
        onRequestRoleChange: (profileItem, newRole) =>
          setRoleChangeTarget({ profile: profileItem, newRole }),
        onEdit: handleOpenEdit,
        onDelete: (profileId) => {
          setDeleteTargetIds([profileId])
          setIsDeleteOpen(true)
        },
        isActionPending,
      }),
    [
      page,
      pageSize,
      handleOpenEdit,
      isActionPending,
    ]
  )

  const selectedPendingIds = useMemo(() => {
    return selectedRows.filter((id) => {
      const item = filteredProfiles.find((row) => row.id === id)
      return item && !item.is_approved
    })
  }, [filteredProfiles, selectedRows])

  const handleSortChange = useCallback(() => {
    // Client-side table without server sort
  }, [])

  const onSubmitEdit = (values: EditProfileFormValues) => {
    if (!editingProfile) return
    updateProfileMutation.mutate({
      profileId: editingProfile.id,
      values,
    })
  }

  const onSubmitCreateUser = (values: CreateUserFormValues) => {
    createUserMutation.mutate(values)
  }

  const isApprovalPending =
    approveMutation.isPending || revokeMutation.isPending

  if (authLoading || !isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <PageHeader title="Kelola User" />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                placeholder="Cari nama, username, atau email..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="shrink-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Pengguna
            </Button>
          </div>

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
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as StatusFilter)
              }
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
                selectedPendingIds.length === 0 ||
                bulkApproveMutation.isPending
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
              Hapus Terpilih
            </Button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={paginatedProfiles}
          pagination={{
            page,
            pageSize,
            total: filteredProfiles.length,
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

        <AlertDialog
          open={approvalTarget !== null}
          onOpenChange={(open) => {
            if (!open) setApprovalTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {approvalTarget?.is_approved
                  ? 'Cabut Persetujuan Pengguna'
                  : 'Setujui Pengguna'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {approvalTarget
                  ? approvalTarget.is_approved
                    ? `Apakah Anda yakin ingin mencabut persetujuan dan menonaktifkan akun ${approvalTarget.nama_lengkap} ini?`
                    : `Apakah Anda yakin ingin menyetujui akun ${approvalTarget.nama_lengkap} ini?`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isApprovalPending}>
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isApprovalPending}
                onClick={(event) => {
                  event.preventDefault()
                  if (!approvalTarget) return

                  if (approvalTarget.is_approved) {
                    revokeMutation.mutate(approvalTarget.id)
                  } else {
                    approveMutation.mutate(approvalTarget.id)
                  }
                }}
              >
                {isApprovalPending ? 'Memproses...' : 'Ya, Lanjutkan'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={roleChangeTarget !== null}
          onOpenChange={(open) => {
            if (!open) setRoleChangeTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ubah Hak Akses</AlertDialogTitle>
              <AlertDialogDescription>
                {roleChangeTarget
                  ? `Apakah Anda yakin ingin mengubah hak akses ${roleChangeTarget.profile.nama_lengkap} menjadi ${getRoleChangeLabel(roleChangeTarget.newRole)}?`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={changeRoleMutation.isPending}>
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={changeRoleMutation.isPending}
                onClick={(event) => {
                  event.preventDefault()
                  if (!roleChangeTarget) return
                  changeRoleMutation.mutate({
                    profileId: roleChangeTarget.profile.id,
                    newRole: roleChangeTarget.newRole,
                  })
                }}
              >
                {changeRoleMutation.isPending ? 'Memproses...' : 'Ya, Ubah'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddOpen(false)
              createUserForm.reset()
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Tambah Pengguna Baru</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={createUserForm.handleSubmit(onSubmitCreateUser)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="create-nama_lengkap">Nama Lengkap</Label>
                <Input
                  id="create-nama_lengkap"
                  {...createUserForm.register('nama_lengkap')}
                />
                {createUserForm.formState.errors.nama_lengkap && (
                  <p className="text-xs text-status-red">
                    {createUserForm.formState.errors.nama_lengkap.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-username">Username</Label>
                <Input
                  id="create-username"
                  {...createUserForm.register('username')}
                />
                {createUserForm.formState.errors.username && (
                  <p className="text-xs text-status-red">
                    {createUserForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  {...createUserForm.register('email')}
                />
                {createUserForm.formState.errors.email && (
                  <p className="text-xs text-status-red">
                    {createUserForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-password">Password</Label>
                <Input
                  id="create-password"
                  type="password"
                  autoComplete="new-password"
                  {...createUserForm.register('password')}
                />
                {createUserForm.formState.errors.password && (
                  <p className="text-xs text-status-red">
                    {createUserForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-guru_mapel">Guru Mapel / Jabatan</Label>
                <Input
                  id="create-guru_mapel"
                  {...createUserForm.register('guru_mapel')}
                />
                {createUserForm.formState.errors.guru_mapel && (
                  <p className="text-xs text-status-red">
                    {createUserForm.formState.errors.guru_mapel.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-role">Role</Label>
                <Select
                  value={createUserForm.watch('role')}
                  onValueChange={(value) =>
                    createUserForm.setValue('role', value as ManageableRole, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="create-role">
                    <SelectValue placeholder="Pilih role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {createUserForm.formState.errors.role && (
                  <p className="text-xs text-status-red">
                    {createUserForm.formState.errors.role.message}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false)
                    createUserForm.reset()
                  }}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  isLoading={createUserMutation.isPending}
                >
                  Simpan Pengguna
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsEditOpen(false)
              setEditingProfile(null)
              editForm.reset()
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Data Pengguna</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="edit-nama_lengkap">Nama Lengkap</Label>
                <Input
                  id="edit-nama_lengkap"
                  {...editForm.register('nama_lengkap')}
                />
                {editForm.formState.errors.nama_lengkap && (
                  <p className="text-xs text-status-red">
                    {editForm.formState.errors.nama_lengkap.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  {...editForm.register('username')}
                />
                {editForm.formState.errors.username && (
                  <p className="text-xs text-status-red">
                    {editForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  {...editForm.register('email')}
                />
                {editForm.formState.errors.email && (
                  <p className="text-xs text-status-red">
                    {editForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-guru_mapel">Guru Mapel</Label>
                <Input
                  id="edit-guru_mapel"
                  {...editForm.register('guru_mapel')}
                />
                {editForm.formState.errors.guru_mapel && (
                  <p className="text-xs text-status-red">
                    {editForm.formState.errors.guru_mapel.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editForm.watch('role')}
                  onValueChange={(value) =>
                    editForm.setValue('role', value as ManageableRole, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Pilih role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {editForm.formState.errors.role && (
                  <p className="text-xs text-status-red">
                    {editForm.formState.errors.role.message}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditOpen(false)
                    setEditingProfile(null)
                    editForm.reset()
                  }}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  isLoading={updateProfileMutation.isPending}
                >
                  Simpan Perubahan
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

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
    </TooltipProvider>
  )
}
