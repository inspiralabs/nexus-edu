'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  createBankSoal,
  deleteBankSoal,
  getActiveSemesterDiknas,
  getBankSoal,
  getSemesterOptions,
  searchMataKuliah,
  updateBankSoal,
  uploadBankSoalPDF,
  type BankSoalEntry,
} from '@/lib/queries/diknas'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const
const TIPE_SOAL_OPTIONS = ['Pilihan Ganda', 'Essai'] as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const bankSoalSchema = z.object({
  judul: z.string().min(1, 'Judul wajib diisi'),
  tipe: z.enum(['Pilihan Ganda', 'Essai']),
  mata_pelajaran_id: z.string().nullable(),
  semester_id: z.string().nullable(),
})

type BankSoalFormValues = z.infer<typeof bankSoalSchema>

interface ComboboxOption {
  value: string
  label: string
}

// ─── Halaman ──────────────────────────────────────────────────────────────────

export default function BankSoalPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [filterMapel, setFilterMapel] = useState('all')
  const [filterSemester, setFilterSemester] = useState('aktif')
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BankSoalEntry | null>(null)
  const [deletingItem, setDeletingItem] = useState<BankSoalEntry | null>(null)

  const [mapelSearch, setMapelSearch] = useState('')
  const [mapelOptions, setMapelOptions] = useState<ComboboxOption[]>([])

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const debouncedSearch = useDebounce(search, 300)
  const debouncedMapelSearch = useDebounce(mapelSearch, 300)

  const form = useForm<BankSoalFormValues>({
    resolver: zodResolver(bankSoalSchema),
    defaultValues: {
      judul: '',
      tipe: 'Pilihan Ganda',
      mata_pelajaran_id: null,
      semester_id: null,
    },
  })

  const isFormOpen = isAddOpen || isEditOpen

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester-diknas'],
    queryFn: getActiveSemesterDiknas,
  })

  const { data: semesterList = [] } = useQuery({
    queryKey: ['semester-options'],
    queryFn: getSemesterOptions,
  })

  const resolvedSemesterId = useMemo(() => {
    if (filterSemester === 'aktif') return activeSemester?.id ?? undefined
    if (filterSemester === 'all') return undefined
    return filterSemester
  }, [filterSemester, activeSemester])

  const queryFilters = useMemo(
    () => ({
      mapelId: filterMapel !== 'all' ? filterMapel : undefined,
      semesterId: resolvedSemesterId,
      search: debouncedSearch || undefined,
      page,
      pageSize,
    }),
    [filterMapel, resolvedSemesterId, debouncedSearch, page, pageSize]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['bank-soal', queryFilters],
    queryFn: () => getBankSoal(queryFilters),
  })

  useQuery({
    queryKey: ['mapel-search-bank', debouncedMapelSearch],
    queryFn: async () => {
      const results = await searchMataKuliah(debouncedMapelSearch)
      setMapelOptions(results.map((m) => ({ value: m.id, label: m.nama_mapel })))
      return results
    },
    enabled: isFormOpen,
  })

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getUserId = () => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bank-soal'] })
  }, [queryClient])

  const closeDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    setPreviewUrl(null)
    setSelectedFile(null)
    form.reset()
    setMapelOptions([])
  }

  const openEditDialog = (item: BankSoalEntry) => {
    setEditingItem(item)
    setMapelOptions(
      item.mata_pelajaran
        ? [{ value: item.mata_pelajaran_id!, label: item.mata_pelajaran.nama_mapel }]
        : []
    )
    const extKonten = item.konten as { pdf_url?: string } | null
    const existingUrl = extKonten?.pdf_url ?? null
    setPreviewUrl(existingUrl)
    setSelectedFile(null)
    form.reset({
      judul: item.judul,
      tipe: item.tipe as 'Pilihan Ganda' | 'Essai',
      mata_pelajaran_id: item.mata_pelajaran_id,
      semester_id: item.semester_id,
    })
    setIsEditOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (values: BankSoalFormValues & { pdf_url: string }) =>
      createBankSoal({
        judul: values.judul,
        tipe: values.tipe,
        mata_pelajaran_id: values.mata_pelajaran_id,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
        konten: { pdf_url: values.pdf_url },
        dibuat_oleh: profile?.user_id ?? null,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) await logAudit(userId, 'CREATE', 'bank_soal', result.id, null, { id: result.id })
      invalidate()
      toast({ title: 'Bank soal berhasil ditambahkan' })
      closeDialog()
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menyimpan data', description: e.message, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: BankSoalFormValues & { pdf_url: string } }) =>
      updateBankSoal(id, {
        judul: values.judul,
        tipe: values.tipe,
        mata_pelajaran_id: values.mata_pelajaran_id,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
        konten: { pdf_url: values.pdf_url },
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) await logAudit(userId, 'UPDATE', 'bank_soal', result.id, null, { id: result.id })
      invalidate()
      toast({ title: 'Bank soal berhasil diperbarui' })
      closeDialog()
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal memperbarui data', description: e.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteBankSoal(ids),
    onSuccess: async (_, ids) => {
      const userId = getUserId()
      if (userId) {
        for (const id of ids) {
          await logAudit(userId, 'DELETE', 'bank_soal', id, { id }, null)
        }
      }
      invalidate()
      toast({ title: 'Bank soal berhasil dihapus' })
      setIsDeleteOpen(false)
      setIsBulkDeleteOpen(false)
      setDeletingItem(null)
      setSelectedRows([])
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menghapus data', description: e.message, variant: 'destructive' }),
  })

  // ─── Columns ────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<BankSoalEntry>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'judul',
        header: 'Judul',
        cell: ({ row }) => {
          const extKonten = row.original.konten as { pdf_url?: string } | null
          const url = extKonten?.pdf_url
          if (url) {
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                {row.original.judul}
              </a>
            )
          }
          return row.original.judul
        }
      },
      { accessorKey: 'tipe', header: 'Tipe' },
      {
        id: 'mapel',
        header: 'Mapel',
        cell: ({ row }) => row.original.mata_pelajaran?.nama_mapel ?? '-',
      },
      {
        id: 'semester',
        header: 'Semester',
        cell: ({ row }) =>
          row.original.semester
            ? `Smt ${row.original.semester.nomor_semester} — ${row.original.semester.tahun_pelajaran?.nama ?? ''}`
            : '-',
      },
      {
        id: 'dibuat_oleh',
        header: 'Dibuat Oleh',
        cell: ({ row }) => row.original.dibuat_oleh ?? '-',
      },
      {
        id: 'aksi',
        header: 'Aksi',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0"
              onClick={() => openEditDialog(row.original)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
              onClick={() => { setDeletingItem(row.original); setIsDeleteOpen(true) }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize]
  )

  const onSubmit = async (values: BankSoalFormValues) => {
    try {
      setIsUploading(true)
      let finalPdfUrl = ''
      if (selectedFile) {
        finalPdfUrl = await uploadBankSoalPDF(selectedFile)
      } else if (isEditOpen && editingItem) {
        const extKonten = editingItem.konten as { pdf_url?: string } | null
        finalPdfUrl = extKonten?.pdf_url ?? ''
      }

      if (!finalPdfUrl) {
        toast({
          title: 'Pilih file PDF',
          description: 'Anda harus memilih berkas PDF soal.',
          variant: 'destructive',
        })
        setIsUploading(false)
        return
      }

      if (isEditOpen && editingItem) {
        updateMutation.mutate({
          id: editingItem.id,
          values: {
            ...values,
            pdf_url: finalPdfUrl,
          },
        })
      } else {
        createMutation.mutate({
          ...values,
          pdf_url: finalPdfUrl,
        })
      }
    } catch (e: any) {
      toast({
        title: 'Gagal mengunggah file',
        description: e.message,
        variant: 'destructive',
      })
      setIsUploading(false)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || isUploading

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
          <Input
            placeholder="Cari judul bank soal..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={filterSemester} onValueChange={(v) => { setFilterSemester(v); setPage(1) }}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktif">Semester Aktif</SelectItem>
            <SelectItem value="all">Semua Semester</SelectItem>
            {semesterList.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                Smt {s.nomor_semester} — {s.tahun_pelajaran?.nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          {selectedRows.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus ({selectedRows.length})
            </Button>
          )}
          <Button size="sm" onClick={() => { form.reset(); setIsAddOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : (
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
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          onSortChange={() => {}}
          selectedRows={selectedRows}
          onSelectRows={setSelectedRows}
          isLoading={isLoading}
        />
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Bank Soal' : 'Tambah Bank Soal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Judul</Label>
              <Input
                {...form.register('judul')}
                placeholder="Contoh: Ulangan Harian Bab 1 — Matematika Kelas 7"
              />
              {form.formState.errors.judul && (
                <p className="text-xs text-destructive">{form.formState.errors.judul.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipe Soal</Label>
                <Select
                  value={form.watch('tipe')}
                  onValueChange={(v) => form.setValue('tipe', v as 'Pilihan Ganda' | 'Essai')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPE_SOAL_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Mata Pelajaran</Label>
                <Combobox
                  options={mapelOptions}
                  value={form.watch('mata_pelajaran_id') ?? ''}
                  onSelect={(v) => form.setValue('mata_pelajaran_id', v || null)}
                  onSearch={setMapelSearch}
                  placeholder="Cari mapel..."
                  emptyMessage="Mapel tidak ditemukan"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Semester</Label>
              <Select
                value={form.watch('semester_id') ?? ''}
                onValueChange={(v) => form.setValue('semester_id', v || null)}
              >
                <SelectTrigger><SelectValue placeholder="Pilih semester" /></SelectTrigger>
                <SelectContent>
                  {semesterList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Smt {s.nomor_semester} — {s.tahun_pelajaran?.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Berkas Soal (PDF)</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setSelectedFile(file)
                    const localUrl = URL.createObjectURL(file)
                    setPreviewUrl(localUrl)
                  }
                }}
                className="cursor-pointer"
              />
              {previewUrl && (
                <div className="mt-2 border border-[var(--border)] rounded-md overflow-hidden bg-[var(--surface-2)]">
                  <iframe src={previewUrl} className="w-full h-96" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Batal</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Bank Soal"
        description="Bank soal ini akan dihapus permanen. Lanjutkan?"
        onConfirm={() => deletingItem && deleteMutation.mutate([deletingItem.id])}
        isLoading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        title="Hapus Bank Soal Terpilih"
        description={`${selectedRows.length} bank soal akan dihapus permanen. Lanjutkan?`}
        onConfirm={() => deleteMutation.mutate(selectedRows)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
