'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import {
  CalendarDays,
  Edit,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  bulkCreatePresensi,
  createPresensi,
  deletePresensi,
  getActiveSemesterDiknas,
  getKelasOptions,
  getMataKuliah,
  getPresensi,
  getSemesterOptions,
  PRESENSI_STATUS_OPTIONS,
  updatePresensi,
  type MataKuliah,
  type PresensiEntry,
} from '@/lib/queries/diknas'
import type { Unit } from '@/lib/supabase/types'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const presensiSchema = z.object({
  siswa_id: z.string().min(1, 'Pilih siswa'),
  mata_pelajaran_id: z.string().min(1, 'Pilih mata pelajaran'),
  semester_id: z.string().nullable(),
  tanggal: z.date({ message: 'Tanggal wajib diisi' }),
  status: z.string().min(1, 'Pilih status'),
  keterangan: z.string().nullable(),
})

type PresensiFormValues = z.infer<typeof presensiSchema>

// ─── Tipe tambahan ────────────────────────────────────────────────────────────

interface BulkPresensiItem {
  siswa_id: string
  nama: string
  kelas: string
  status: string
}

// ─── Halaman ──────────────────────────────────────────────────────────────────

export default function PresensiPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  // State filter & pagination
  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [filterKelas, setFilterKelas] = useState('all')
  const [filterMapel, setFilterMapel] = useState('all')
  const [filterSemester, setFilterSemester] = useState('aktif')
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  // Mode massal
  const [inputMode, setInputMode] = useState<'tabel' | 'massal'>('tabel')
  const [bulkTanggal, setBulkTanggal] = useState<Date>(new Date())
  const [bulkKelas, setBulkKelas] = useState('')
  const [bulkMapel, setBulkMapel] = useState('')
  const [bulkItems, setBulkItems] = useState<BulkPresensiItem[]>([])

  // Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PresensiEntry | null>(null)
  const [deletingItem, setDeletingItem] = useState<PresensiEntry | null>(null)

  // Siswa search untuk form
  const [siswaSearch, setSiswaSearch] = useState('')

  const debouncedSearch = useDebounce(search, 300)
  const debouncedSiswaSearch = useDebounce(siswaSearch, 300)

  // Form
  const form = useForm<PresensiFormValues>({
    resolver: zodResolver(presensiSchema),
    defaultValues: {
      siswa_id: '',
      mata_pelajaran_id: '',
      semester_id: null,
      tanggal: new Date(),
      status: 'Hadir',
      keterangan: null,
    },
  })

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
    queryKey: ['presensi', queryFilters],
    queryFn: () => getPresensi(queryFilters),
  })

  // Siswa untuk bulk input
  const { data: siswaPerKelas = [], isLoading: siswaLoading } = useQuery({
    queryKey: ['siswa-kelas', bulkKelas, activeUnit],
    queryFn: async () => {
      if (!bulkKelas) return []
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: rows, error } = await supabase
        .from('students')
        .select('id, nama, kelas')
        .eq('kelas', bulkKelas)
        .eq('unit', activeUnit)
        .eq('is_alumni', false)
        .order('nama')
      if (error) throw new Error(error.message)
      return rows as { id: string; nama: string; kelas: string }[]
    },
    enabled: inputMode === 'massal' && Boolean(bulkKelas),
  })

  // Update bulk items saat siswa per kelas berubah
  useEffect(() => {
    if (siswaPerKelas.length > 0) {
      setBulkItems(
        siswaPerKelas.map((s) => ({
          siswa_id: s.id,
          nama: s.nama,
          kelas: s.kelas,
          status: 'Hadir',
        }))
      )
    } else if (bulkItems.length > 0) {
      setBulkItems([])
    }
  }, [siswaPerKelas, bulkItems.length])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getUserId = () => profile?.id ?? null
  const dicatatOleh = profile?.id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['presensi'] })
    queryClient.invalidateQueries({ queryKey: ['diknas-dashboard-stats'] })
  }, [queryClient])

  function formatTanggal(t: string) {
    try {
      return format(parseISO(t), 'dd/MM/yyyy')
    } catch {
      return t
    }
  }

  function getStatusVariant(status: string) {
    if (status === 'Hadir') return 'success'
    if (status === 'Alpha') return 'destructive'
    if (['Izin', 'Sakit'].includes(status)) return 'warning'
    return 'secondary'
  }

  const closeDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    form.reset()
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (values: PresensiFormValues) => {
      if (!profile?.id) throw new Error('Sesi pengguna tidak valid')
      if (!(values.semester_id ?? activeSemester?.id)) throw new Error('Semester aktif tidak ditemukan')
      return createPresensi({
        siswa_id: values.siswa_id,
        mata_pelajaran_id: values.mata_pelajaran_id,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
        tanggal: format(values.tanggal, 'yyyy-MM-dd'),
        status: values.status,
        keterangan: values.keterangan,
        dicatat_oleh: profile.id,
      })
    },
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'presensi', result.id, null, {
          id: result.id,
          siswa_id: result.siswa_id,
          tanggal: result.tanggal,
          status: result.status,
        })
      }
      invalidate()
      toast({ title: 'Presensi berhasil ditambahkan' })
      closeDialog()
    },
    onError: (error: Error) =>
      toast({ title: 'Gagal menyimpan data', description: error.message, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: PresensiFormValues }) =>
      updatePresensi(id, {
        tanggal: format(values.tanggal, 'yyyy-MM-dd'),
        status: values.status,
        keterangan: values.keterangan,
        mata_pelajaran_id: values.mata_pelajaran_id,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'UPDATE', 'presensi', result.id, null, {
          id: result.id,
          status: result.status,
        })
      }
      invalidate()
      toast({ title: 'Presensi berhasil diperbarui' })
      closeDialog()
    },
    onError: (error: Error) =>
      toast({ title: 'Gagal memperbarui data', description: error.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deletePresensi(ids),
    onSuccess: async (_, ids) => {
      const userId = getUserId()
      if (userId) {
        for (const id of ids) {
          await logAudit(userId, 'DELETE', 'presensi', id, { id }, null)
        }
      }
      invalidate()
      toast({ title: 'Presensi berhasil dihapus' })
      setIsDeleteOpen(false)
      setIsBulkDeleteOpen(false)
      setDeletingItem(null)
      setSelectedRows([])
    },
    onError: (error: Error) =>
      toast({ title: 'Gagal menghapus data', description: error.message, variant: 'destructive' }),
  })

  const bulkCreateMutation = useMutation({
    mutationFn: () => {
      if (!profile?.id) throw new Error('Sesi pengguna tidak valid')
      if (!activeSemester?.id) throw new Error('Semester aktif tidak ditemukan')
      return bulkCreatePresensi(
        bulkItems.map((item) => ({
          siswa_id: item.siswa_id,
          mata_pelajaran_id: bulkMapel,
          semester_id: activeSemester.id,
          tanggal: format(bulkTanggal, 'yyyy-MM-dd'),
          status: item.status,
          dicatat_oleh: profile.id,
        }))
      )
    },
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const r of results) {
          await logAudit(userId, 'CREATE', 'presensi', r.id, null, {
            id: r.id,
            tanggal: r.tanggal,
            status: r.status,
          })
        }
      }
      invalidate()
      toast({
        title: 'Presensi massal berhasil disimpan',
        description: `${results.length} data presensi berhasil dicatat`,
      })
    },
    onError: (error: Error) =>
      toast({ title: 'Gagal menyimpan presensi massal', description: error.message, variant: 'destructive' }),
  })

  // ─── Columns ────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<PresensiEntry>[]>(
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
        accessorKey: 'tanggal',
        header: 'Tanggal',
        cell: ({ row }) => formatTanggal(row.original.tanggal),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={getStatusVariant(row.original.status) as 'success' | 'destructive' | 'warning' | 'secondary'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'keterangan',
        header: 'Keterangan',
        cell: ({ row }) => row.original.keterangan ?? '-',
      },
      {
        id: 'aksi',
        header: 'Aksi',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => {
                setEditingItem(row.original)
                form.reset({
                  siswa_id: row.original.siswa_id,
                  mata_pelajaran_id: row.original.mata_pelajaran_id,
                  semester_id: row.original.semester_id,
                  tanggal: parseISO(row.original.tanggal),
                  status: row.original.status,
                  keterangan: row.original.keterangan,
                })
                setIsEditOpen(true)
              }}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
              onClick={() => {
                setDeletingItem(row.original)
                setIsDeleteOpen(true)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize, form]
  )

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleBulkSave = () => {
    if (!profile?.id) {
      toast({ title: 'Sesi pengguna tidak valid', variant: 'destructive' })
      return
    }
    if (!activeSemester?.id) {
      toast({ title: 'Semester aktif tidak ditemukan', variant: 'destructive' })
      return
    }
    bulkCreateMutation.mutate()
  }

  const onSubmit = (values: PresensiFormValues) => {
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

  const isFormOpen = isAddOpen || isEditOpen
  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending

  // ─── Kelas list helper dinamis ───
  const { data: kelasList = [] } = useQuery({
    queryKey: ['kelas-options', activeUnit],
    queryFn: () => getKelasOptions(activeUnit),
  })

  // Reset filter/bulk kelas jika tidak valid saat unit berubah
  useEffect(() => {
    if (bulkKelas && kelasList.length > 0 && !kelasList.includes(bulkKelas)) {
      setBulkKelas('')
      setBulkItems([])
    }
  }, [activeUnit, kelasList, bulkKelas])

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
          {UNITS.map((u) => (
            <TabsTrigger key={u} value={u}>
              {u}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Mode Toggle */}
      <div className="no-print flex items-center gap-3">
        <Button
          variant={inputMode === 'tabel' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInputMode('tabel')}
        >
          Per Siswa
        </Button>
        <Button
          variant={inputMode === 'massal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setInputMode('massal')}
        >
          <Users className="mr-2 h-4 w-4" />
          Input Massal
        </Button>
      </div>

      {/* ─── Mode Massal ─── */}
      {inputMode === 'massal' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Input Presensi Massal</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Tanggal</Label>
              <DatePicker
                value={bulkTanggal}
                onChange={(d) => d && setBulkTanggal(d)}
              />
            </div>
            <div className="space-y-1">
              <Label>Kelas</Label>
              <Select value={bulkKelas} onValueChange={(v) => { setBulkKelas(v); setBulkItems([]) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {kelasList.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Mata Pelajaran</Label>
              <Select value={bulkMapel} onValueChange={setBulkMapel}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih mapel" />
                </SelectTrigger>
                <SelectContent>
                  {mapelList.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {siswaLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : bulkItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
              {bulkKelas ? 'Tidak ada siswa di kelas ini' : 'Pilih kelas terlebih dahulu'}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="overflow-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                      <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Nama</th>
                      <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Kelas</th>
                      <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkItems.map((item, idx) => (
                      <tr key={item.siswa_id} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-4 py-2 text-[var(--text-primary)]">{item.nama}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{item.kelas}</td>
                        <td className="px-4 py-2">
                          <Select
                            value={item.status}
                            onValueChange={(v) => {
                              setBulkItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, status: v } : x))
                              )
                            }}
                          >
                            <SelectTrigger className="h-8 w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRESENSI_STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleBulkSave}
                  disabled={bulkCreateMutation.isPending || !bulkMapel || !bulkKelas}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {bulkCreateMutation.isPending ? 'Menyimpan...' : 'Simpan Semua'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Mode Tabel ─── */}
      {inputMode === 'tabel' && (
        <>
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
                {kelasList.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMapel} onValueChange={(v) => { setFilterMapel(v); setPage(1) }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Mapel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Mapel</SelectItem>
                {mapelList.map((m: MataKuliah) => (
                  <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSemester} onValueChange={(v) => { setFilterSemester(v); setPage(1) }}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Semester" />
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
              {selectedRows.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteOpen(true)}
                >
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
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
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
        </>
      )}

      {/* ─── Form Dialog ─── */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditOpen ? 'Edit Presensi' : 'Tambah Presensi'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tanggal */}
            <div className="space-y-1">
              <Label>Tanggal</Label>
              <DatePicker
                value={form.watch('tanggal')}
                onChange={(d) => d && form.setValue('tanggal', d)}
              />
              {form.formState.errors.tanggal && (
                <p className="text-xs text-destructive">{form.formState.errors.tanggal.message}</p>
              )}
            </div>

            {/* Mapel */}
            <div className="space-y-1">
              <Label>Mata Pelajaran</Label>
              <Select
                value={form.watch('mata_pelajaran_id')}
                onValueChange={(v) => form.setValue('mata_pelajaran_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih mata pelajaran" />
                </SelectTrigger>
                <SelectContent>
                  {mapelList.map((m: MataKuliah) => (
                    <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.mata_pelajaran_id && (
                <p className="text-xs text-destructive">{form.formState.errors.mata_pelajaran_id.message}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESENSI_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Keterangan */}
            <div className="space-y-1">
              <Label>Keterangan (opsional)</Label>
              <Input
                value={form.watch('keterangan') ?? ''}
                onChange={(e) => form.setValue('keterangan', e.target.value || null)}
                placeholder="Catatan tambahan..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Batal
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Confirm Delete ─── */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Presensi"
        description="Data presensi ini akan dihapus permanen. Lanjutkan?"
        onConfirm={() => deletingItem && deleteMutation.mutate([deletingItem.id])}
        isLoading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        title="Hapus Presensi Terpilih"
        description={`${selectedRows.length} data presensi akan dihapus permanen. Lanjutkan?`}
        onConfirm={() => deleteMutation.mutate(selectedRows)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
