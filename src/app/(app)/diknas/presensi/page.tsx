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
import { GuruMapelGate } from '../_components/guru-mapel-gate'

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
  nama_kelas: string
  status: string
  keterangan: string | null
}

// ─── Halaman ──────────────────────────────────────────────────────────────────

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day || 1)
}

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

  // Sorting states
  const [sortField, setSortField] = useState<string>('tanggal')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Date filter state
  const [filterTanggal, setFilterTanggal] = useState<Date | undefined>(undefined)

  // Mode massal
  const [inputMode, setInputMode] = useState<'tabel' | 'massal'>('tabel')
  const [bulkTanggal, setBulkTanggal] = useState<Date>(new Date())
  const [bulkBulan, setBulkBulan] = useState('')
  const [bulkKelas, setBulkKelas] = useState('')
  const [bulkMapel, setBulkMapel] = useState('')
  const [bulkItems, setBulkItems] = useState<BulkPresensiItem[]>([])
  const [lastSemesterId, setLastSemesterId] = useState<string>('')

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

  const { data: mapelList = [] } = useQuery({
    queryKey: ['mapel-list', activeUnit],
    queryFn: () => getMataKuliah(activeUnit),
  })

  // ─── Guru Mapel Lock (pakai mapel valid dari server, bukan raw profile.mapel_ids) ─
  const isSingleMapel = useMemo(() => {
    return profile?.role === 'user' && mapelList.length === 1
  }, [profile, mapelList])

  const singleMapelId = useMemo(() => {
    return isSingleMapel ? mapelList[0]?.id ?? null : null
  }, [isSingleMapel, mapelList])

  // Form
  const form = useForm<PresensiFormValues>({
    resolver: zodResolver(presensiSchema),
    defaultValues: {
      siswa_id: '',
      mata_pelajaran_id: singleMapelId ?? '',
      semester_id: null,
      tanggal: new Date(),
      status: 'Hadir',
      keterangan: null,
    },
  })

  // Sync mapel lock
  useEffect(() => {
    if (singleMapelId) {
      setFilterMapel(singleMapelId)
      setBulkMapel(singleMapelId)
      form.setValue('mata_pelajaran_id', singleMapelId)
    }
  }, [singleMapelId, form])

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester-diknas'],
    queryFn: getActiveSemesterDiknas,
  })

  // Bulan dinamis
  const monthOptions = useMemo(() => {
    if (!activeSemester?.tanggal_mulai || !activeSemester?.tanggal_selesai) return []
    const start = parseLocalDate(activeSemester.tanggal_mulai)
    const end = parseLocalDate(activeSemester.tanggal_selesai)
    const months: { value: string; label: string; minDate: Date; maxDate: Date }[] = []
    
    const monthNamesIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    let current = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)

    while (current <= last) {
      const m = current.getMonth()
      const y = current.getFullYear()
      
      const firstDayOfMonth = new Date(y, m, 1)
      const lastDayOfMonth = new Date(y, m + 1, 0)
      
      const minDate = firstDayOfMonth < start ? start : firstDayOfMonth
      const maxDate = lastDayOfMonth > end ? end : lastDayOfMonth

      months.push({
        value: `${y}-${String(m + 1).padStart(2, '0')}`,
        label: `${monthNamesIndo[m]} - ${y}`,
        minDate,
        maxDate,
      })
      current.setMonth(current.getMonth() + 1)
    }
    return months
  }, [activeSemester])

  const selectedMonthOpt = useMemo(() => {
    return monthOptions.find((m) => m.value === bulkBulan)
  }, [monthOptions, bulkBulan])

  const bulkMonthRange = useMemo(() => {
    if (!bulkBulan) return null
    const [yearStr, monthStr] = bulkBulan.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    if (isNaN(year) || isNaN(month)) return null
    return {
      minDate: new Date(year, month - 1, 1, 0, 0, 0),
      maxDate: new Date(year, month, 0, 23, 59, 59, 999),
    }
  }, [bulkBulan])

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
      mapelId: filterMapel !== 'all' ? filterMapel : undefined,
      semesterId: resolvedSemesterId,
      search: debouncedSearch || undefined,
      tanggal: filterTanggal ? format(filterTanggal, 'yyyy-MM-dd') : undefined,
      page,
      pageSize,
      sortField,
      sortDirection,
    }),
    [activeUnit, filterKelas, filterMapel, resolvedSemesterId, debouncedSearch, filterTanggal, page, pageSize, sortField, sortDirection]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['presensi', queryFilters],
    queryFn: () => getPresensi(queryFilters),
  })

  // Siswa untuk bulk input — kini menggunakan kelas_id (UUID)
  const { data: siswaPerKelas = [], isLoading: siswaLoading } = useQuery({
    queryKey: ['siswa-kelas', bulkKelas, activeUnit],
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
        nama_kelas: (Array.isArray(r.kelas) ? r.kelas[0]?.nama_kelas : r.kelas?.nama_kelas) ?? '-',
      }))
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
          nama_kelas: s.nama_kelas,
          status: 'Hadir',
          keterangan: null,
        }))
      )
    } else if (bulkItems.length > 0) {
      setBulkItems([])
    }
  }, [siswaPerKelas])

  // Inisialisasi default bulkBulan dan bulkTanggal berdasarkan rentang semester aktif
  useEffect(() => {
    if (activeSemester?.tanggal_mulai && activeSemester?.tanggal_selesai && activeSemester.id !== lastSemesterId && monthOptions.length > 0) {
      const today = new Date()
      // Zero out time parts to prevent hour-level mismatches
      const compareToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const start = parseLocalDate(activeSemester.tanggal_mulai)
      const end = parseLocalDate(activeSemester.tanggal_selesai)

      if (compareToday >= start && compareToday <= end) {
        const currentMonthVal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
        const exists = monthOptions.some((m) => m.value === currentMonthVal)
        if (exists) {
          setBulkBulan(currentMonthVal)
          setBulkTanggal(today)
        } else {
          setBulkBulan(monthOptions[0].value)
          const [yearStr, monthStr] = monthOptions[0].value.split('-')
          setBulkTanggal(new Date(Number(yearStr), Number(monthStr) - 1, 1))
        }
      } else {
        setBulkBulan(monthOptions[0].value)
        const [yearStr, monthStr] = monthOptions[0].value.split('-')
        setBulkTanggal(new Date(Number(yearStr), Number(monthStr) - 1, 1))
      }
      setLastSemesterId(activeSemester.id)
    }
  }, [activeSemester, monthOptions, lastSemesterId])

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
          keterangan: item.keterangan || null,
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
      setInputMode('tabel')
      setBulkItems([])
      setBulkKelas('')
      setBulkBulan('')
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
        cell: ({ row }) => {
          const ket = row.original.keterangan
          return (ket && ket.trim() !== '') ? ket : '-'
        },
      },
      {
        id: 'dicatat_oleh',
        header: 'Dikurasi Oleh',
        cell: ({ row }) => row.original.profiles?.nama_lengkap ?? '-',
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

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field)
    setSortDirection(direction)
    setPage(1)
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
    if (bulkKelas && kelasList.length > 0 && !kelasList.some((k) => k.id === bulkKelas)) {
      setBulkKelas('')
      setBulkItems([])
    }
  }, [activeUnit, kelasList, bulkKelas])

  useEffect(() => {
    if (filterKelas !== 'all' && kelasList.length > 0 && !kelasList.some((k) => k.id === filterKelas)) {
      setFilterKelas('all')
    }
  }, [activeUnit, kelasList, filterKelas])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <GuruMapelGate>
    <div className="space-y-4">
      {/* Unit Tabs */}
      <Tabs
        value={activeUnit}
        onValueChange={(v) => {
          setActiveUnit(v as Unit)
          setPage(1)
          setSelectedRows([])
          setFilterKelas('all')
          setFilterMapel(isSingleMapel ? (singleMapelId ?? 'all') : 'all')
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

      {/* ─── Mode Massal ─── */}
      {inputMode === 'massal' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">Input Presensi Massal</h3>
            <Button variant="outline" size="sm" onClick={() => setInputMode('tabel')}>
              Kembali ke Tabel
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <Label>Bulan</Label>
              <Select value={bulkBulan} onValueChange={(v) => {
                setBulkBulan(v)
                const [yearStr, monthStr] = v.split('-')
                if (yearStr && monthStr) {
                  setBulkTanggal(new Date(Number(yearStr), Number(monthStr) - 1, 1))
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bulan" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tanggal</Label>
              <DatePicker
                key={bulkBulan || 'none'}
                value={bulkTanggal}
                onChange={(d) => d && setBulkTanggal(d)}
                minDate={bulkMonthRange?.minDate}
                maxDate={bulkMonthRange?.maxDate}
                disabled={!bulkBulan}
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
                    <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Mata Pelajaran</Label>
              <Select value={bulkMapel} onValueChange={setBulkMapel} disabled={isSingleMapel}>
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
          ) : !bulkBulan ? (
            <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
              Pilih bulan terlebih dahulu
            </div>
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
                      <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)] flex items-center gap-4">
                        <span>Status</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBulkItems((prev) =>
                              prev.map((item) => ({ ...item, status: 'Hadir' }))
                            )
                          }}
                          className="h-6 px-2 text-[10px]"
                        >
                          Hadir Semua
                        </Button>
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkItems.map((item, idx) => (
                      <tr key={item.siswa_id} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-4 py-2 text-[var(--text-primary)]">{item.nama}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{item.nama_kelas}</td>
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
                        <td className="px-4 py-2">
                          <Input
                            placeholder="Keterangan..."
                            value={item.keterangan ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              setBulkItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, keterangan: val || null } : x))
                              )
                            }}
                            className="h-8 w-60"
                          />
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
                  <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMapel} onValueChange={(v) => { setFilterMapel(v); setPage(1) }} disabled={isSingleMapel}>
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
            <div className="flex items-center gap-1">
              <DatePicker
                value={filterTanggal}
                onChange={(d) => { setFilterTanggal(d); setPage(1) }}
                placeholder="Semua Tanggal"
              />
              {filterTanggal && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  onClick={() => { setFilterTanggal(undefined); setPage(1) }}
                >
                  Clear
                </Button>
              )}
            </div>
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
              <Button size="sm" onClick={() => setInputMode('massal')}>
                <Plus className="mr-2 h-4 w-4" />
                Input Presensi Massal
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
              onSortChange={handleSortChange}
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
                disabled={isSingleMapel}
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
    </GuruMapelGate>
  )
}
