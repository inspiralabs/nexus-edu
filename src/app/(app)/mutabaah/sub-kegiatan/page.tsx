'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Plus, Trash2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'
import {
  createSubKegiatan,
  createSubKegiatanBulk,
  deleteSubKegiatan,
  getKegiatan,
  getSubKegiatan,
  updateSubKegiatan,
  updateSubKegiatanBulk,
  type KegiatanItem,
  type SubKegiatanItem,
} from '@/lib/queries/mutabaah'
import { getAllSemesters, type Semester } from '@/lib/queries/semester'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const

// ─── Skema Validasi Zod ───────────────────────────────────────────────────────

const subKegiatanSchema = z.object({
  kegiatan_id: z.string().min(1, 'Kegiatan utama wajib dipilih'),
  nama_sub: z.string().min(1, 'Nama sub kegiatan wajib diisi'),
  poin_target: z
    .number({ message: 'Poin target harus berupa angka' })
    .min(1, 'Poin target minimal 1'),
  semester_id: z.string().min(1, 'Semester wajib dipilih'),
})

type SubKegiatanFormValues = z.infer<typeof subKegiatanSchema>

// ─── Halaman CRUD Sub Kegiatan Mutabaah ───────────────────────────────────────

export default function SubKegiatanMutabaahPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const searchParams = useSearchParams()

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
  const [isBulkInputOpen, setIsBulkInputOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)

  const [editingItem, setEditingItem] = useState<SubKegiatanItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<SubKegiatanItem | null>(null)

  // ── State Seleksi Baris untuk Bulk Edit ──
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  // ── State Combobox Pencarian Form ──
  const [formKegiatanSearch, setFormKegiatanSearch] = useState('')

  // ── Query Semua Semester ──
  const { data: semesterList = [] } = useQuery<Semester[]>({
    queryKey: ['all-semesters-for-subkegiatan-crud'],
    queryFn: getAllSemesters,
  })

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

  const selectedItems = useMemo(() => {
    return allData.filter((d) => selectedRows.includes(d.id))
  }, [allData, selectedRows])

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
      semester_id: '',
    },
  })

  // Auto-fill semester dari kegiatan utama yang dipilih
  const selectedParentId = form.watch('kegiatan_id')
  useEffect(() => {
    if (selectedParentId) {
      const parent = kegiatanList.find((k) => k.id === selectedParentId)
      if (parent?.semester_id) {
        form.setValue('semester_id', parent.semester_id, { shouldValidate: true })
      }
    }
  }, [selectedParentId, kegiatanList, form])

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mutabaah-sub-kegiatan'] })
    queryClient.invalidateQueries({ queryKey: ['mutabaah-kegiatan'] })
  }, [queryClient])

  const getNamaKegiatan = (id: string): string => {
    return kegiatanList.find((k) => k.id === id)?.nama_kegiatan ?? id
  }

  const getSemesterLabel = useCallback(
    (semesterId: string | null | undefined): string => {
      if (!semesterId) return '—'
      const s = semesterList.find((sem) => sem.id === semesterId)
      if (!s) return semesterId
      const tp = s.tahun_pelajaran as { nama: string } | undefined
      return `Semester ${s.nomor_semester} — ${tp?.nama ?? ''}`
    },
    [semesterList]
  )

  // ── Mutasi Create ──
  const createMutation = useMutation({
    mutationFn: (values: SubKegiatanFormValues) =>
      createSubKegiatan({
        kegiatan_id: values.kegiatan_id,
        nama_sub: values.nama_sub,
        poin_target: values.poin_target,
        semester_id: values.semester_id,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'sub_kegiatan', result.id, null, {
          kegiatan_id: result.kegiatan_id,
          nama_sub: result.nama_sub,
          poin_target: result.poin_target,
          semester_id: result.semester_id,
        })
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Sub kegiatan berhasil ditambahkan' })
      setIsFormOpen(false)
      form.reset({
        kegiatan_id: filterKegiatanId === 'all' ? '' : filterKegiatanId,
        nama_sub: '',
        poin_target: 1,
        semester_id: '',
      })
      setFormKegiatanSearch('')
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // ── Mutasi Create Bulk ──
  const createBulkMutation = useMutation({
    mutationFn: (values: { kegiatan_id: string; nama_sub: string; poin_target: number; semester_id: string }[]) =>
      createSubKegiatanBulk(values),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const res of results) {
          await logAudit(userId, 'CREATE', 'sub_kegiatan', res.id, null, {
            kegiatan_id: res.kegiatan_id,
            nama_sub: res.nama_sub,
            poin_target: res.poin_target,
            semester_id: res.semester_id,
          })
        }
      }
      invalidate()
      toast({ title: 'Berhasil', description: `${results.length} sub kegiatan berhasil ditambahkan` })
      setIsBulkInputOpen(false)
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
        semester_id: values.semester_id,
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
            semester_id: variables.oldItem.semester_id,
          },
          {
            kegiatan_id: result.kegiatan_id,
            nama_sub: result.nama_sub,
            poin_target: result.poin_target,
            semester_id: result.semester_id,
          }
        )
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Sub kegiatan berhasil diperbarui' })
      setIsFormOpen(false)
      setEditingItem(null)
      form.reset({
        kegiatan_id: filterKegiatanId === 'all' ? '' : filterKegiatanId,
        nama_sub: '',
        poin_target: 1,
        semester_id: '',
      })
      setFormKegiatanSearch('')
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // ── Mutasi Update Bulk ──
  const updateBulkMutation = useMutation({
    mutationFn: (updates: { id: string; kegiatan_id: string; nama_sub: string; poin_target: number; semester_id: string }[]) =>
      updateSubKegiatanBulk(updates),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const res of results) {
          const old = allData.find((d) => d.id === res.id)
          await logAudit(
            userId,
            'UPDATE',
            'sub_kegiatan',
            res.id,
            old
              ? {
                  kegiatan_id: old.kegiatan_id,
                  nama_sub: old.nama_sub,
                  poin_target: old.poin_target,
                  semester_id: old.semester_id,
                }
              : null,
            {
              kegiatan_id: res.kegiatan_id,
              nama_sub: res.nama_sub,
              poin_target: res.poin_target,
              semester_id: res.semester_id,
            }
          )
        }
      }
      invalidate()
      setSelectedRows([])
      toast({ title: 'Berhasil', description: `${results.length} sub kegiatan berhasil diperbarui` })
      setIsBulkEditOpen(false)
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
            semester_id: deletingItem.semester_id,
          },
          null
        )
      }
      invalidate()
      setSelectedRows((prev) => prev.filter((rowId) => rowId !== id))
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
      semester_id: '',
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
      semester_id: item.semester_id || '',
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
        id: 'semester',
        header: 'Semester',
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original.semester
          if (!s) return <span className="text-[var(--text-secondary)]">—</span>
          const tp = s.tahun_pelajaran
          return (
            <span className="text-[var(--text-secondary)]">
              Semester {s.nomor_semester} — {tp?.nama ?? ''}
            </span>
          )
        },
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
    [page, pageSize, kegiatanList, semesterList, getSemesterLabel]
  )

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sub Kegiatan Mutabaah"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkInputOpen(true)}
              id="btn-bulk-input-sub-kegiatan"
            >
              <Plus className="mr-2 h-4 w-4" />
              Bulk Input
            </Button>
            <Button
              type="button"
              onClick={openAddDialog}
              id="btn-tambah-sub-kegiatan"
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Sub Kegiatan
            </Button>
          </div>
        }
      />

      {/* Filter Kegiatan */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
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

        {selectedRows.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              {selectedRows.length} sub-kegiatan terpilih
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsBulkEditOpen(true)}
              className="text-primary hover:text-primary-dark"
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Bulk Edit Terpilih
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRows([])}
            >
              Batal
            </Button>
          </div>
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
        selectedRows={selectedRows}
        onSelectRows={setSelectedRows}
        isLoading={isLoading}
      />

      {/* Dialog Form Tambah/Edit */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) {
            setEditingItem(null)
            form.reset({
              kegiatan_id: filterKegiatanId === 'all' ? '' : filterKegiatanId,
              nama_sub: '',
              poin_target: 1,
              semester_id: '',
            })
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
                disabled={!!editingItem || filterKegiatanId !== 'all'}
              />
              {(!!editingItem || filterKegiatanId !== 'all') && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {editingItem 
                    ? 'Kegiatan utama tidak dapat diubah setelah sub kegiatan dibuat.'
                    : 'Kegiatan utama dikunci berdasarkan filter kegiatan yang aktif.'}
                </p>
              )}
              {form.formState.errors.kegiatan_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.kegiatan_id.message}
                </p>
              )}
            </div>

            {/* Semester */}
            <div className="space-y-2">
              <Label htmlFor="semester_id">
                Semester <span className="text-status-red">*</span>
              </Label>
              <Select
                value={form.watch('semester_id')}
                onValueChange={(val) => form.setValue('semester_id', val, { shouldValidate: true })}
              >
                <SelectTrigger id="semester_id">
                  <SelectValue placeholder="Pilih semester..." />
                </SelectTrigger>
                <SelectContent>
                  {semesterList.map((s) => {
                    const tp = s.tahun_pelajaran as { nama: string } | undefined
                    const label = `Semester ${s.nomor_semester} — ${tp?.nama ?? ''}`
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {form.formState.errors.semester_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.semester_id.message}
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
                  form.reset({ kegiatan_id: filterKegiatanId, nama_sub: '', poin_target: 1, semester_id: '' })
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

      {/* Dialog Bulk Input Sub Kegiatan */}
      <BulkInputSubKegiatanDialog
        isOpen={isBulkInputOpen}
        onClose={() => setIsBulkInputOpen(false)}
        kegiatanList={kegiatanList}
        semesterList={semesterList}
        filterKegiatanId={filterKegiatanId}
        onSave={(items) => createBulkMutation.mutate(items)}
        isPending={createBulkMutation.isPending}
      />

      {/* Dialog Bulk Edit Sub Kegiatan */}
      <BulkEditSubKegiatanDialog
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        selectedItems={selectedItems}
        kegiatanList={kegiatanList}
        semesterList={semesterList}
        onSave={(updates) => updateBulkMutation.mutate(updates)}
        isPending={updateBulkMutation.isPending}
      />
    </div>
  )
}

// ─── Komponen Dialog Bulk Input Sub Kegiatan ──────────────────────────────────

interface BulkInputSubKegiatanDialogProps {
  isOpen: boolean
  onClose: () => void
  kegiatanList: KegiatanItem[]
  semesterList: Semester[]
  filterKegiatanId: string
  onSave: (items: { kegiatan_id: string; nama_sub: string; poin_target: number; semester_id: string }[]) => void
  isPending: boolean
}

function BulkInputSubKegiatanDialog({
  isOpen,
  onClose,
  kegiatanList,
  semesterList,
  filterKegiatanId,
  onSave,
  isPending,
}: BulkInputSubKegiatanDialogProps) {
  const [rows, setRows] = useState<{ kegiatan_id: string; nama_sub: string; poin_target: number; semester_id: string }[]>([])

  useEffect(() => {
    if (isOpen) {
      const initialKegiatanId = filterKegiatanId === 'all' ? '' : filterKegiatanId
      const parent = kegiatanList.find((k) => k.id === initialKegiatanId)
      const initialSemesterId = parent?.semester_id || ''
      setRows([
        {
          kegiatan_id: initialKegiatanId,
          nama_sub: '',
          poin_target: 1,
          semester_id: initialSemesterId,
        },
      ])
    }
  }, [isOpen, filterKegiatanId, kegiatanList])

  const addRow = () => {
    const initialKegiatanId = filterKegiatanId === 'all' ? '' : filterKegiatanId
    const parent = kegiatanList.find((k) => k.id === initialKegiatanId)
    const initialSemesterId = parent?.semester_id || ''
    setRows((prev) => [
      ...prev,
      { kegiatan_id: initialKegiatanId, nama_sub: '', poin_target: 1, semester_id: initialSemesterId },
    ])
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const updateRow = (index: number, field: string, value: any) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const handleKegiatanChange = (index: number, val: string) => {
    const parent = kegiatanList.find((k) => k.id === val)
    const semesterId = parent?.semester_id || ''
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, kegiatan_id: val, semester_id: semesterId } : row
      )
    )
  }

  const handleSave = () => {
    const invalid = rows.some((r) => !r.kegiatan_id || !r.nama_sub.trim() || !r.semester_id || r.poin_target < 1)
    if (invalid) {
      toast({
        title: 'Validasi Gagal',
        description: 'Mohon isi semua field kegiatan utama, nama sub, semester, dan poin target minimal 1.',
        variant: 'destructive',
      })
      return
    }
    onSave(rows)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-4xl w-full max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[var(--border)]">
          <DialogTitle>Bulk Input Sub Kegiatan</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left bg-[var(--surface-2)]">
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-10 text-center">No</th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-52">Kegiatan Utama <span className="text-status-red">*</span></th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Nama Sub Kegiatan <span className="text-status-red">*</span></th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-40">Semester <span className="text-status-red">*</span></th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-24">Poin Target <span className="text-status-red">*</span></th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-12 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-[var(--border)]">
                  <td className="px-3 py-2 text-center font-mono text-xs text-[var(--text-secondary)]">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={row.kegiatan_id}
                      onValueChange={(val) => handleKegiatanChange(idx, val)}
                      disabled={filterKegiatanId !== 'all'}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Pilih kegiatan..." />
                      </SelectTrigger>
                      <SelectContent>
                        {kegiatanList.map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.nama_kegiatan}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      placeholder="Nama sub kegiatan..."
                      value={row.nama_sub}
                      onChange={(e) => updateRow(idx, 'nama_sub', e.target.value)}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={row.semester_id}
                      onValueChange={(val) => updateRow(idx, 'semester_id', val)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Pilih semester..." />
                      </SelectTrigger>
                      <SelectContent>
                        {semesterList.map((s) => {
                          const tp = s.tahun_pelajaran as { nama: string } | undefined
                          return (
                            <SelectItem key={s.id} value={s.id}>
                              Semester {s.nomor_semester} — {tp?.nama ?? ''}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      value={row.poin_target}
                      onChange={(e) => updateRow(idx, 'poin_target', Number(e.target.value))}
                      className="h-8 font-mono text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-status-red hover:bg-status-red/10"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="w-full mt-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Baris
          </Button>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-2)]">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button type="button" onClick={handleSave} isLoading={isPending}>
            Simpan Massal ({rows.length} Baris)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Komponen Dialog Bulk Edit Sub Kegiatan ────────────────────────────────────

interface BulkEditSubKegiatanDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedItems: SubKegiatanItem[]
  kegiatanList: KegiatanItem[]
  semesterList: Semester[]
  onSave: (updates: { id: string; kegiatan_id: string; nama_sub: string; poin_target: number; semester_id: string }[]) => void
  isPending: boolean
}

function BulkEditSubKegiatanDialog({
  isOpen,
  onClose,
  selectedItems,
  kegiatanList,
  semesterList,
  onSave,
  isPending,
}: BulkEditSubKegiatanDialogProps) {
  const [activeTab, setActiveTab] = useState<'serentak' | 'detail'>('serentak')

  // State untuk Ubah Serentak
  const [bulkKegiatanId, setBulkKegiatanId] = useState<string>('all')
  const [bulkSemesterId, setBulkSemesterId] = useState<string>('all')
  const [bulkPoinTarget, setBulkPoinTarget] = useState<string>('')

  // State untuk Edit Detail Baris
  const [rows, setRows] = useState<{ id: string; kegiatan_id: string; nama_sub: string; poin_target: number; semester_id: string }[]>([])

  useEffect(() => {
    if (isOpen) {
      setActiveTab('serentak')
      setBulkKegiatanId('all')
      setBulkSemesterId('all')
      setBulkPoinTarget('')
      
      setRows(
        selectedItems.map((item) => ({
          id: item.id,
          kegiatan_id: item.kegiatan_id,
          nama_sub: item.nama_sub,
          poin_target: item.poin_target,
          semester_id: item.semester_id || '',
        }))
      )
    }
  }, [isOpen, selectedItems])

  const handleBulkKegiatanChange = (val: string) => {
    setBulkKegiatanId(val)
    if (val !== 'all') {
      const parent = kegiatanList.find((k) => k.id === val)
      if (parent?.semester_id) {
        setBulkSemesterId(parent.semester_id)
      }
    }
  }

  const updateRow = (index: number, field: string, value: any) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const handleRowKegiatanChange = (index: number, val: string) => {
    const parent = kegiatanList.find((k) => k.id === val)
    const semesterId = parent?.semester_id || ''
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, kegiatan_id: val, semester_id: semesterId } : row
      )
    )
  }

  const handleSave = () => {
    if (activeTab === 'serentak') {
      if (bulkKegiatanId === 'all' && bulkSemesterId === 'all' && !bulkPoinTarget.trim()) {
        toast({
          title: 'Tidak Ada Perubahan',
          description: 'Pilih Kegiatan Utama, Semester baru, atau ketik Poin Target baru untuk diubah.',
          variant: 'destructive',
        })
        return
      }

      const updates = selectedItems.map((item) => {
        const finalKegiatanId = bulkKegiatanId !== 'all' ? bulkKegiatanId : item.kegiatan_id
        const finalSemesterId = bulkSemesterId !== 'all' ? bulkSemesterId : (item.semester_id || '')
        const finalPoin = bulkPoinTarget.trim() ? Number(bulkPoinTarget) : item.poin_target

        return {
          id: item.id,
          kegiatan_id: finalKegiatanId,
          nama_sub: item.nama_sub,
          poin_target: finalPoin,
          semester_id: finalSemesterId,
        }
      })
      onSave(updates)
    } else {
      const invalid = rows.some((r) => !r.kegiatan_id || !r.nama_sub.trim() || !r.semester_id || r.poin_target < 1)
      if (invalid) {
        toast({
          title: 'Validasi Gagal',
          description: 'Mohon isi semua field kegiatan utama, nama sub, semester, dan poin target minimal 1.',
          variant: 'destructive',
        })
        return
      }
      onSave(rows)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-4xl w-full max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[var(--border)]">
          <DialogTitle>Bulk Edit Sub Kegiatan ({selectedItems.length} Terpilih)</DialogTitle>
        </DialogHeader>

        {/* Tab Selector */}
        <div className="flex border-b border-[var(--border)] bg-[var(--surface-2)]">
          <button
            type="button"
            className={cn(
              "flex-1 py-3 text-center text-xs font-semibold border-r border-[var(--border)] transition-colors",
              activeTab === 'serentak' 
                ? "bg-[var(--surface)] text-primary border-b-2 border-b-primary" 
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]/80"
            )}
            onClick={() => setActiveTab('serentak')}
          >
            Ubah Serentak
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 py-3 text-center text-xs font-semibold transition-colors",
              activeTab === 'detail' 
                ? "bg-[var(--surface)] text-primary border-b-2 border-b-primary" 
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]/80"
            )}
            onClick={() => setActiveTab('detail')}
          >
            Edit Detail Baris
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'serentak' ? (
            <div className="space-y-4 max-w-md mx-auto py-4">
              <p className="text-xs text-[var(--text-secondary)] bg-primary/10 p-3 rounded-lg leading-relaxed">
                Pilih field di bawah ini untuk diperbarui secara massal pada <strong>{selectedItems.length} sub kegiatan</strong> yang Anda pilih. Field yang dibiarkan kosong tidak akan diubah.
              </p>

              {/* Kegiatan Utama */}
              <div className="space-y-2">
                <Label htmlFor="bulk-kegiatan">Pindah ke Kegiatan Utama</Label>
                <Select value={bulkKegiatanId} onValueChange={handleBulkKegiatanChange}>
                  <SelectTrigger id="bulk-kegiatan">
                    <SelectValue placeholder="Pilih kegiatan utama..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Jangan Ubah Kegiatan Utama</SelectItem>
                    {kegiatanList.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.nama_kegiatan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Semester */}
              <div className="space-y-2">
                <Label htmlFor="bulk-semester">Ubah Semester Menjadi</Label>
                <Select value={bulkSemesterId} onValueChange={setBulkSemesterId}>
                  <SelectTrigger id="bulk-semester">
                    <SelectValue placeholder="Pilih semester..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Jangan Ubah Semester</SelectItem>
                    {semesterList.map((s) => {
                      const tp = s.tahun_pelajaran as { nama: string } | undefined
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          Semester {s.nomor_semester} — {tp?.nama ?? ''}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Poin Target */}
              <div className="space-y-2">
                <Label htmlFor="bulk-poin">Ubah Poin Target Menjadi</Label>
                <Input
                  id="bulk-poin"
                  type="number"
                  min={1}
                  placeholder="Contoh: 10 (Kosongkan jika tidak ingin diubah)"
                  value={bulkPoinTarget}
                  onChange={(e) => setBulkPoinTarget(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left bg-[var(--surface-2)]">
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-10 text-center">No</th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-48">Kegiatan Utama <span className="text-status-red">*</span></th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Nama Sub Kegiatan <span className="text-status-red">*</span></th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-44">Semester <span className="text-status-red">*</span></th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-24">Poin Target <span className="text-status-red">*</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2 text-center font-mono text-xs text-[var(--text-secondary)]">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <Select
                        value={row.kegiatan_id}
                        onValueChange={(val) => handleRowKegiatanChange(idx, val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Pilih kegiatan..." />
                        </SelectTrigger>
                        <SelectContent>
                          {kegiatanList.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.nama_kegiatan}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.nama_sub}
                        onChange={(e) => updateRow(idx, 'nama_sub', e.target.value)}
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={row.semester_id}
                        onValueChange={(val) => updateRow(idx, 'semester_id', val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Pilih semester..." />
                        </SelectTrigger>
                        <SelectContent>
                          {semesterList.map((s) => {
                            const tp = s.tahun_pelajaran as { nama: string } | undefined
                            return (
                              <SelectItem key={s.id} value={s.id}>
                                Semester {s.nomor_semester} — {tp?.nama ?? ''}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={1}
                        value={row.poin_target}
                        onChange={(e) => updateRow(idx, 'poin_target', Number(e.target.value))}
                        className="h-8 font-mono text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-2)]">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button type="button" onClick={handleSave} isLoading={isPending}>
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
