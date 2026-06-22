'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  bulkCreateCatatanKelakuan,
  createCatatanKelakuan,
  deleteCatatanKelakuan,
  getActiveSemesterDiknas,
  getCatatanKelakuan,
  getKelasOptions,
  getSemesterOptions,
  updateCatatanKelakuan,
  type CatatanKelakuanEntry,
} from '@/lib/queries/diknas'
import { searchStudents } from '@/lib/queries/students'
import type { Unit } from '@/lib/supabase/types'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const
const TIPE_CATATAN = ['Baik', 'Kurang Baik'] as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const catatanSchema = z.object({
  siswa_id: z.string().min(1, 'Pilih siswa'),
  semester_id: z.string().nullable(),
  tipe: z.enum(['Baik', 'Kurang Baik']),
  catatan: z.string().min(1, 'Catatan wajib diisi'),
  tanggal: z.date().nullable(),
})

type CatatanFormValues = z.infer<typeof catatanSchema>

interface ComboboxOption {
  value: string
  label: string
}

// ─── Halaman ──────────────────────────────────────────────────────────────────

export default function CatatanKelakuanPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [filterKelas, setFilterKelas] = useState('all')
  const [filterSemester, setFilterSemester] = useState('aktif')
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatatanKelakuanEntry | null>(null)
  const [deletingItem, setDeletingItem] = useState<CatatanKelakuanEntry | null>(null)

  // Bulk input states
  const [bulkKelas, setBulkKelas] = useState('')
  const [bulkTanggal, setBulkTanggal] = useState<Date>(new Date())
  const [bulkData, setBulkData] = useState<Record<string, { tipe: 'Baik' | 'Kurang Baik'; catatan: string }>>({})

  const [siswaSearch, setSiswaSearch] = useState('')
  const [siswaOptions, setSiswaOptions] = useState<ComboboxOption[]>([])

  const debouncedSearch = useDebounce(search, 300)
  const debouncedSiswaSearch = useDebounce(siswaSearch, 300)

  const form = useForm<CatatanFormValues>({
    resolver: zodResolver(catatanSchema),
    defaultValues: {
      siswa_id: '',
      semester_id: null,
      tipe: 'Baik',
      catatan: '',
      tanggal: new Date(),
    },
  })

  const isFormOpen = isEditOpen

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
      unit: activeUnit,
      kelas: filterKelas !== 'all' ? filterKelas : undefined,
      semesterId: resolvedSemesterId,
      search: debouncedSearch || undefined,
      page,
      pageSize,
    }),
    [activeUnit, filterKelas, resolvedSemesterId, debouncedSearch, page, pageSize]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['catatan-kelakuan', queryFilters],
    queryFn: () => getCatatanKelakuan(queryFilters),
  })

  // Siswa untuk bulk input — kini menggunakan kelas_id (UUID)
  const { data: siswaPerKelas = [], isLoading: siswaLoading } = useQuery({
    queryKey: ['siswa-kelas-catatan', bulkKelas, activeUnit],
    queryFn: async () => {
      if (!bulkKelas) return []
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: rows, error } = await supabase
        .from('students')
        .select('id, nama, kelas_id, kelas(nama_kelas)')
        .eq('kelas_id', bulkKelas)
        .eq('unit', activeUnit)
        .eq('is_alumni', false)
        .order('nama')
      if (error) throw new Error(error.message)
      return (rows ?? []).map((r: any) => ({
        id: r.id as string,
        nama: r.nama as string,
      }))
    },
    enabled: isAddOpen && Boolean(bulkKelas),
  })

  // Sync bulk data siswa
  useEffect(() => {
    if (siswaPerKelas.length > 0) {
      const initial: Record<string, { tipe: 'Baik' | 'Kurang Baik'; catatan: string }> = {}
      siswaPerKelas.forEach((s) => {
        initial[s.id] = { tipe: 'Baik', catatan: '' }
      })

      setBulkData((prev) => {
        const currentSiswaIds = siswaPerKelas.map((s) => s.id)
        const existingSiswaIds = Object.keys(prev)
        const isSame =
          currentSiswaIds.length === existingSiswaIds.length &&
          currentSiswaIds.every((id) => id in prev)
        if (isSame) return prev
        return initial
      })
    } else {
      setBulkData((prev) => {
        if (Object.keys(prev).length === 0) return prev
        return {}
      })
    }
  }, [siswaPerKelas?.length, bulkKelas])

  useQuery({
    queryKey: ['siswa-search-catatan', debouncedSiswaSearch, activeUnit],
    queryFn: async () => {
      const results = await searchStudents(debouncedSiswaSearch, activeUnit)
      setSiswaOptions(results.map((s) => ({ value: s.id, label: `${s.nama} — ${s.kelas}` })))
      return results
    },
    enabled: isFormOpen,
  })

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getUserId = () => profile?.id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['catatan-kelakuan'] })
    queryClient.invalidateQueries({ queryKey: ['diknas-dashboard-stats'] })
  }, [queryClient])

  const closeDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    form.reset({
      siswa_id: '',
      semester_id: null,
      tipe: 'Baik',
      catatan: '',
      tanggal: new Date(),
    })
    setSiswaOptions([])
  }

  const openEditDialog = (item: CatatanKelakuanEntry) => {
    setEditingItem(item)
    setSiswaOptions(
      item.students
        ? [{ value: item.siswa_id, label: `${item.students.nama} — ${item.students.kelas}` }]
        : []
    )
    form.reset({
      siswa_id: item.siswa_id,
      semester_id: item.semester_id,
      tipe: item.tipe,
      catatan: item.catatan,
      tanggal: item.tanggal ? parseISO(item.tanggal) : null,
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
    mutationFn: (values: CatatanFormValues) => {
      if (!profile?.id) throw new Error('Sesi pengguna tidak valid')
      if (!(values.semester_id ?? activeSemester?.id)) throw new Error('Semester aktif tidak ditemukan')
      return createCatatanKelakuan({
        siswa_id: values.siswa_id,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
        tipe: values.tipe,
        catatan: values.catatan,
        tanggal: values.tanggal ? format(values.tanggal, 'yyyy-MM-dd') : null,
        dicatat_oleh: profile.id,
      })
    },
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) await logAudit(userId, 'CREATE', 'catatan_kelakuan', result.id, null, { id: result.id })
      invalidate()
      toast({ title: 'Catatan kelakuan berhasil ditambahkan' })
      closeDialog()
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menyimpan data', description: e.message, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CatatanFormValues }) =>
      updateCatatanKelakuan(id, {
        tipe: values.tipe,
        catatan: values.catatan,
        tanggal: values.tanggal ? format(values.tanggal, 'yyyy-MM-dd') : null,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) await logAudit(userId, 'UPDATE', 'catatan_kelakuan', result.id, null, { id: result.id })
      invalidate()
      toast({ title: 'Catatan kelakuan berhasil diperbarui' })
      closeDialog()
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal memperbarui data', description: e.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteCatatanKelakuan(ids),
    onSuccess: async (_, ids) => {
      const userId = getUserId()
      if (userId) {
        for (const id of ids) {
          await logAudit(userId, 'DELETE', 'catatan_kelakuan', id, { id }, null)
        }
      }
      invalidate()
      toast({ title: 'Catatan kelakuan berhasil dihapus' })
      setIsDeleteOpen(false)
      setIsBulkDeleteOpen(false)
      setDeletingItem(null)
      setSelectedRows([])
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menghapus data', description: e.message, variant: 'destructive' }),
  })

  const bulkCreateMutation = useMutation({
    mutationFn: (payload: any[]) => bulkCreateCatatanKelakuan(payload),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const r of results) {
          await logAudit(userId, 'CREATE', 'catatan_kelakuan', r.id, null, { id: r.id })
        }
      }
      invalidate()
      toast({ title: 'Catatan kelakuan massal berhasil disimpan' })
      setIsAddOpen(false)
      setBulkKelas('')
      setBulkData({})
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menyimpan catatan massal', description: e.message, variant: 'destructive' }),
  })

  // ─── Columns ────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<CatatanKelakuanEntry>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
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
        accessorKey: 'tipe',
        header: 'Tipe',
        cell: ({ row }) => (
          <Badge variant={row.original.tipe === 'Baik' ? 'success' : 'destructive'}>
            {row.original.tipe}
          </Badge>
        ),
      },
      {
        accessorKey: 'catatan',
        header: 'Catatan',
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[280px] text-sm">{row.original.catatan}</span>
        ),
      },
      {
        id: 'tanggal',
        header: 'Tanggal',
        cell: ({ row }) => formatTanggal(row.original.tanggal),
      },
      {
        id: 'dicatat_oleh',
        header: 'Dicatat Oleh',
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

  const onSubmit = (values: CatatanFormValues) => {
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

  const { data: kelasList = [] } = useQuery({
    queryKey: ['kelas-options', activeUnit],
    queryFn: () => getKelasOptions(activeUnit),
  })

  // Reset filter kelas jika tidak valid saat unit berubah
  useEffect(() => {
    if (filterKelas !== 'all' && kelasList.length > 0 && !kelasList.some((k) => k.id === filterKelas)) {
      setFilterKelas('all')
    }
  }, [activeUnit, kelasList?.length, filterKelas])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Tabs
        value={activeUnit}
        onValueChange={(v) => {
          setActiveUnit(v as Unit)
          setPage(1)
          setSelectedRows([])
          setFilterKelas('all')
        }}
      >
        <TabsList className="no-print">
          {UNITS.map((u) => <TabsTrigger key={u} value={u}>{u}</TabsTrigger>)}
        </TabsList>
      </Tabs>

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
          <SelectTrigger className="w-32"><SelectValue placeholder="Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {kelasList.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSemester} onValueChange={(v) => { setFilterSemester(v); setPage(1) }}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktif">Semester Aktif</SelectItem>
            <SelectItem value="all">Semua Semester</SelectItem>
            {semesterList.map((s) => (
              <SelectItem key={s.id} value={s.id || ""}>
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
          <Button
            size="sm"
            onClick={() => {
              setBulkKelas('')
              setBulkTanggal(new Date())
              setBulkData({})
              setIsAddOpen(true)
            }}
          >
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

      {/* Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Catatan Kelakuan</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Siswa</Label>
              <Combobox
                options={siswaOptions}
                value={form.watch('siswa_id')}
                onSelect={(v) => form.setValue('siswa_id', v)}
                onSearch={setSiswaSearch}
                placeholder="Cari nama siswa..."
                emptyMessage="Siswa tidak ditemukan"
                disabled
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipe</Label>
                <Select
                  value={form.watch('tipe')}
                  onValueChange={(v) => form.setValue('tipe', v as 'Baik' | 'Kurang Baik')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPE_CATATAN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tanggal</Label>
                <DatePicker
                  value={form.watch('tanggal') ?? undefined}
                  onChange={(d) => form.setValue('tanggal', d ?? null)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Catatan</Label>
              <Textarea
                {...form.register('catatan')}
                placeholder="Tuliskan catatan kelakuan siswa secara detail..."
                rows={4}
              />
              {form.formState.errors.catatan && (
                <p className="text-xs text-destructive">{form.formState.errors.catatan.message}</p>
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

      {/* Bulk Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(o) => { if (!o) setIsAddOpen(false) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Input Catatan Kelakuan Massal</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!bulkKelas) {
                toast({ title: 'Pilih kelas terlebih dahulu', variant: 'destructive' })
                return
              }
              const payload = Object.entries(bulkData)
                .filter(([_, item]) => item.catatan.trim() !== '')
                .map(([siswaId, item]) => ({
                  siswa_id: siswaId,
                  semester_id: activeSemester?.id ?? null,
                  tipe: item.tipe,
                  catatan: item.catatan.trim(),
                  tanggal: bulkTanggal ? format(bulkTanggal, 'yyyy-MM-dd') : null,
                  dicatat_oleh: profile?.id ?? null,
                }))

              if (payload.length === 0) {
                toast({ title: 'Input catatan kelakuan minimal untuk 1 siswa', variant: 'destructive' })
                return
              }
              bulkCreateMutation.mutate(payload)
            }}
            className="space-y-4"
          >
            {/* Meta Data */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Kelas</Label>
                <Select value={bulkKelas} onValueChange={setBulkKelas}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                  <SelectContent>
                    {kelasList.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Tanggal</Label>
                <DatePicker value={bulkTanggal} onChange={(d) => setBulkTanggal(d ?? new Date())} />
              </div>

              <div className="space-y-1">
                <Label>Semester</Label>
                <Input value={activeSemester ? `Smt ${activeSemester.nomor_semester} — ${activeSemester.tahun_pelajaran?.nama}` : 'Tidak Aktif'} disabled />
              </div>
            </div>

            {/* Student List */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="bg-[var(--bg-secondary)] px-4 py-2 border-b border-[var(--border)] font-semibold text-sm">
                Daftar Catatan Kelakuan Siswa
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto space-y-4">
                {!bulkKelas ? (
                  <p className="text-center text-sm text-[var(--text-secondary)] py-8">
                    Silakan pilih kelas terlebih dahulu untuk memuat daftar siswa.
                  </p>
                ) : siswaLoading ? (
                  <p className="text-center text-sm text-[var(--text-secondary)] py-8">
                    Memuat data siswa...
                  </p>
                ) : siswaPerKelas.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-secondary)] py-8">
                    Tidak ada siswa aktif di kelas ini.
                  </p>
                ) : (
                  <div className="space-y-4 divide-y divide-[var(--border)]">
                    {siswaPerKelas.map((siswa, idx) => (
                      <div key={siswa.id} className="pt-4 first:pt-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {idx + 1}. {siswa.nama}
                          </span>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-[var(--text-secondary)]">Tipe Catatan:</Label>
                            <Select
                              value={bulkData[siswa.id]?.tipe ?? 'Baik'}
                              onValueChange={(v) => {
                                setBulkData((prev) => ({
                                  ...prev,
                                  [siswa.id]: {
                                    ...prev[siswa.id],
                                    tipe: v as 'Baik' | 'Kurang Baik',
                                  },
                                }))
                              }}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIPE_CATATAN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Textarea
                          placeholder="Masukkan catatan kelakuan (kosongkan jika tidak ada catatan untuk siswa ini)..."
                          value={bulkData[siswa.id]?.catatan ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setBulkData((prev) => ({
                              ...prev,
                              [siswa.id]: {
                                ...prev[siswa.id],
                                catatan: val,
                              },
                            }))
                          }}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
              <Button type="submit" disabled={bulkCreateMutation.isPending}>
                {bulkCreateMutation.isPending ? 'Menyimpan...' : 'Simpan Catatan Massal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Catatan Kelakuan"
        description="Catatan ini akan dihapus permanen. Lanjutkan?"
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
        title="Hapus Catatan Terpilih"
        description={`${selectedRows.length} catatan kelakuan akan dihapus permanen. Lanjutkan?`}
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
