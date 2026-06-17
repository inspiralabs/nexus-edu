'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  createTipeNilai,
  deleteTipeNilai,
  getTipeNilai,
  updateTipeNilai,
  type CreateTipeNilaiInput,
} from '@/lib/queries/tipe-nilai'
import type { TipeNilaiDb } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const
const JENIS_NILAI_OPTIONS = ['Harian', 'Ujian Akhir Bab', 'Ujian Akhir Semester'] as const

const tipeNilaiSchema = z.object({
  nama_tipe: z.string().min(2, 'Nama tipe minimal 2 karakter'),
  jenis_nilai: z.enum(['Harian', 'Ujian Akhir Bab', 'Ujian Akhir Semester'], {
    message: 'Pilih jenis nilai',
  }),
  deskripsi: z.string().nullable().optional().or(z.literal('')),
})

type TipeNilaiFormValues = z.infer<typeof tipeNilaiSchema>

function tipeNilaiToRecord(item: TipeNilaiDb): Record<string, unknown> {
  return {
    id: item.id,
    nama_tipe: item.nama_tipe,
    jenis_nilai: item.jenis_nilai,
    deskripsi: item.deskripsi,
    created_at: item.created_at,
  }
}

export default function TipeNilaiPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  // Guard: Hanya admin & superadmin
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'superadmin'

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TipeNilaiDb | null>(null)
  const [deletingItem, setDeletingItem] = useState<TipeNilaiDb | null>(null)

  const debouncedSearch = useDebounce(search, 300)
  const isFormOpen = isAddOpen || isEditOpen

  const form = useForm<TipeNilaiFormValues>({
    resolver: zodResolver(tipeNilaiSchema),
    defaultValues: { nama_tipe: '', jenis_nilai: 'Harian', deskripsi: '' },
  })

  // Fetch list
  const { data: allData = [], isLoading } = useQuery({
    queryKey: ['tipe-nilai-all'],
    queryFn: () => getTipeNilai(),
    enabled: isAuthorized,
  })

  // Local filtering & pagination (client-side search for simplicity)
  const filteredData = useMemo(() => {
    if (!debouncedSearch) return allData
    return allData.filter((item) =>
      item.nama_tipe.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      item.jenis_nilai.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (item.deskripsi && item.deskripsi.toLowerCase().includes(debouncedSearch.toLowerCase()))
    )
  }, [allData, debouncedSearch])

  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    const to = from + pageSize
    return filteredData.slice(from, to)
  }, [filteredData, page, pageSize])

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tipe-nilai-all'] })
  }, [queryClient])

  const closeFormDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    form.reset({ nama_tipe: '', jenis_nilai: 'Harian', deskripsi: '' })
  }

  const openAddDialog = () => {
    setEditingItem(null)
    form.reset({ nama_tipe: '', jenis_nilai: 'Harian', deskripsi: '' })
    setIsAddOpen(true)
  }

  const openEditDialog = (item: TipeNilaiDb) => {
    setEditingItem(item)
    form.reset({
      nama_tipe: item.nama_tipe,
      jenis_nilai: item.jenis_nilai,
      deskripsi: item.deskripsi ?? '',
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (item: TipeNilaiDb) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateTipeNilaiInput) => createTipeNilai(input),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'tipe_nilai', result.id, null, tipeNilaiToRecord(result))
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Tipe nilai berhasil ditambahkan' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CreateTipeNilaiInput }) =>
      updateTipeNilai(id, values),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId && editingItem) {
        await logAudit(
          userId,
          'UPDATE',
          'tipe_nilai',
          result.id,
          tipeNilaiToRecord(editingItem),
          tipeNilaiToRecord(result)
        )
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Tipe nilai berhasil diperbarui' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTipeNilai(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(userId, 'DELETE', 'tipe_nilai', id, tipeNilaiToRecord(deletingItem), null)
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Tipe nilai berhasil dihapus' })
      setIsDeleteOpen(false)
      setDeletingItem(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (values: TipeNilaiFormValues) => {
    const payload: CreateTipeNilaiInput = {
      nama_tipe: values.nama_tipe,
      jenis_nilai: values.jenis_nilai,
      deskripsi: values.deskripsi && values.deskripsi !== '' ? values.deskripsi : null,
    }

    if (isEditOpen && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const columns = useMemo<ColumnDef<TipeNilaiDb>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_tipe',
        header: 'Nama Tipe Nilai',
        cell: ({ row }) => (
          <span className="font-semibold text-[var(--text-primary)]">
            {row.original.nama_tipe}
          </span>
        ),
      },
      {
        accessorKey: 'jenis_nilai',
        header: 'Jenis Nilai',
        cell: ({ row }) => row.original.jenis_nilai,
      },
      {
        accessorKey: 'deskripsi',
        header: 'Deskripsi',
        cell: ({ row }) => row.original.deskripsi ?? '-',
      },
      {
        id: 'actions',
        header: 'Aksi',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openEditDialog(row.original)}
              aria-label="Edit tipe nilai"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus tipe nilai"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize]
  )

  if (!isAuthorized) {
    return (
      <div className="p-6 text-center text-status-red">
        Akses Ditolak: Halaman ini hanya untuk Administrator.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Tipe Nilai"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Tipe Nilai
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <Input
          placeholder="Cari tipe nilai..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={paginatedData}
        pagination={{ page, pageSize, total: filteredData.length }}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onSortChange={() => {}}
        isLoading={isLoading}
      />

      {/* Dialog Tambah/Edit */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) closeFormDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Tipe Nilai' : 'Tambah Tipe Nilai Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nama Tipe */}
            <div className="space-y-2">
              <Label htmlFor="nama_tipe">Nama Tipe Nilai</Label>
              <Input
                id="nama_tipe"
                {...form.register('nama_tipe')}
                placeholder="cth: Kuis 1, Penilaian Harian"
              />
              {form.formState.errors.nama_tipe && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_tipe.message}
                </p>
              )}
            </div>

            {/* Jenis Nilai */}
            <div className="space-y-2">
              <Label htmlFor="jenis_nilai">Jenis Nilai</Label>
              <Select
                value={form.watch('jenis_nilai')}
                onValueChange={(value) =>
                  form.setValue('jenis_nilai', value as any, { shouldValidate: true })
                }
              >
                <SelectTrigger id="jenis_nilai">
                  <SelectValue placeholder="Pilih jenis nilai" />
                </SelectTrigger>
                <SelectContent>
                  {JENIS_NILAI_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.jenis_nilai && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.jenis_nilai.message}
                </p>
              )}
            </div>

            {/* Deskripsi */}
            <div className="space-y-2">
              <Label htmlFor="deskripsi">Deskripsi</Label>
              <Textarea
                id="deskripsi"
                {...form.register('deskripsi')}
                placeholder="cth: Digunakan untuk penilaian kuis mingguan"
              />
              {form.formState.errors.deskripsi && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.deskripsi.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeFormDialog}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : isEditOpen ? 'Simpan' : 'Tambah'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Tipe Nilai"
        description={`Apakah Anda yakin ingin menghapus tipe nilai "${deletingItem?.nama_tipe}"? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) deleteMutation.mutate(deletingItem.id)
        }}
      />
    </div>
  )
}
