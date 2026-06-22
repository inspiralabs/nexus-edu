'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  createKelas,
  deleteKelas,
  getKelas,
  updateKelas,
  type CreateKelasInput,
} from '@/lib/queries/admin-extended'
import type { Kelas, Unit } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

const kelasSchema = z.object({
  nama_kelas: z.string().min(1, 'Nama kelas wajib diisi'),
  deskripsi: z.string().optional().nullable(),
  unit: z.enum(['SD', 'SMP', 'SMA']),
})

type KelasFormValues = z.infer<typeof kelasSchema>

function kelasToRecord(item: Kelas): Record<string, unknown> {
  return {
    id: item.id,
    nama_kelas: item.nama_kelas,
    deskripsi: item.deskripsi,
    unit: item.unit,
    created_at: item.created_at,
  }
}

export default function KelasPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Kelas | null>(null)
  const [deletingItem, setDeletingItem] = useState<Kelas | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const isFormOpen = isAddOpen || isEditOpen

  const form = useForm<KelasFormValues>({
    resolver: zodResolver(kelasSchema),
    defaultValues: { nama_kelas: '', deskripsi: '', unit: 'SD' },
  })

  const queryFilters = useMemo(
    () => ({ unit: activeUnit, search: debouncedSearch || undefined, page, pageSize }),
    [activeUnit, debouncedSearch, page, pageSize]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['kelas', queryFilters],
    queryFn: () => getKelas(queryFilters),
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kelas'] })
  }, [queryClient])

  const closeFormDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    form.reset({ nama_kelas: '', deskripsi: '', unit: activeUnit })
  }

  const openAddDialog = () => {
    setEditingItem(null)
    form.reset({ nama_kelas: '', deskripsi: '', unit: activeUnit })
    setIsAddOpen(true)
  }

  const openEditDialog = (item: Kelas) => {
    setEditingItem(item)
    form.reset({
      nama_kelas: item.nama_kelas,
      deskripsi: item.deskripsi || '',
      unit: item.unit,
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (item: Kelas) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateKelasInput) => createKelas(input),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'kelas', result.id, null, kelasToRecord(result))
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Kelas berhasil ditambahkan' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: KelasFormValues; oldItem: Kelas }) =>
      updateKelas(id, {
        nama_kelas: values.nama_kelas,
        deskripsi: values.deskripsi,
      }),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId, 'UPDATE', 'kelas', result.id,
          kelasToRecord(variables.oldItem), kelasToRecord(result)
        )
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Kelas berhasil diperbarui' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKelas(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(userId, 'DELETE', 'kelas', id, kelasToRecord(deletingItem), null)
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Kelas berhasil dihapus' })
      setIsDeleteOpen(false)
      setDeletingItem(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (values: KelasFormValues) => {
    if (isEditOpen && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values, oldItem: editingItem })
    } else {
      createMutation.mutate(values)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const columns = useMemo<ColumnDef<Kelas>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_kelas',
        header: 'Kelas',
        cell: ({ row }) => (
          <span className="font-medium text-[var(--text-primary)]">
            {row.original.nama_kelas}
          </span>
        ),
      },
      {
        accessorKey: 'deskripsi',
        header: 'Deskripsi',
        cell: ({ row }) => (
          <span className="text-sm text-[var(--text-secondary)]">
            {row.original.deskripsi || '-'}
          </span>
        ),
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
              aria-label="Edit kelas"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus kelas"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola Kelas"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Kelas
          </Button>
        }
      />

      <Tabs
        value={activeUnit}
        onValueChange={(value) => {
          setActiveUnit(value as Unit)
          setPage(1)
        }}
      >
        <TabsList>
          {UNITS.map((unit) => (
            <TabsTrigger key={unit} value={unit}>
              {unit}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <Input
          placeholder="Cari nama kelas..."
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
        data={data?.data ?? []}
        pagination={{ page, pageSize, total: data?.total ?? 0 }}
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
            <DialogTitle>
              {isEditOpen ? 'Edit Kelas' : 'Tambah Kelas'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama_kelas">Kelas</Label>
              <Input
                id="nama_kelas"
                {...form.register('nama_kelas')}
                placeholder="cth: Kelas 7A, Kelas 12 IPA 1"
              />
              {form.formState.errors.nama_kelas && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_kelas.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deskripsi">Deskripsi</Label>
              <Textarea
                id="deskripsi"
                {...form.register('deskripsi')}
                placeholder="Deskripsi singkat kelas (opsional)"
                rows={3}
              />
              {form.formState.errors.deskripsi && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.deskripsi.message}
                </p>
              )}
            </div>

            {/* Field unit disembunyikan sesuai spec */}
            <input type="hidden" {...form.register('unit')} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeFormDialog}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isEditOpen ? 'Simpan' : 'Tambah'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Kelas"
        description={`Apakah Anda yakin ingin menghapus "${deletingItem?.nama_kelas}"? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) deleteMutation.mutate(deletingItem.id)
        }}
      />
    </div>
  )
}
