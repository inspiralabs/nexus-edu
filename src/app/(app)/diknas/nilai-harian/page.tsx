'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { CheckCircle2, ChevronDown, ChevronUp, Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Combobox } from '@/components/shared/combobox'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { DatePicker } from '@/components/shared/date-picker'
import { Badge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  approveNilaiHarian,
  createNilaiHarian,
  deleteNilaiHarian,
  getActiveSemesterDiknas,
  getKelasOptions,
  getMataKuliah,
  getNilaiHarian,
  getSemesterOptions,
  searchBankSoal,
  searchMataKuliah,
  updateNilaiHarian,
  type MataKuliah,
  type NilaiHarianEntry,
} from '@/lib/queries/diknas'
import { searchStudents } from '@/lib/queries/students'
import type { Unit } from '@/lib/supabase/types'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const nilaiHarianSchema = z.object({
  siswa_id: z.string().min(1, 'Pilih siswa'),
  mata_pelajaran_id: z.string().min(1, 'Pilih mata pelajaran'),
  semester_id: z.string().nullable(),
  tipe_nilai: z.enum(['Formatif', 'Sumatif']),
  nama_tugas: z.string().min(1, 'Nama tugas wajib diisi'),
  materi: z.string().nullable(),
  bab: z.string().nullable(),
  nilai_asli: z.number().min(0).max(100).nullable(),
  bank_soal_id: z.string().nullable(),
  tanggal: z.date().nullable(),
  // Remedial
  ada_remedial: z.boolean(),
  nilai_remedial: z.number().min(0).max(100).nullable(),
  tipe_remedial: z.string().nullable(),
  bank_soal_remedial_id: z.string().nullable(),
})

type NilaiHarianFormValues = z.infer<typeof nilaiHarianSchema>

interface ComboboxOption {
  value: string
  label: string
}

// ─── Halaman ──────────────────────────────────────────────────────────────────

export default function NilaiHarianPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [filterKelas, setFilterKelas] = useState('all')
  const [filterMapel, setFilterMapel] = useState('all')
  const [filterSemester, setFilterSemester] = useState('aktif')
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [isApproveOpen, setIsApproveOpen] = useState(false)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<NilaiHarianEntry | null>(null)
  const [deletingItem, setDeletingItem] = useState<NilaiHarianEntry | null>(null)

  // Combobox search states
  const [siswaSearch, setSiswaSearch] = useState('')
  const [mapelSearch, setMapelSearch] = useState('')
  const [bankSoalSearch, setBankSoalSearch] = useState('')
  const [siswaOptions, setSiswaOptions] = useState<ComboboxOption[]>([])
  const [mapelOptions, setMapelOptions] = useState<ComboboxOption[]>([])
  const [bankSoalOptions, setBankSoalOptions] = useState<ComboboxOption[]>([])

  const debouncedSearch = useDebounce(search, 300)
  const debouncedSiswaSearch = useDebounce(siswaSearch, 300)
  const debouncedMapelSearch = useDebounce(mapelSearch, 300)
  const debouncedBankSoalSearch = useDebounce(bankSoalSearch, 300)

  const form = useForm<NilaiHarianFormValues>({
    resolver: zodResolver(nilaiHarianSchema),
    defaultValues: {
      siswa_id: '',
      mata_pelajaran_id: '',
      semester_id: null,
      tipe_nilai: 'Formatif',
      nama_tugas: '',
      materi: null,
      bab: null,
      nilai_asli: null,
      bank_soal_id: null,
      tanggal: new Date(),
      ada_remedial: false,
      nilai_remedial: null,
      tipe_remedial: null,
      bank_soal_remedial_id: null,
    },
  })

  const adaRemedial = form.watch('ada_remedial')
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

  const { data: mapelList = [] } = useQuery({
    queryKey: ['mapel-list', activeUnit],
    queryFn: () => getMataKuliah(activeUnit),
  })

  const resolvedSemesterId = useMemo(() => {
    if (filterSemester === 'aktif') return activeSemester?.id ?? undefined
    if (filterSemester === 'all') return undefined
    return filterSemester
  }, [filterSemester, activeSemester])

  const queryFilters = useMemo(
    () => ({
      unit: activeUnit,
      kelas: filterKelas !== 'all' ? filterKelas : undefined,
      mapelId: filterMapel !== 'all' ? filterMapel : undefined,
      semesterId: resolvedSemesterId,
      search: debouncedSearch || undefined,
      page,
      pageSize,
    }),
    [activeUnit, filterKelas, filterMapel, resolvedSemesterId, debouncedSearch, page, pageSize]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['nilai-harian', queryFilters],
    queryFn: () => getNilaiHarian(queryFilters),
  })

  // Search combobox
  useQuery({
    queryKey: ['siswa-search-nilai', debouncedSiswaSearch, activeUnit],
    queryFn: async () => {
      const results = await searchStudents(debouncedSiswaSearch, activeUnit)
      setSiswaOptions(results.map((s) => ({ value: s.id, label: `${s.nama} — ${s.kelas}` })))
      return results
    },
    enabled: isFormOpen,
  })

  useQuery({
    queryKey: ['mapel-search-nilai', debouncedMapelSearch, activeUnit],
    queryFn: async () => {
      const results = await searchMataKuliah(debouncedMapelSearch, activeUnit)
      setMapelOptions(results.map((m) => ({ value: m.id, label: m.nama_mapel })))
      return results
    },
    enabled: isFormOpen,
  })

  useQuery({
    queryKey: ['bank-soal-search', debouncedBankSoalSearch],
    queryFn: async () => {
      const results = await searchBankSoal(debouncedBankSoalSearch)
      setBankSoalOptions(results.map((b) => ({ value: b.id, label: b.judul })))
      return results
    },
    enabled: isFormOpen,
  })

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getUserId = () => profile?.id ?? null
  const dicatatOleh = profile?.id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['nilai-harian'] })
    queryClient.invalidateQueries({ queryKey: ['diknas-dashboard-stats'] })
  }, [queryClient])

  const closeDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    form.reset()
    setSiswaOptions([])
    setMapelOptions([])
    setBankSoalOptions([])
  }

  const openEditDialog = (item: NilaiHarianEntry) => {
    setEditingItem(item)
    setSiswaOptions(
      item.students
        ? [{ value: item.siswa_id, label: `${item.students.nama} — ${item.students.kelas}` }]
        : []
    )
    setMapelOptions(
      item.mata_pelajaran
        ? [{ value: item.mata_pelajaran_id, label: item.mata_pelajaran.nama_mapel }]
        : []
    )
    setBankSoalOptions(
      item.bank_soal
        ? [{ value: item.bank_soal_id!, label: item.bank_soal.judul }]
        : []
    )
    form.reset({
      siswa_id: item.siswa_id,
      mata_pelajaran_id: item.mata_pelajaran_id,
      semester_id: item.semester_id,
      tipe_nilai: item.tipe_nilai,
      nama_tugas: item.nama_tugas,
      materi: item.materi,
      bab: item.bab,
      nilai_asli: item.nilai_asli,
      bank_soal_id: item.bank_soal_id,
      tanggal: item.tanggal ? parseISO(item.tanggal) : new Date(),
      ada_remedial: item.nilai_remedial !== null,
      nilai_remedial: item.nilai_remedial,
      tipe_remedial: item.tipe_remedial,
      bank_soal_remedial_id: null,
    })
    setIsEditOpen(true)
  }

  function formatTanggal(t: string | null) {
    if (!t) return '-'
    try {
      return format(parseISO(t), 'dd/MM/yyyy')
    } catch {
      return t
    }
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (values: NilaiHarianFormValues) => {
      if (!profile?.id) throw new Error('Sesi pengguna tidak valid')
      if (!(values.semester_id ?? activeSemester?.id)) throw new Error('Semester aktif tidak ditemukan')
      return createNilaiHarian({
        siswa_id: values.siswa_id,
        mata_pelajaran_id: values.mata_pelajaran_id,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
        tipe_nilai: values.tipe_nilai,
        nama_tugas: values.nama_tugas,
        materi: values.materi,
        bab: values.bab,
        nilai_asli: values.nilai_asli,
        nilai_remedial: values.ada_remedial ? values.nilai_remedial : null,
        tipe_remedial: values.ada_remedial ? values.tipe_remedial : null,
        bank_soal_id: values.bank_soal_id,
        dicatat_oleh: profile.id,
        tanggal: values.tanggal ? format(values.tanggal, 'yyyy-MM-dd') : null,
      })
    },
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'nilai_harian', result.id, null, { id: result.id })
      }
      invalidate()
      toast({ title: 'Nilai harian berhasil ditambahkan' })
      closeDialog()
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menyimpan data', description: e.message, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: NilaiHarianFormValues }) =>
      updateNilaiHarian(id, {
        tipe_nilai: values.tipe_nilai,
        nama_tugas: values.nama_tugas,
        materi: values.materi,
        bab: values.bab,
        nilai_asli: values.nilai_asli,
        nilai_remedial: values.ada_remedial ? values.nilai_remedial : null,
        tipe_remedial: values.ada_remedial ? values.tipe_remedial : null,
        bank_soal_id: values.bank_soal_id,
        tanggal: values.tanggal ? format(values.tanggal, 'yyyy-MM-dd') : null,
        // Setiap edit ulang, reset approval
        is_approved: false,
        approved_at: null,
        approved_by: null,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'UPDATE', 'nilai_harian', result.id, null, { id: result.id })
      }
      invalidate()
      toast({ title: 'Nilai harian berhasil diperbarui' })
      closeDialog()
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal memperbarui data', description: e.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteNilaiHarian(ids),
    onSuccess: async (_, ids) => {
      const userId = getUserId()
      if (userId) {
        for (const id of ids) {
          await logAudit(userId, 'DELETE', 'nilai_harian', id, { id }, null)
        }
      }
      invalidate()
      toast({ title: 'Nilai harian berhasil dihapus' })
      setIsDeleteOpen(false)
      setIsBulkDeleteOpen(false)
      setDeletingItem(null)
      setSelectedRows([])
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menghapus data', description: e.message, variant: 'destructive' }),
  })

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!profile?.id) throw new Error('Sesi pengguna tidak valid')
      return approveNilaiHarian(selectedRows, profile.id)
    },
    onSuccess: async () => {
      const userId = getUserId()
      if (userId) {
        for (const id of selectedRows) {
          await logAudit(userId, 'UPDATE', 'nilai_harian', id, { is_approved: false }, { is_approved: true })
        }
      }
      invalidate()
      toast({ title: 'Nilai berhasil disetujui dan ditampilkan ke orang tua' })
      setIsApproveOpen(false)
      setSelectedRows([])
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menyetujui nilai', description: e.message, variant: 'destructive' }),
  })

  // ─── Columns ────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<NilaiHarianEntry>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        id: 'nama',
        header: 'Nama',
        cell: ({ row }) => row.original.students?.nama ?? '-',
      },
      {
        id: 'kelas',
        header: 'Kelas',
        cell: ({ row }) => row.original.students?.kelas ?? '-',
      },
      {
        id: 'mapel',
        header: 'Mapel',
        cell: ({ row }) => row.original.mata_pelajaran?.nama_mapel ?? '-',
      },
      {
        accessorKey: 'tipe_nilai',
        header: 'Tipe',
        cell: ({ row }) => (
          <Badge variant={row.original.tipe_nilai === 'Formatif' ? 'secondary' : 'default'}>
            {row.original.tipe_nilai}
          </Badge>
        ),
      },
      {
        accessorKey: 'nama_tugas',
        header: 'Nama Tugas',
      },
      {
        id: 'nilai_asli',
        header: 'Nilai Asli',
        cell: ({ row }) => row.original.nilai_asli ?? '-',
      },
      {
        id: 'nilai_remedial',
        header: 'Remedial',
        cell: ({ row }) => row.original.nilai_remedial ?? '-',
      },
      {
        id: 'nilai_final',
        header: 'Nilai Final',
        cell: ({ row }) => {
          const v = row.original.nilai_final
          if (v === null) return '-'
          return (
            <span className={v >= 70 ? 'font-semibold text-green-600' : 'font-semibold text-yellow-600'}>
              {v}
            </span>
          )
        },
      },
      {
        accessorKey: 'is_approved',
        header: 'Approved',
        cell: ({ row }) => (
          <Badge variant={row.original.is_approved ? 'success' : 'warning'}>
            {row.original.is_approved ? 'Approved' : 'Draft'}
          </Badge>
        ),
      },
      {
        id: 'aksi',
        header: 'Aksi',
        enableSorting: false,
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

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = (values: NilaiHarianFormValues) => {
    if (!profile?.id) {
      toast({ title: 'Sesi pengguna tidak valid', variant: 'destructive' })
      return
    }
    const effectiveSemesterId = values.semester_id || activeSemester?.id
    if (!effectiveSemesterId) {
      toast({ title: 'Semester aktif tidak ditemukan', variant: 'destructive' })
      return
    }
    if (isEditOpen && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  // Filter: hanya row yang belum approved untuk Approve Terpilih
  const selectedDraftRows = selectedRows.filter((id) => {
    const item = data?.data.find((r) => r.id === id)
    return item && !item.is_approved
  })

  const { data: kelasList = [] } = useQuery({
    queryKey: ['kelas-options', activeUnit],
    queryFn: () => getKelasOptions(activeUnit),
  })

  // Reset filter kelas jika tidak valid saat unit berubah
  useEffect(() => {
    if (filterKelas !== 'all' && kelasList.length > 0 && !kelasList.includes(filterKelas)) {
      setFilterKelas('all')
    }
  }, [activeUnit, kelasList, filterKelas])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Unit Tabs */}
      <Tabs
        value={activeUnit}
        onValueChange={(v) => {
          setActiveUnit(v as Unit)
          setPage(1)
          setSelectedRows([])
          setFilterKelas('all')
          setFilterMapel('all')
        }}
      >
        <TabsList className="no-print">
          {UNITS.map((u) => <TabsTrigger key={u} value={u}>{u}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {/* Filter bar */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
          <Input
            placeholder="Cari nama siswa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={filterKelas} onValueChange={(v) => { setFilterKelas(v); setPage(1) }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Kelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {kelasList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMapel} onValueChange={(v) => { setFilterMapel(v); setPage(1) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Mapel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Mapel</SelectItem>
            {mapelList.map((m: MataKuliah) => <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSemester} onValueChange={(v) => { setFilterSemester(v); setPage(1) }}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
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
          {selectedDraftRows.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setIsApproveOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
              Approve ({selectedDraftRows.length})
            </Button>
          )}
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

      {/* Tabel */}
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

      {/* ─── Form Dialog ─── */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Nilai Harian' : 'Tambah Nilai Harian'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Siswa */}
              <div className="space-y-1">
                <Label>Siswa</Label>
                <Combobox
                  options={siswaOptions}
                  value={form.watch('siswa_id')}
                  onSelect={(v) => form.setValue('siswa_id', v)}
                  onSearch={setSiswaSearch}
                  placeholder="Cari nama siswa..."
                  emptyMessage="Siswa tidak ditemukan"
                />
                {form.formState.errors.siswa_id && (
                  <p className="text-xs text-destructive">{form.formState.errors.siswa_id.message}</p>
                )}
              </div>

              {/* Mapel */}
              <div className="space-y-1">
                <Label>Mata Pelajaran</Label>
                <Combobox
                  options={mapelOptions}
                  value={form.watch('mata_pelajaran_id')}
                  onSelect={(v) => form.setValue('mata_pelajaran_id', v)}
                  onSearch={setMapelSearch}
                  placeholder="Cari mata pelajaran..."
                  emptyMessage="Mapel tidak ditemukan"
                />
                {form.formState.errors.mata_pelajaran_id && (
                  <p className="text-xs text-destructive">{form.formState.errors.mata_pelajaran_id.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tipe Nilai */}
              <div className="space-y-1">
                <Label>Tipe Nilai</Label>
                <Select value={form.watch('tipe_nilai')} onValueChange={(v) => form.setValue('tipe_nilai', v as 'Formatif' | 'Sumatif')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Formatif">Formatif</SelectItem>
                    <SelectItem value="Sumatif">Sumatif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tanggal */}
              <div className="space-y-1">
                <Label>Tanggal</Label>
                <DatePicker
                  value={form.watch('tanggal') ?? undefined}
                  onChange={(d) => form.setValue('tanggal', d ?? null)}
                />
              </div>
            </div>

            {/* Nama Tugas */}
            <div className="space-y-1">
              <Label>Nama Tugas</Label>
              <Input
                {...form.register('nama_tugas')}
                placeholder="Contoh: Ulangan Bab 1, PR Hal. 30-35"
              />
              {form.formState.errors.nama_tugas && (
                <p className="text-xs text-destructive">{form.formState.errors.nama_tugas.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Materi (opsional)</Label>
                <Input
                  {...form.register('materi')}
                  placeholder="Nama materi/topik"
                />
              </div>
              <div className="space-y-1">
                <Label>Bab (opsional)</Label>
                <Input
                  {...form.register('bab')}
                  placeholder="Contoh: Bab 3"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nilai Asli</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.watch('nilai_asli') ?? ''}
                  onChange={(e) => form.setValue('nilai_asli', e.target.value === '' ? null : parseFloat(e.target.value))}
                  placeholder="0–100"
                />
              </div>
              <div className="space-y-1">
                <Label>Bank Soal (opsional)</Label>
                <Combobox
                  options={bankSoalOptions}
                  value={form.watch('bank_soal_id') ?? ''}
                  onSelect={(v) => form.setValue('bank_soal_id', v || null)}
                  onSearch={setBankSoalSearch}
                  placeholder="Pilih bank soal..."
                  emptyMessage="Bank soal tidak ditemukan"
                />
              </div>
            </div>

            {/* Remedial Section */}
            <div className="rounded-lg border border-[var(--border)] p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="ada-remedial"
                  checked={adaRemedial}
                  onCheckedChange={(v) => form.setValue('ada_remedial', v)}
                />
                <Label htmlFor="ada-remedial" className="cursor-pointer">Ada Remedial</Label>
              </div>
              {adaRemedial && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Nilai Remedial</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={form.watch('nilai_remedial') ?? ''}
                      onChange={(e) => form.setValue('nilai_remedial', e.target.value === '' ? null : parseFloat(e.target.value))}
                      placeholder="0–100"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Tipe Remedial</Label>
                    <Input
                      {...form.register('tipe_remedial')}
                      placeholder="Tugas Ulang / Tes Lisan / dll"
                    />
                  </div>
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
        open={isApproveOpen}
        onOpenChange={setIsApproveOpen}
        title="Approve Nilai Terpilih"
        description={`Nilai yang diapprove akan tampil di dashboard orang tua siswa. Approve ${selectedDraftRows.length} nilai?`}
        onConfirm={() => {
          if (!profile?.id) {
            toast({ title: 'Sesi pengguna tidak valid', variant: 'destructive' })
            return
          }
          approveMutation.mutate()
        }}
        isLoading={approveMutation.isPending}
        variant="default"
      />

      {/* ─── Confirm Delete ─── */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Nilai Harian"
        description="Data nilai ini akan dihapus permanen. Lanjutkan?"
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
        title="Hapus Nilai Terpilih"
        description={`${selectedRows.length} data nilai akan dihapus permanen. Lanjutkan?`}
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
  )
}
