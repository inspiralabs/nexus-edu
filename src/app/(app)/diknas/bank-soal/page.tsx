'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Combobox } from '@/components/shared/combobox'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  getMataKuliah,
  getSemesterOptions,
  searchMataKuliah,
  updateBankSoal,
  uploadBankSoalPDF,
  type BankSoalEntry,
  type MataKuliah,
} from '@/lib/queries/diknas'
import { getTipeNilai } from '@/lib/queries/tipe-nilai'
import { GuruMapelGate } from '../_components/guru-mapel-gate'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const
const TIPE_SOAL_OPTIONS = ['Pilihan Ganda', 'Essai', 'Pilihan Ganda dan Essai', 'Ujian Lisan', 'Ujian Berbasis Proyek', "Ujian Kelompok"] as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const bankSoalSchema = z.object({
  judul: z.string().min(1, 'Judul wajib diisi'),
  tipe: z.enum(TIPE_SOAL_OPTIONS),
  mata_pelajaran_id: z.string().min(1, 'Mata pelajaran wajib dipilih').nullable(),
  semester_id: z.string().nullable(),
  tipe_nilai_id: z.string().uuid('Pilih tipe nilai'),
  materi: z.string().min(1, 'Materi wajib diisi'),
  bab: z.array(z.string()).min(1, 'Pilih minimal satu BAB'),
  tujuan_pembelajaran: z.string().optional(),
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
  const [filterTipeSoal, setFilterTipeSoal] = useState('all')
  const [filterSemester, setFilterSemester] = useState('aktif')
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BankSoalEntry | null>(null)
  const [deletingItem, setDeletingItem] = useState<BankSoalEntry | null>(null)

  const [mapelSearch, setMapelSearch] = useState('')

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const debouncedSearch = useDebounce(search, 300)
  const debouncedMapelSearch = useDebounce(mapelSearch, 300)

  const { data: mapelList = [] } = useQuery({
    queryKey: ['mapel-list'],
    queryFn: () => getMataKuliah(),
  })

  const filteredMapels = useMemo(() => {
    if (profile?.role === 'user') {
      const allowedIds = profile.mapel_ids || []
      return mapelList.filter((m: MataKuliah) => allowedIds.includes(m.id))
    }
    return mapelList
  }, [profile, mapelList])

  const shouldDisableMapelSelect = useMemo(() => {
    return filteredMapels.length === 1
  }, [filteredMapels])

  const singleMapelIdVal = useMemo(() => {
    return shouldDisableMapelSelect ? filteredMapels[0].id : null
  }, [shouldDisableMapelSelect, filteredMapels])
  const form = useForm<BankSoalFormValues>({
    resolver: zodResolver(bankSoalSchema),
    defaultValues: {
      judul: '',
      tipe: 'Pilihan Ganda',
      mata_pelajaran_id: singleMapelIdVal ?? null,
      semester_id: null,
      tipe_nilai_id: '',
      materi: '',
      bab: [],
      tujuan_pembelajaran: '',
    },
  })

  // Sync mapel lock
  useEffect(() => {
    if (singleMapelIdVal) {
      setFilterMapel(singleMapelIdVal)
      form.setValue('mata_pelajaran_id', singleMapelIdVal)
    }
  }, [singleMapelIdVal, form])

  const isFormOpen = isAddOpen || isEditOpen

  // Reset Form & State via Modal Lifecycle
  useEffect(() => {
    if (!isFormOpen) {
      setIsUploading(false)
      setSelectedFile(null)
      setPreviewUrl(null)
      form.reset({
        judul: '',
        tipe: 'Pilihan Ganda',
        mata_pelajaran_id: shouldDisableMapelSelect ? singleMapelIdVal : null,
        semester_id: null,
        tipe_nilai_id: '',
        materi: '',
        bab: [],
        tujuan_pembelajaran: '',
      })
    }
  }, [isFormOpen, shouldDisableMapelSelect, singleMapelIdVal, form])

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester-diknas'],
    queryFn: getActiveSemesterDiknas,
  })

  const { data: semesterList = [] } = useQuery({
    queryKey: ['semester-options'],
    queryFn: getSemesterOptions,
  })

  const { data: tipeNilaiList = [] } = useQuery({
    queryKey: ['tipe-nilai-list'],
    queryFn: getTipeNilai,
  })

  const selectedTipeNilaiId = form.watch('tipe_nilai_id')
  const selectedTipeNilai = useMemo(() => {
    return tipeNilaiList.find((t) => t.id === selectedTipeNilaiId)
  }, [selectedTipeNilaiId, tipeNilaiList])



  const resolvedSemesterId = useMemo(() => {
    if (filterSemester === 'aktif') return activeSemester?.id ?? undefined
    if (filterSemester === 'all') return undefined
    return filterSemester
  }, [filterSemester, activeSemester])

  const queryFilters = useMemo(
    () => ({
      mapelId: filterMapel !== 'all' ? filterMapel : undefined,
      semesterId: resolvedSemesterId,
      tipe: filterTipeSoal !== 'all' ? filterTipeSoal : undefined,
      search: debouncedSearch || undefined,
      page,
      pageSize,
    }),
    [filterMapel, resolvedSemesterId, filterTipeSoal, debouncedSearch, page, pageSize]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['bank-soal', queryFilters],
    queryFn: () => getBankSoal(queryFilters),
  })

  const { data: searchedMapels = [] } = useQuery({
    queryKey: ['mapel-search-bank', debouncedMapelSearch],
    queryFn: () => searchMataKuliah(debouncedMapelSearch),
    enabled: isFormOpen && !shouldDisableMapelSelect,
  })

  const mapelOptions = useMemo<ComboboxOption[]>(() => {
    if (shouldDisableMapelSelect && singleMapelIdVal && filteredMapels.length > 0) {
      const singleMapel = filteredMapels[0]
      return [{ value: singleMapel.id, label: `${singleMapel.nama_mapel} - ${singleMapel.unit || ''}` }]
    }

    const options: ComboboxOption[] = []

    if (isEditOpen && editingItem?.mata_pelajaran) {
      options.push({
        value: editingItem.mata_pelajaran_id!,
        label: `${editingItem.mata_pelajaran.nama_mapel} - ${editingItem.mata_pelajaran.unit || ''}`,
      })
    }

    const allowedIds = profile?.mapel_ids || []
    const filteredSearch = profile?.role === 'user'
      ? searchedMapels.filter((m) => allowedIds.includes(m.id))
      : searchedMapels

    filteredSearch.forEach((m) => {
      if (!options.some((opt) => opt.value === m.id)) {
        options.push({ value: m.id, label: `${m.nama_mapel} - ${m.unit || ''}` })
      }
    })

    filteredMapels.forEach((m) => {
      if (!options.some((opt) => opt.value === m.id)) {
        options.push({ value: m.id, label: `${m.nama_mapel} - ${m.unit || ''}` })
      }
    })

    return options
  }, [shouldDisableMapelSelect, singleMapelIdVal, filteredMapels, profile, searchedMapels, isEditOpen, editingItem])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getUserId = () => profile?.id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bank-soal'] })
  }, [queryClient])

  const closeDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    setPreviewUrl(null)
    setSelectedFile(null)
    form.reset({
      judul: '',
      tipe: 'Pilihan Ganda',
      mata_pelajaran_id: shouldDisableMapelSelect ? singleMapelIdVal : null,
      semester_id: null,
      tipe_nilai_id: '',
      materi: '',
      bab: [],
      tujuan_pembelajaran: '',
    })
  }

  const openEditDialog = (item: BankSoalEntry) => {
    setEditingItem(item)
    const extKonten = item.konten as { pdf_url?: string } | null
    const existingUrl = extKonten?.pdf_url ?? null
    setPreviewUrl(existingUrl)
    setSelectedFile(null)
    form.reset({
      judul: item.judul,
      tipe: item.tipe,
      mata_pelajaran_id: item.mata_pelajaran_id,
      semester_id: item.semester_id,
      tipe_nilai_id: item.tipe_nilai_id || '',
      materi: item.materi || '',
      bab: item.bab || [],
      tujuan_pembelajaran: item.tujuan_pembelajaran || '',
    })
    setIsEditOpen(true)
  }
  const createMutation = useMutation({
    mutationFn: (values: BankSoalFormValues & { pdf_url: string }) => {
      if (!profile?.id) throw new Error('Sesi pengguna tidak valid')
      if (!(values.semester_id ?? activeSemester?.id)) throw new Error('Semester aktif tidak ditemukan')
      return createBankSoal({
        judul: values.judul,
        tipe: values.tipe,
        mata_pelajaran_id: values.mata_pelajaran_id,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
        konten: { pdf_url: values.pdf_url },
        dibuat_oleh: profile.id,
        tipe_nilai_id: values.tipe_nilai_id,
        materi: values.materi,
        bab: values.bab,
        tujuan_pembelajaran: values.tujuan_pembelajaran || null,
      })
    },
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
        tipe_nilai_id: values.tipe_nilai_id,
        materi: values.materi,
        bab: values.bab,
        tujuan_pembelajaran: values.tujuan_pembelajaran || null,
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
        id: 'tipe_nilai',
        header: 'Tipe Nilai',
        cell: ({ row }) => row.original.tipe_nilai?.nama_tipe || '-',
      },
      {
        id: 'materi',
        header: 'Materi',
        cell: ({ row }) => row.original.materi || '-',
      },
      {
        id: 'bab',
        header: 'Bab',
        cell: ({ row }) => row.original.bab?.join(', ') || '-',
      },
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
        cell: ({ row }) => row.original.profiles?.nama_lengkap ?? '-',
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
    if (!profile?.id) {
      toast({ title: 'Sesi pengguna tidak valid', variant: 'destructive' })
      return
    }
    const effectiveSemesterId = values.semester_id || activeSemester?.id
    if (!effectiveSemesterId) {
      toast({ title: 'Semester aktif tidak ditemukan', variant: 'destructive' })
      return
    }
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
        return
      }

      if (isEditOpen && editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          values: {
            ...values,
            pdf_url: finalPdfUrl,
          },
        })
      } else {
        await createMutation.mutateAsync({
          ...values,
          pdf_url: finalPdfUrl,
        })
      }
    } catch (e: any) {
      toast({
        title: 'Gagal menyimpan data',
        description: e.message,
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || isUploading

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <GuruMapelGate>
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
          <Select value={filterMapel} onValueChange={(v) => { setFilterMapel(v); setPage(1) }} disabled={shouldDisableMapelSelect}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Mapel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Mapel</SelectItem>
              {filteredMapels.map((m: MataKuliah) => (
                <SelectItem key={m.id} value={m.id}>{m.nama_mapel} - {m.unit}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTipeSoal} onValueChange={(v) => { setFilterTipeSoal(v); setPage(1) }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Tipe Soal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe Soal</SelectItem>
              {TIPE_SOAL_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
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
            onSortChange={() => { }}
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
                    onValueChange={(v) => form.setValue('tipe', v as any)}
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
                    disabled={shouldDisableMapelSelect}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Tipe Nilai</Label>
                  <Select
                    value={form.watch('tipe_nilai_id') ?? ''}
                    onValueChange={(v) => form.setValue('tipe_nilai_id', v || '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe Nilai" />
                    </SelectTrigger>
                    <SelectContent>
                      {tipeNilaiList.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nama_tipe} ({t.jenis_nilai})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTipeNilai && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Jenis: <span className="font-semibold text-primary">{selectedTipeNilai.jenis_nilai}</span>
                    </p>
                  )}
                  {form.formState.errors.tipe_nilai_id && (
                    <p className="text-xs text-destructive">{form.formState.errors.tipe_nilai_id.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Materi</Label>
                  <Input
                    {...form.register('materi')}
                    placeholder="Contoh: Aljabar Linear, Fotosintesis"
                  />
                  {form.formState.errors.materi && (
                    <p className="text-xs text-destructive">{form.formState.errors.materi.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bab (Pilih Bab yang Tercakup)</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const babName = `BAB ${idx + 1}`
                    const currentBab = form.watch('bab') || []
                    const isChecked = currentBab.includes(babName)
                    return (
                      <div key={babName} className="flex items-center space-x-2">
                        <Checkbox
                          id={`bab-${babName}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              form.setValue('bab', [...currentBab, babName])
                            } else {
                              form.setValue('bab', currentBab.filter((b) => b !== babName))
                            }
                          }}
                        />
                        <Label htmlFor={`bab-${babName}`} className="text-sm font-normal cursor-pointer select-none">
                          {babName}
                        </Label>
                      </div>
                    )
                  })}
                </div>
                {form.formState.errors.bab && (
                  <p className="text-xs text-destructive">{form.formState.errors.bab.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Tujuan Pembelajaran (opsional)</Label>
                <Textarea
                  {...form.register('tujuan_pembelajaran')}
                  placeholder="Contoh: Mengidentifikasi gagasan utama dalam paragraf..."
                  className="min-h-[80px]"
                />
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
          onConfirm={() => {
            if (!profile?.id) {
              toast({ title: 'Sesi pengguna tidak valid', variant: 'destructive' })
              return
            }
            deletingItem && deleteMutation.mutate([deletingItem.id])
          }}
          isLoading={deleteMutation.isPending}
        />
        <ConfirmDialog
          open={isBulkDeleteOpen}
          onOpenChange={setIsBulkDeleteOpen}
          title="Hapus Bank Soal Terpilih"
          description={`${selectedRows.length} bank soal akan dihapus permanen. Lanjutkan?`}
          onConfirm={() => {
            if (!profile?.id) {
              toast({ title: 'Sesi pengguna tidak valid', variant: 'destructive' })
              return
            }
            deleteMutation.mutate(selectedRows)
          }}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </GuruMapelGate>
  )
}

