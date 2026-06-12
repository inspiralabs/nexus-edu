'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, ExternalLink, Plus, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
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
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import { logAudit } from '@/lib/audit/log'
import {
  createKegiatan,
  createKegiatanBulk,
  deleteKegiatan,
  getKegiatan,
  updateKegiatan,
  updateKegiatanBulk,
  type KegiatanItem,
} from '@/lib/queries/mutabaah'
import { getAllSemesters, type Semester } from '@/lib/queries/semester'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const

// ─── Skema Validasi Zod ───────────────────────────────────────────────────────

const kegiatanSchema = z.object({
  nama_kegiatan: z.string().min(1, 'Nama kegiatan wajib diisi'),
  poin_target: z
    .number({ message: 'Poin target harus berupa angka' })
    .min(1, 'Poin target minimal 1'),
  semester_id: z.string().min(1, 'Semester wajib dipilih'),
})

type KegiatanFormValues = z.infer<typeof kegiatanSchema>

// ─── Halaman CRUD Kegiatan Mutabaah ──────────────────────────────────────────

export default function KegiatanMutabaahPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  // ── State Pagination & Sorting ──
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState('urutan')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  // ── State Dialog ──
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkInputOpen, setIsBulkInputOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)

  const [editingItem, setEditingItem] = useState<KegiatanItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<KegiatanItem | null>(null)

  // ── State Seleksi Baris untuk Bulk Edit ──
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  // ── Query Semua Semester ──
  const { data: semesterList = [] } = useQuery<Semester[]>({
    queryKey: ['all-semesters-for-kegiatan-crud'],
    queryFn: getAllSemesters,
  })

  // ── Query Data ──
  const { data: allData = [], isLoading } = useQuery({
    queryKey: ['mutabaah-kegiatan', debouncedSearch],
    queryFn: () => getKegiatan(debouncedSearch || undefined),
  })

  const selectedItems = useMemo(() => {
    return allData.filter((d) => selectedRows.includes(d.id))
  }, [allData, selectedRows])

  // ── Sorting Client-side ──
  const sortedData = useMemo(() => {
    return [...allData].sort((a, b) => {
      const aVal = a[sortField as keyof KegiatanItem] ?? ''
      const bVal = b[sortField as keyof KegiatanItem] ?? ''
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
  const form = useForm<KegiatanFormValues>({
    resolver: zodResolver(kegiatanSchema),
    defaultValues: {
      nama_kegiatan: '',
      poin_target: 1,
      semester_id: '',
    },
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mutabaah-kegiatan'] })
  }, [queryClient])

  // ── Mutasi Create ──
  const createMutation = useMutation({
    mutationFn: (values: KegiatanFormValues) =>
      createKegiatan({
        nama_kegiatan: values.nama_kegiatan,
        poin_target: values.poin_target,
        semester_id: values.semester_id,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'kegiatan', result.id, null, {
          nama_kegiatan: result.nama_kegiatan,
          poin_target: result.poin_target,
          semester_id: result.semester_id,
        })
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Kegiatan berhasil ditambahkan' })
      setIsFormOpen(false)
      form.reset()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // ── Mutasi Create Bulk ──
  const createBulkMutation = useMutation({
    mutationFn: (values: { nama_kegiatan: string; poin_target: number; semester_id: string }[]) =>
      createKegiatanBulk(values),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const res of results) {
          await logAudit(userId, 'CREATE', 'kegiatan', res.id, null, {
            nama_kegiatan: res.nama_kegiatan,
            poin_target: res.poin_target,
            semester_id: res.semester_id,
          })
        }
      }
      invalidate()
      toast({ title: 'Berhasil', description: `${results.length} kegiatan berhasil ditambahkan` })
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
      values: KegiatanFormValues
      oldItem: KegiatanItem
    }) =>
      updateKegiatan(id, {
        nama_kegiatan: values.nama_kegiatan,
        poin_target: values.poin_target,
        semester_id: values.semester_id,
      }),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'kegiatan',
          result.id,
          {
            nama_kegiatan: variables.oldItem.nama_kegiatan,
            poin_target: variables.oldItem.poin_target,
            semester_id: variables.oldItem.semester_id,
          },
          {
            nama_kegiatan: result.nama_kegiatan,
            poin_target: result.poin_target,
            semester_id: result.semester_id,
          }
        )
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Kegiatan berhasil diperbarui' })
      setIsFormOpen(false)
      setEditingItem(null)
      form.reset()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // ── Mutasi Update Bulk ──
  const updateBulkMutation = useMutation({
    mutationFn: (updates: { id: string; nama_kegiatan: string; poin_target: number; semester_id: string }[]) =>
      updateKegiatanBulk(updates),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const res of results) {
          const old = allData.find((d) => d.id === res.id)
          await logAudit(
            userId,
            'UPDATE',
            'kegiatan',
            res.id,
            old
              ? {
                  nama_kegiatan: old.nama_kegiatan,
                  poin_target: old.poin_target,
                  semester_id: old.semester_id,
                }
              : null,
            {
              nama_kegiatan: res.nama_kegiatan,
              poin_target: res.poin_target,
              semester_id: res.semester_id,
            }
          )
        }
      }
      invalidate()
      setSelectedRows([])
      toast({ title: 'Berhasil', description: `${results.length} kegiatan berhasil diperbarui` })
      setIsBulkEditOpen(false)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // ── Mutasi Delete ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKegiatan(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(
          userId,
          'DELETE',
          'kegiatan',
          id,
          {
            nama_kegiatan: deletingItem.nama_kegiatan,
            poin_target: deletingItem.poin_target,
            semester_id: deletingItem.semester_id,
          },
          null
        )
      }
      invalidate()
      setSelectedRows((prev) => prev.filter((rowId) => rowId !== id))
      toast({ title: 'Berhasil', description: 'Kegiatan berhasil dihapus' })
      setIsDeleteOpen(false)
      setDeletingItem(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  // ── Helpers ──
  const hasSub = useMemo(() => {
    return editingItem ? !!(editingItem.sub_kegiatan && editingItem.sub_kegiatan.length > 0) : false
  }, [editingItem])

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

  // ── Handler Dialog ──
  const openAddDialog = () => {
    setEditingItem(null)
    form.reset({ nama_kegiatan: '', poin_target: 1, semester_id: '' })
    setIsFormOpen(true)
  }

  const openEditDialog = (item: KegiatanItem) => {
    setEditingItem(item)
    const calculatedPoin =
      item.sub_kegiatan && item.sub_kegiatan.length > 0
        ? item.sub_kegiatan.reduce((sum, sub) => sum + sub.poin_target, 0)
        : item.poin_target
    form.reset({
      nama_kegiatan: item.nama_kegiatan,
      poin_target: calculatedPoin,
      semester_id: item.semester_id || '',
    })
    setIsFormOpen(true)
  }

  const openDeleteDialog = (item: KegiatanItem) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const onSubmit = (values: KegiatanFormValues) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, values, oldItem: editingItem })
    } else {
      createMutation.mutate(values)
    }
  }

  // ── Kolom DataTable ──
  const columns = useMemo<ColumnDef<KegiatanItem>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_kegiatan',
        header: 'Nama Kegiatan',
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
              aria-label="Edit kegiatan"
              title="Edit kegiatan"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus kegiatan"
              title="Hapus kegiatan"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              asChild
              title="Kelola Sub Kegiatan"
            >
              <Link
                href={`/mutabaah/sub-kegiatan?kegiatan_id=${row.original.id}`}
                className="flex items-center gap-1 text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                Sub Kegiatan
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize, semesterList, getSemesterLabel]
  )

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kegiatan Mutabaah"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkInputOpen(true)}
              id="btn-bulk-input-kegiatan"
            >
              <Plus className="mr-2 h-4 w-4" />
              Bulk Input
            </Button>
            <Button type="button" onClick={openAddDialog} id="btn-tambah-kegiatan">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Kegiatan
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Cari kegiatan..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        {selectedRows.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              {selectedRows.length} kegiatan terpilih
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
            form.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Kegiatan' : 'Tambah Kegiatan'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nama Kegiatan */}
            <div className="space-y-2">
              <Label htmlFor="nama_kegiatan">
                Nama Kegiatan <span className="text-status-red">*</span>
              </Label>
              <Input
                id="nama_kegiatan"
                placeholder="Contoh: Sholat Subuh, Tilawah Al-Qur'an"
                {...form.register('nama_kegiatan')}
              />
              {form.formState.errors.nama_kegiatan && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_kegiatan.message}
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
              <Label htmlFor="poin_target">Poin Target</Label>
              <Input
                id="poin_target"
                type="number"
                min={1}
                placeholder="1"
                className={cn(hasSub && "bg-muted cursor-not-allowed")}
                readOnly={hasSub}
                {...form.register('poin_target', { valueAsNumber: true })}
              />
              {hasSub && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Nilai dikunci karena kegiatan ini memiliki sub-kegiatan. Nilai otomatis dihitung dari total poin sub-kegiatan.
                </p>
              )}
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
                  form.reset()
                }}
              >
                Batal
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {editingItem ? 'Simpan Perubahan' : 'Tambah Kegiatan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Kegiatan"
        description={`Apakah Anda yakin ingin menghapus kegiatan "${deletingItem?.nama_kegiatan}"? Semua data mutabaah terkait kegiatan ini akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) {
            deleteMutation.mutate(deletingItem.id)
          }
        }}
      />

      {/* Dialog Bulk Input Kegiatan */}
      <BulkInputKegiatanDialog
        isOpen={isBulkInputOpen}
        onClose={() => setIsBulkInputOpen(false)}
        semesterList={semesterList}
        onSave={(items) => createBulkMutation.mutate(items)}
        isPending={createBulkMutation.isPending}
      />

      {/* Dialog Bulk Edit Kegiatan */}
      <BulkEditKegiatanDialog
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        selectedItems={selectedItems}
        semesterList={semesterList}
        onSave={(updates) => updateBulkMutation.mutate(updates)}
        isPending={updateBulkMutation.isPending}
      />
    </div>
  )
}

// ─── Komponen Dialog Bulk Input Kegiatan ──────────────────────────────────────

interface BulkInputKegiatanDialogProps {
  isOpen: boolean
  onClose: () => void
  semesterList: Semester[]
  onSave: (items: { nama_kegiatan: string; poin_target: number; semester_id: string }[]) => void
  isPending: boolean
}

function BulkInputKegiatanDialog({
  isOpen,
  onClose,
  semesterList,
  onSave,
  isPending,
}: BulkInputKegiatanDialogProps) {
  const [rows, setRows] = useState<{ nama_kegiatan: string; poin_target: number; semester_id: string }[]>([
    { nama_kegiatan: '', poin_target: 1, semester_id: '' },
  ])

  useEffect(() => {
    if (isOpen) {
      setRows([{ nama_kegiatan: '', poin_target: 1, semester_id: '' }])
    }
  }, [isOpen])

  const addRow = () => {
    setRows((prev) => [...prev, { nama_kegiatan: '', poin_target: 1, semester_id: '' }])
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const updateRow = (index: number, field: string, value: any) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const handleSave = () => {
    const invalid = rows.some((r) => !r.nama_kegiatan.trim() || !r.semester_id || r.poin_target < 1)
    if (invalid) {
      toast({
        title: 'Validasi Gagal',
        description: 'Mohon isi semua field nama kegiatan, semester, dan poin target minimal 1.',
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
          <DialogTitle>Bulk Input Kegiatan</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left bg-[var(--surface-2)]">
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-10 text-center">No</th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Nama Kegiatan <span className="text-status-red">*</span></th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-60">Semester <span className="text-status-red">*</span></th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-28">Poin Target <span className="text-status-red">*</span></th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-12 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-[var(--border)]">
                  <td className="px-3 py-2 text-center font-mono text-xs text-[var(--text-secondary)]">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <Input
                      placeholder="Nama kegiatan..."
                      value={row.nama_kegiatan}
                      onChange={(e) => updateRow(idx, 'nama_kegiatan', e.target.value)}
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
                      className="h-7 w-7 text-status-red hover:bg-status-red/10 animate-fade-in"
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

// ─── Komponen Dialog Bulk Edit Kegiatan ────────────────────────────────────────

interface BulkEditKegiatanDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedItems: KegiatanItem[]
  semesterList: Semester[]
  onSave: (updates: { id: string; nama_kegiatan: string; poin_target: number; semester_id: string }[]) => void
  isPending: boolean
}

function BulkEditKegiatanDialog({
  isOpen,
  onClose,
  selectedItems,
  semesterList,
  onSave,
  isPending,
}: BulkEditKegiatanDialogProps) {
  const [activeTab, setActiveTab] = useState<'serentak' | 'detail'>('serentak')

  // State untuk Ubah Serentak
  const [bulkSemesterId, setBulkSemesterId] = useState<string>('all')
  const [bulkPoinTarget, setBulkPoinTarget] = useState<string>('')

  // State untuk Edit Detail Baris
  const [rows, setRows] = useState<{ id: string; nama_kegiatan: string; poin_target: number; semester_id: string; hasSub: boolean }[]>([])

  useEffect(() => {
    if (isOpen) {
      setActiveTab('serentak')
      setBulkSemesterId('all')
      setBulkPoinTarget('')
      
      setRows(
        selectedItems.map((item) => {
          const hasSub = item.sub_kegiatan && item.sub_kegiatan.length > 0
          const calculatedPoin = hasSub
            ? item.sub_kegiatan!.reduce((sum, sub) => sum + sub.poin_target, 0)
            : item.poin_target
          return {
            id: item.id,
            nama_kegiatan: item.nama_kegiatan,
            poin_target: calculatedPoin,
            semester_id: item.semester_id || '',
            hasSub: !!hasSub,
          }
        })
      )
    }
  }, [isOpen, selectedItems])

  const updateRow = (index: number, field: string, value: any) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  const handleSave = () => {
    if (activeTab === 'serentak') {
      if (bulkSemesterId === 'all' && !bulkPoinTarget.trim()) {
        toast({
          title: 'Tidak Ada Perubahan',
          description: 'Pilih Semester baru atau ketik Poin Target baru untuk diubah.',
          variant: 'destructive',
        })
        return
      }

      const updates = selectedItems.map((item) => {
        const hasSub = item.sub_kegiatan && item.sub_kegiatan.length > 0
        const calculatedPoin = hasSub
          ? item.sub_kegiatan!.reduce((sum, sub) => sum + sub.poin_target, 0)
          : item.poin_target

        const finalSemesterId = bulkSemesterId !== 'all' ? bulkSemesterId : (item.semester_id || '')
        const finalPoin = (bulkPoinTarget.trim() && !hasSub) ? Number(bulkPoinTarget) : calculatedPoin

        return {
          id: item.id,
          nama_kegiatan: item.nama_kegiatan,
          poin_target: finalPoin,
          semester_id: finalSemesterId,
        }
      })
      onSave(updates)
    } else {
      const invalid = rows.some((r) => !r.nama_kegiatan.trim() || !r.semester_id || r.poin_target < 1)
      if (invalid) {
        toast({
          title: 'Validasi Gagal',
          description: 'Mohon isi semua field nama kegiatan, semester, dan poin target minimal 1.',
          variant: 'destructive',
        })
        return
      }
      onSave(rows.map(({ id, nama_kegiatan, poin_target, semester_id }) => ({ id, nama_kegiatan, poin_target, semester_id })))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-4xl w-full max-h-[85vh] flex flex-col p-0 overflow-hidden animate-fade-in">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[var(--border)]">
          <DialogTitle>Bulk Edit Kegiatan ({selectedItems.length} Terpilih)</DialogTitle>
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
                Pilih field di bawah ini untuk diperbarui secara massal pada <strong>{selectedItems.length} kegiatan</strong> yang Anda pilih. Field yang dibiarkan kosong tidak akan diubah.
              </p>
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
                <p className="text-[10px] text-[var(--text-secondary)] leading-tight">
                  Catatan: Kegiatan yang memiliki sub-kegiatan tidak akan diubah poin targetnya (otomatis dikunci mengikuti total poin sub-kegiatan).
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left bg-[var(--surface-2)]">
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-10 text-center">No</th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Nama Kegiatan <span className="text-status-red">*</span></th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-60">Semester <span className="text-status-red">*</span></th>
                  <th className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] w-28">Poin Target <span className="text-status-red">*</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2 text-center font-mono text-xs text-[var(--text-secondary)]">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.nama_kegiatan}
                        onChange={(e) => updateRow(idx, 'nama_kegiatan', e.target.value)}
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
                        className={cn("h-8 font-mono text-sm", row.hasSub && "bg-muted cursor-not-allowed")}
                        readOnly={row.hasSub}
                        title={row.hasSub ? "Nilai otomatis dari total sub kegiatan" : undefined}
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
