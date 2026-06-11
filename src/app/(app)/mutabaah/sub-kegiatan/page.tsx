'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Plus, Trash2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { Combobox } from '@/components/shared/combobox'
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
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit/log'
import {
  createSubKegiatan,
  deleteSubKegiatan,
  getKegiatan,
  getSubKegiatan,
  updateSubKegiatan,
  type KegiatanItem,
  type SubKegiatanItem,
} from '@/lib/queries/mutabaah'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const

// ─── Skema Validasi Zod ───────────────────────────────────────────────────────

const subKegiatanSchema = z.object({
  kegiatan_id: z.string().min(1, 'Kegiatan utama wajib dipilih'),
  nama_sub: z.string().min(1, 'Nama sub kegiatan wajib diisi'),
  poin_target: z
    .number({ message: 'Poin target harus berupa angka' })
    .min(1, 'Poin target minimal 1'),
})

type SubKegiatanFormValues = z.infer<typeof subKegiatanSchema>

// ─── Halaman CRUD Sub Kegiatan Mutabaah ───────────────────────────────────────

export default function SubKegiatanMutabaahPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const searchParams = useSearchParams()

  // Filter awal dari query param (dari link di halaman kegiatan)
  const defaultKegiatanId = searchParams.get('kegiatan_id') ?? ''

  // ── State Filter Kegiatan ──
  const [filterKegiatanId, setFilterKegiatanId] = useState<string>(defaultKegiatanId || 'all')

  // ── State Pagination & Sorting ──
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState('urutan')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // ── State Dialog ──
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SubKegiatanItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<SubKegiatanItem | null>(null)

  // ── State Combobox Pencarian Form ──
  const [formKegiatanSearch, setFormKegiatanSearch] = useState('')

  // ── Query Kegiatan (untuk Select dropdown) ──
  const { data: kegiatanList = [] } = useQuery<KegiatanItem[]>({
    queryKey: ['mutabaah-kegiatan'],
    queryFn: () => getKegiatan(),
  })

  const filteredFormKegiatanOptions = useMemo(() => {
    const query = formKegiatanSearch.toLowerCase().trim()
    return kegiatanList
      .filter((k) => k.nama_kegiatan.toLowerCase().includes(query))
      .map((k) => ({
        value: k.id,
        label: k.nama_kegiatan,
      }))
  }, [kegiatanList, formKegiatanSearch])

  // ── Query Sub Kegiatan (difilter per kegiatan jika ada filter) ──
  const { data: allData = [], isLoading } = useQuery<SubKegiatanItem[]>({
    queryKey: ['mutabaah-sub-kegiatan', filterKegiatanId],
    queryFn: () => getSubKegiatan(filterKegiatanId || undefined),
  })

  // ── Sorting Client-side ──
  const sortedData = useMemo(() => {
    return [...allData].sort((a, b) => {
      const aVal = a[sortField as keyof SubKegiatanItem] ?? ''
      const bVal = b[sortField as keyof SubKegiatanItem] ?? ''
      const cmp = String(aVal).localeCompare(String(bVal), 'id')
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [allData, sortField, sortDirection])

  // ── Pagination Client-side ──
  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return sortedData.slice(from, from + pageSize)
  }, [sortedData, page, pageSize])

  // ── Form ──
  const form = useForm<SubKegiatanFormValues>({
    resolver: zodResolver(subKegiatanSchema),
    defaultValues: {
      kegiatan_id: defaultKegiatanId,
      nama_sub: '',
      poin_target: 1,
    },
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mutabaah-sub-kegiatan'] })
  }, [queryClient])

  // Helper: nama kegiatan berdasarkan ID
  const getNamaKegiatan = (id: string): string => {
    return kegiatanList.find((k) => k.id === id)?.nama_kegiatan ?? id
  }

  // ── Mutasi Create ──
  const createMutation = useMutation({
    mutationFn: (values: SubKegiatanFormValues) =>
      createSubKegiatan({
        kegiatan_id: values.kegiatan_id,
        nama_sub: values.nama_sub,
        poin_target: values.poin_target,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'sub_kegiatan', result.id, null, {
          kegiatan_id: result.kegiatan_id,
          nama_sub: result.nama_sub,
          poin_target: result.poin_target,
        })
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Sub kegiatan berhasil ditambahkan' })
      setIsFormOpen(false)
      form.reset({ kegiatan_id: filterKegiatanId === 'all' ? '' : filterKegiatanId, nama_sub: '', poin_target: 1 })
      setFormKegiatanSearch('')
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // ── Mutasi Update ──
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string
      values: SubKegiatanFormValues
      oldItem: SubKegiatanItem
    }) =>
      updateSubKegiatan(id, {
        kegiatan_id: values.kegiatan_id,
        nama_sub: values.nama_sub,
        poin_target: values.poin_target,
      }),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'sub_kegiatan',
          result.id,
          {
            kegiatan_id: variables.oldItem.kegiatan_id,
            nama_sub: variables.oldItem.nama_sub,
            poin_target: variables.oldItem.poin_target,
          },
          {
            kegiatan_id: result.kegiatan_id,
            nama_sub: result.nama_sub,
            poin_target: result.poin_target,
          }
        )
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Sub kegiatan berhasil diperbarui' })
      setIsFormOpen(false)
      setEditingItem(null)
      form.reset({ kegiatan_id: filterKegiatanId === 'all' ? '' : filterKegiatanId, nama_sub: '', poin_target: 1 })
      setFormKegiatanSearch('')
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // ── Mutasi Delete ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSubKegiatan(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(
          userId,
          'DELETE',
          'sub_kegiatan',
          id,
          {
            kegiatan_id: deletingItem.kegiatan_id,
            nama_sub: deletingItem.nama_sub,
            poin_target: deletingItem.poin_target,
          },
          null
        )
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Sub kegiatan berhasil dihapus' })
      setIsDeleteOpen(false)
      setDeletingItem(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // ── Handler Dialog ──
  const openAddDialog = () => {
    setEditingItem(null)
    form.reset({
      kegiatan_id: filterKegiatanId === 'all' ? '' : filterKegiatanId,
      nama_sub: '',
      poin_target: 1,
    })
    setFormKegiatanSearch('')
    setIsFormOpen(true)
  }

  const openEditDialog = (item: SubKegiatanItem) => {
    setEditingItem(item)
    form.reset({
      kegiatan_id: item.kegiatan_id,
      nama_sub: item.nama_sub,
      poin_target: item.poin_target,
    })
    setFormKegiatanSearch('')
    setIsFormOpen(true)
  }

  const openDeleteDialog = (item: SubKegiatanItem) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const onSubmit = (values: SubKegiatanFormValues) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, values, oldItem: editingItem })
    } else {
      createMutation.mutate(values)
    }
  }

  // ── Kolom DataTable ──
  const columns = useMemo<ColumnDef<SubKegiatanItem>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_sub',
        header: 'Nama Sub Kegiatan',
      },
      {
        id: 'kegiatan_utama',
        header: 'Kegiatan Utama',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">
            {getNamaKegiatan(row.original.kegiatan_id)}
          </span>
        ),
      },
      {
        accessorKey: 'poin_target',
        header: 'Poin Target',
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.poin_target}</span>
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
              aria-label="Edit sub kegiatan"
              title="Edit sub kegiatan"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus sub kegiatan"
              title="Hapus sub kegiatan"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize, kegiatanList]
  )

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sub Kegiatan Mutabaah"
        actions={
          <Button
            type="button"
            onClick={openAddDialog}
            id="btn-tambah-sub-kegiatan"
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Sub Kegiatan
          </Button>
        }
      />

      {/* Filter Kegiatan */}
      <div className="flex items-center gap-3">
        <Label htmlFor="filter-kegiatan" className="shrink-0 text-sm">
          Filter Kegiatan:
        </Label>
        <Select
          value={filterKegiatanId}
          onValueChange={(val) => {
            setFilterKegiatanId(val)
            setPage(1)
          }}
        >
          <SelectTrigger id="filter-kegiatan" className="w-[240px]">
            <SelectValue placeholder="Pilih kegiatan..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kegiatan</SelectItem>
            {kegiatanList.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.nama_kegiatan}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterKegiatanId && filterKegiatanId !== 'all' && (
          <span className="text-xs text-[var(--text-secondary)]">
            Menampilkan sub kegiatan untuk:{' '}
            <strong>{getNamaKegiatan(filterKegiatanId)}</strong>
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={paginatedData}
        pagination={{
          page,
          pageSize,
          total: sortedData.length,
        }}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onSortChange={(field, direction) => {
          setSortField(field)
          setSortDirection(direction)
          setPage(1)
        }}
        isLoading={isLoading}
      />

      {/* Dialog Form Tambah/Edit */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) {
            setEditingItem(null)
            form.reset({ kegiatan_id: filterKegiatanId === 'all' ? '' : filterKegiatanId, nama_sub: '', poin_target: 1 })
            setFormKegiatanSearch('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Sub Kegiatan' : 'Tambah Sub Kegiatan'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Kegiatan Utama */}
            <div className="space-y-2">
              <Label htmlFor="form-kegiatan-id">
                Kegiatan Utama <span className="text-status-red">*</span>
              </Label>
              <Combobox
                options={filteredFormKegiatanOptions}
                value={form.watch('kegiatan_id')}
                onSelect={(val) => form.setValue('kegiatan_id', val, { shouldValidate: true })}
                onSearch={setFormKegiatanSearch}
                placeholder="Pilih kegiatan utama..."
                emptyMessage="Tidak ada kegiatan"
              />
              {form.formState.errors.kegiatan_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.kegiatan_id.message}
                </p>
              )}
            </div>

            {/* Nama Sub Kegiatan */}
            <div className="space-y-2">
              <Label htmlFor="nama_sub">
                Nama Sub Kegiatan <span className="text-status-red">*</span>
              </Label>
              <Input
                id="nama_sub"
                placeholder="Contoh: Rakaat 1, Sesi Pagi"
                {...form.register('nama_sub')}
              />
              {form.formState.errors.nama_sub && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_sub.message}
                </p>
              )}
            </div>

            {/* Poin Target */}
            <div className="space-y-2">
              <Label htmlFor="poin_target_sub">Poin Target</Label>
              <Input
                id="poin_target_sub"
                type="number"
                min={1}
                placeholder="1"
                {...form.register('poin_target', { valueAsNumber: true })}
              />
              {form.formState.errors.poin_target && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.poin_target.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFormOpen(false)
                  setEditingItem(null)
                  form.reset({ kegiatan_id: filterKegiatanId, nama_sub: '', poin_target: 1 })
                }}
              >
                Batal
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {editingItem ? 'Simpan Perubahan' : 'Tambah Sub Kegiatan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Sub Kegiatan"
        description={`Apakah Anda yakin ingin menghapus sub kegiatan "${deletingItem?.nama_sub}"? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) {
            deleteMutation.mutate(deletingItem.id)
          }
        }}
      />
    </div>
  )
}
