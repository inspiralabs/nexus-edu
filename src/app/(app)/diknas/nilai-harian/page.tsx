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
import { Checkbox } from '@/components/ui/checkbox'
import { logAudit } from '@/lib/audit/log'
import {
  approveNilaiHarian,
  bulkCreateNilaiHarian,
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
  getBankSoalForAutoFill,
  getBankSoalOptions,
  type MataKuliah,
  type NilaiHarianEntry,
} from '@/lib/queries/diknas'
import { getTipeNilai } from '@/lib/queries/tipe-nilai'
import { searchStudents } from '@/lib/queries/students'
import type { Unit } from '@/lib/supabase/types'
import { GuruMapelGate } from '../_components/guru-mapel-gate'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const nilaiHarianSchema = z.object({
  siswa_id: z.string().min(1, 'Pilih siswa'),
  mata_pelajaran_id: z.string().min(1, 'Pilih mata pelajaran'),
  semester_id: z.string().nullable(),
  tipe_nilai: z.enum(['Formatif', 'Sumatif']),
  tipe_nilai_id: z.string().nullable(),
  nama_tugas: z.string().min(1, 'Nama tugas wajib diisi'),
  materi: z.string().nullable(),
  bab: z.string().nullable(),
  nilai_asli: z.number().min(0).max(100).nullable(),
  bank_soal_id: z.string().nullable(),
  tipe_soal: z.string().nullable(),
  tanggal: z.date().nullable(),
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

  // Remedial dialog states
  const [isRemedialOpen, setIsRemedialOpen] = useState(false)
  const [remedialItem, setRemedialItem] = useState<NilaiHarianEntry | null>(null)
  const [remedialNilai, setRemedialNilai] = useState<number | null>(null)
  const [remedialTipe, setRemedialTipe] = useState('')

  // Bulk input states
  const [bulkKelas, setBulkKelas] = useState('')
  const [bulkMapel, setBulkMapel] = useState('')
  const [bulkSemesterId, setBulkSemesterId] = useState('')
  const [bulkTanggal, setBulkTanggal] = useState<Date>(new Date())
  const [bulkTipeNilaiId, setBulkTipeNilaiId] = useState('')
  const [isAutoFilled, setIsAutoFilled] = useState(false)
  const [bulkNamaTugas, setBulkNamaTugas] = useState('')
  const [bulkMateri, setBulkMateri] = useState('')
  const [bulkBabText, setBulkBabText] = useState('')
  const [bulkTipeSoal, setBulkTipeSoal] = useState('')
  const [bulkBankSoal, setBulkBankSoal] = useState('')
  const [bulkScores, setBulkScores] = useState<Record<string, number | null>>({})

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

  const { data: mapelList = [] } = useQuery({
    queryKey: ['mapel-list', activeUnit],
    queryFn: () => getMataKuliah(activeUnit),
  })

  const isSingleMapel = useMemo(() => {
    return profile?.role === 'user' && mapelList.length === 1
  }, [profile, mapelList])

  const singleMapelId = useMemo(() => {
    return isSingleMapel ? mapelList[0]?.id ?? null : null
  }, [isSingleMapel, mapelList])

  const form = useForm<NilaiHarianFormValues>({
    resolver: zodResolver(nilaiHarianSchema),
    defaultValues: {
      siswa_id: '',
      mata_pelajaran_id: singleMapelId ?? '',
      semester_id: null,
      tipe_nilai: 'Formatif',
      tipe_nilai_id: null,
      nama_tugas: '',
      materi: null,
      bab: '',
      nilai_asli: null,
      bank_soal_id: null,
      tipe_soal: null,
      tanggal: new Date(),
    },
  })  // Sync mapel lock
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

  const { data: semesterList = [] } = useQuery({
    queryKey: ['semester-options'],
    queryFn: getSemesterOptions,
  })

  const { data: tipeNilaiList = [] } = useQuery({
    queryKey: ['tipe-nilai-list'],
    queryFn: getTipeNilai,
  })

  useEffect(() => {
    if (activeSemester?.id && !bulkSemesterId) {
      setBulkSemesterId(activeSemester.id)
    }
  }, [activeSemester, bulkSemesterId])

  // Fetch bank soal options for bulk input
  const { data: bulkBankSoalOptions = [] } = useQuery({
    queryKey: ['bank-soal-options-bulk', bulkSemesterId, bulkMapel],
    queryFn: () => getBankSoalOptions(bulkSemesterId, bulkMapel),
    enabled: Boolean(bulkSemesterId && bulkMapel),
  })

  const filteredBulkBankSoals = useMemo(() => {
    return bulkBankSoalOptions.filter((bs) => bs.tipe_nilai?.jenis_nilai !== 'Ujian Akhir Semester')
  }, [bulkBankSoalOptions])

  // Monitor changes to bulkBankSoal state
  useEffect(() => {
    if (bulkBankSoal) {
      const selectedBs = filteredBulkBankSoals.find((b) => b.id === bulkBankSoal)
      if (selectedBs) {
        setBulkNamaTugas(selectedBs.judul)
        setBulkTipeSoal(selectedBs.tipe || '')
        setBulkMateri(selectedBs.materi || '')
        setBulkBabText(selectedBs.bab ? selectedBs.bab.join(', ') : '')
        setBulkTipeNilaiId(selectedBs.tipe_nilai_id || '')
        setIsAutoFilled(true)
      }
    } else {
      setBulkNamaTugas('')
      setBulkTipeSoal('')
      setBulkMateri('')
      setBulkBabText('')
      setBulkTipeNilaiId('')
      setIsAutoFilled(false)
    }
  }, [bulkBankSoal, filteredBulkBankSoals])

  const isFormOpen = isEditOpen
  const editSemesterId = form.watch('semester_id')
  const editMapelId = form.watch('mata_pelajaran_id')

  const { data: editBankSoalOptions = [] } = useQuery({
    queryKey: ['bank-soal-options-edit', editSemesterId, editMapelId],
    queryFn: () => getBankSoalOptions(editSemesterId!, editMapelId!),
    enabled: Boolean(editSemesterId && editMapelId && (isEditOpen || isFormOpen)),
  })

  const filteredEditBankSoals = useMemo(() => {
    return editBankSoalOptions.filter((bs) => bs.tipe_nilai?.jenis_nilai !== 'Ujian Akhir Semester')
  }, [editBankSoalOptions])

  const bankSoalComboboxOptions = useMemo(() => {
    const list = filteredEditBankSoals.map((b) => ({ value: b.id, label: b.judul }))
    if (editingItem?.bank_soal && !list.some(opt => opt.value === editingItem.bank_soal_id)) {
      list.push({ value: editingItem.bank_soal_id!, label: editingItem.bank_soal.judul })
    }
    return list
  }, [filteredEditBankSoals, editingItem])

  const watchedBankSoalId = form.watch('bank_soal_id')
  const [prevBankSoalId, setPrevBankSoalId] = useState<string | null>(null)

  useEffect(() => {
    if (isEditOpen) {
      setPrevBankSoalId(editingItem?.bank_soal_id || null)
    } else {
      setPrevBankSoalId(null)
    }
  }, [isEditOpen, editingItem])

  useEffect(() => {
    if (watchedBankSoalId === prevBankSoalId) return

    if (watchedBankSoalId) {
      const selectedBs = filteredEditBankSoals.find((b) => b.id === watchedBankSoalId)
      if (selectedBs) {
        form.setValue('nama_tugas', selectedBs.judul)
        form.setValue('tipe_soal', selectedBs.tipe || '')
        form.setValue('materi', selectedBs.materi || '')
        form.setValue('bab', selectedBs.bab ? selectedBs.bab.join(', ') : '')
        form.setValue('tipe_nilai_id', selectedBs.tipe_nilai_id || null)
        setPrevBankSoalId(watchedBankSoalId)
      }
    } else {
      form.setValue('nama_tugas', '')
      form.setValue('tipe_soal', '')
      form.setValue('materi', '')
      form.setValue('bab', '')
      form.setValue('tipe_nilai_id', null)
      setPrevBankSoalId(null)
    }
  }, [watchedBankSoalId, prevBankSoalId, filteredEditBankSoals])

  const selectedTipeNilaiObj = useMemo(() => {
    return tipeNilaiList.find((t) => t.id === bulkTipeNilaiId)
  }, [bulkTipeNilaiId, tipeNilaiList])

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

  // Siswa untuk bulk input
  const { data: siswaPerKelas = [], isLoading: siswaLoading } = useQuery({
    queryKey: ['siswa-kelas-nilai', bulkKelas, activeUnit],
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
    enabled: isAddOpen && Boolean(bulkKelas),
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
    enabled: isFormOpen || isAddOpen,
  })

  useQuery({
    queryKey: ['bank-soal-search', debouncedBankSoalSearch],
    queryFn: async () => {
      const results = await searchBankSoal(debouncedBankSoalSearch)
      setBankSoalOptions(results.map((b) => ({ value: b.id, label: b.judul })))
      return results
    },
    enabled: isFormOpen || isAddOpen,
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
    form.reset({
      siswa_id: '',
      mata_pelajaran_id: singleMapelId ?? '',
      semester_id: null,
      tipe_nilai: 'Formatif',
      tipe_nilai_id: null,
      nama_tugas: '',
      materi: null,
      bab: '',
      nilai_asli: null,
      bank_soal_id: null,
      tipe_soal: null,
      tanggal: new Date(),
    })
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
      tipe_nilai_id: item.tipe_nilai_id || null,
      nama_tugas: item.nama_tugas,
      materi: item.materi,
      bab: item.bab ? item.bab.join(', ') : '',
      nilai_asli: item.nilai_asli,
      bank_soal_id: item.bank_soal_id,
      tipe_soal: item.bank_soal?.tipe || null,
      tanggal: item.tanggal ? parseISO(item.tanggal) : new Date(),
    })
    setIsEditOpen(true)
  }
  type NilaiHarianPayload = Omit<NilaiHarianFormValues, 'bab'> & { bab: string[] | null }

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
    mutationFn: (values: NilaiHarianPayload) => {
      if (!profile?.id) throw new Error('Sesi pengguna tidak valid')
      if (!(values.semester_id ?? activeSemester?.id)) throw new Error('Semester aktif tidak ditemukan')
      return createNilaiHarian({
        siswa_id: values.siswa_id,
        mata_pelajaran_id: values.mata_pelajaran_id,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
        tipe_nilai: values.tipe_nilai,
        tipe_nilai_id: values.tipe_nilai_id,
        nama_tugas: values.nama_tugas,
        materi: values.materi,
        bab: values.bab,
        nilai_asli: values.nilai_asli,
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
    mutationFn: ({ id, values }: { id: string; values: NilaiHarianPayload }) =>
      updateNilaiHarian(id, {
        tipe_nilai: values.tipe_nilai,
        tipe_nilai_id: values.tipe_nilai_id,
        nama_tugas: values.nama_tugas,
        materi: values.materi,
        bab: values.bab,
        nilai_asli: values.nilai_asli,
        bank_soal_id: values.bank_soal_id,
        tanggal: values.tanggal ? format(values.tanggal, 'yyyy-MM-dd') : null,
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

  const revertToDraftMutation = useMutation({
    mutationFn: (id: string) =>
      updateNilaiHarian(id, {
        is_approved: false,
        approved_at: null,
        approved_by: null,
      }),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'UPDATE', 'nilai_harian', id, { is_approved: true }, { is_approved: false })
      }
      invalidate()
      toast({ title: 'Status nilai berhasil dikembalikan ke Draft' })
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal mengubah status', description: e.message, variant: 'destructive' }),
  })

  const saveRemedialMutation = useMutation({
    mutationFn: ({ id, nilai_remedial, tipe_remedial }: { id: string; nilai_remedial: number | null; tipe_remedial: string | null }) =>
      updateNilaiHarian(id, {
        nilai_remedial,
        tipe_remedial,
        is_approved: false,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'UPDATE', 'nilai_harian', result.id, null, { id: result.id, nilai_remedial: result.nilai_remedial })
      }
      invalidate()
      toast({ title: 'Data remedial berhasil disimpan' })
      setIsRemedialOpen(false)
      setRemedialItem(null)
      setRemedialNilai(null)
      setRemedialTipe('')
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menyimpan data remedial', description: e.message, variant: 'destructive' }),
  })

  const bulkCreateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof bulkCreateNilaiHarian>[0]) => bulkCreateNilaiHarian(payload),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const r of results) {
          await logAudit(userId, 'CREATE', 'nilai_harian', r.id, null, { id: r.id })
        }
      }
      invalidate()
      toast({ title: 'Nilai harian massal berhasil disimpan' })
      setIsAddOpen(false)
      setBulkKelas('')
      setBulkScores({})
      setBulkNamaTugas('')
      setBulkMateri('')
      setBulkBabText('')
      setBulkTipeSoal('')
      setBulkBankSoal('')
      setBulkTipeNilaiId('')
      setIsAutoFilled(false)
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menyimpan nilai massal', description: e.message, variant: 'destructive' }),
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
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.is_approved ? 'success' : 'warning'}>
            {row.original.is_approved ? 'Published' : 'Draft'}
          </Badge>
        ),
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
        cell: ({ row }) => {
          const isApproved = row.original.is_approved
          return (
            <div className="flex gap-1.5 items-center">
              {isApproved ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => revertToDraftMutation.mutate(row.original.id)}
                >
                  Kembalikan ke Draft
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    onClick={() => openEditDialog(row.original)}
                    title="Edit Nilai"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-primary"
                    onClick={() => {
                      setRemedialItem(row.original)
                      setRemedialNilai(row.original.nilai_remedial)
                      setRemedialTipe(row.original.tipe_remedial ?? '')
                      setIsRemedialOpen(true)
                    }}
                    title="Remedial"
                  >
                    Remedial
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setDeletingItem(row.original)
                      setIsDeleteOpen(true)
                    }}
                    title="Hapus Nilai"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          )
        },
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
    const mappedValues: NilaiHarianPayload = {
      ...values,
      bab: values.bab ? values.bab.split(',').map((s) => s.trim()).filter(Boolean) : null,
    }
    if (isEditOpen && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values: mappedValues })
    } else {
      createMutation.mutate(mappedValues)
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
        <Select value={filterMapel} onValueChange={(v) => { setFilterMapel(v); setPage(1) }} disabled={isSingleMapel}>
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
          <Button
            onClick={() => {
              setBulkKelas('')
              setBulkScores({})
              setBulkNamaTugas('')
              setBulkMateri('')
              setBulkBabText('')
              setBulkTipeSoal('')
              setBulkBankSoal('')
              setBulkTanggal(new Date())
              setBulkTipeNilaiId('')
              setIsAutoFilled(false)
              if (singleMapelId) {
                setBulkMapel(singleMapelId)
              } else {
                setBulkMapel('')
              }
              setIsAddOpen(true)
            }}
          >
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

      {/* ─── Edit Dialog (Single Item) ─── */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Nilai Harian</DialogTitle>
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
                  disabled
                />
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
                  disabled
                />
              </div>
            </div>

            {(() => {
              const isSingleAutoFilled = Boolean(form.watch('bank_soal_id'))
              return (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Tipe Nilai */}
                    <div className="space-y-1">
                      <Label>Tipe Nilai</Label>
                      <Select
                        value={form.watch('tipe_nilai_id') ?? ''}
                        onValueChange={(v) => form.setValue('tipe_nilai_id', v || null)}
                        disabled={isSingleAutoFilled}
                      >
                        <SelectTrigger><SelectValue placeholder="Pilih Tipe Nilai" /></SelectTrigger>
                        <SelectContent>
                          {tipeNilaiList
                            .filter((t) => t.jenis_nilai !== 'Ujian Akhir Semester')
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nama_tipe} ({t.jenis_nilai})
                              </SelectItem>
                            ))}
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

                  {/* Bank Soal Selector */}
                  <div className="space-y-1">
                    <Label>Bank Soal (opsional)</Label>
                    <Select
                      value={form.watch('bank_soal_id') ?? 'none'}
                      onValueChange={(v) => form.setValue('bank_soal_id', v === 'none' ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Pilih Bank Soal..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Input Manual (Tanpa Bank Soal) --</SelectItem>
                        {bankSoalComboboxOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Tipe Soal */}
                    <div className="space-y-1">
                      <Label>Tipe Soal (Pilihan Ganda/Essai)</Label>
                      <Input
                        {...form.register('tipe_soal')}
                        placeholder="Contoh: Pilihan Ganda"
                        disabled={isSingleAutoFilled}
                      />
                    </div>

                    {/* Nama Tugas */}
                    <div className="space-y-1">
                      <Label>Nama Tugas</Label>
                      <Input
                        {...form.register('nama_tugas')}
                        placeholder="Contoh: Ulangan Bab 1, PR Hal. 30-35"
                        disabled={isSingleAutoFilled}
                      />
                      {form.formState.errors.nama_tugas && (
                        <p className="text-xs text-destructive">{form.formState.errors.nama_tugas.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Materi (opsional)</Label>
                      <Input
                        {...form.register('materi')}
                        placeholder="Nama materi/topik"
                        disabled={isSingleAutoFilled}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Bab (opsional, pisahkan dengan koma)</Label>
                      <Input
                        {...form.register('bab')}
                        placeholder="Contoh: BAB 1, BAB 2"
                        disabled={isSingleAutoFilled}
                      />
                    </div>
                  </div>
                </>
              )
            })()}

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

      {/* ─── Bulk Add Dialog (Tambah Massal) ─── */}
      <Dialog open={isAddOpen} onOpenChange={(o) => { if (!o) setIsAddOpen(false) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Input Nilai Harian Massal</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!bulkKelas) {
                toast({ title: 'Pilih kelas terlebih dahulu', variant: 'destructive' })
                return
              }
              if (!bulkMapel) {
                toast({ title: 'Pilih mata pelajaran terlebih dahulu', variant: 'destructive' })
                return
              }
              if (!bulkTipeNilaiId) {
                toast({ title: 'Pilih tipe nilai terlebih dahulu', variant: 'destructive' })
                return
              }
              if (!bulkNamaTugas.trim()) {
                toast({ title: 'Nama tugas wajib diisi', variant: 'destructive' })
                return
              }
              const payload = siswaPerKelas.map((s) => ({
                siswa_id: s.id,
                mata_pelajaran_id: bulkMapel,
                semester_id: bulkSemesterId || activeSemester?.id || null,
                tipe_nilai: (selectedTipeNilaiObj ? (selectedTipeNilaiObj.jenis_nilai === 'Harian' ? 'Formatif' : 'Sumatif') : 'Formatif') as 'Formatif' | 'Sumatif',
                tipe_nilai_id: bulkTipeNilaiId || null,
                nama_tugas: bulkNamaTugas,
                materi: bulkMateri || null,
                bab: bulkBabText ? bulkBabText.split(',').map((b) => b.trim()).filter(Boolean) : null,
                nilai_asli: bulkScores[s.id] !== undefined && bulkScores[s.id] !== null ? bulkScores[s.id] : null,
                dicatat_oleh: profile?.id ?? null,
                tanggal: bulkTanggal ? format(bulkTanggal, 'yyyy-MM-dd') : null,
                bank_soal_id: bulkBankSoal || null,
              }))
              bulkCreateMutation.mutate(payload)
            }}
            className="space-y-4"
          >
            {/* Meta Data Fields */}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
              <div className="space-y-1">
                <Label>Tanggal</Label>
                <DatePicker value={bulkTanggal} onChange={(d) => setBulkTanggal(d ?? new Date())} />
              </div>

              <div className="space-y-1">
                <Label>Semester</Label>
                <Select value={bulkSemesterId} onValueChange={setBulkSemesterId}>
                  <SelectTrigger><SelectValue placeholder="Pilih Semester" /></SelectTrigger>
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
                <Label>Kelas</Label>
                <Select value={bulkKelas} onValueChange={setBulkKelas}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                  <SelectContent>
                    {kelasList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Mata Pelajaran</Label>
                <Select value={bulkMapel} onValueChange={setBulkMapel} disabled={isSingleMapel}>
                  <SelectTrigger><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
                  <SelectContent>
                    {mapelList.map((m: MataKuliah) => <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Judul/Nama Bank Soal</Label>
                <Select
                  value={bulkBankSoal || 'none'}
                  onValueChange={(v) => setBulkBankSoal(v === 'none' ? '' : v)}
                  disabled={!bulkSemesterId || !bulkMapel}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih Bank Soal..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Input Manual (Tanpa Bank Soal) --</SelectItem>
                    {filteredBulkBankSoals.map((bs) => (
                      <SelectItem key={bs.id} value={bs.id}>
                        {bs.judul}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Tipe Nilai</Label>
                <Select
                  value={bulkTipeNilaiId}
                  onValueChange={setBulkTipeNilaiId}
                  disabled={isAutoFilled}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih Tipe Nilai" /></SelectTrigger>
                  <SelectContent>
                    {tipeNilaiList
                      .filter((t) => t.jenis_nilai !== 'Ujian Akhir Semester')
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nama_tipe} ({t.jenis_nilai})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Tipe Soal (Pilihan Ganda/Essai)</Label>
                <Input
                  value={bulkTipeSoal}
                  onChange={(e) => setBulkTipeSoal(e.target.value)}
                  placeholder="Contoh: Pilihan Ganda"
                  disabled={isAutoFilled}
                />
              </div>

              <div className="space-y-1">
                <Label>Nama Tugas</Label>
                <Input
                  value={bulkNamaTugas}
                  onChange={(e) => setBulkNamaTugas(e.target.value)}
                  placeholder="Contoh: Ulangan Bab 1"
                  disabled={isAutoFilled}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Materi (opsional)</Label>
                <Input
                  value={bulkMateri}
                  onChange={(e) => setBulkMateri(e.target.value)}
                  placeholder="Nama materi/topik"
                  disabled={isAutoFilled}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Bab (opsional, pisahkan dengan koma)</Label>
                <Input
                  value={bulkBabText}
                  onChange={(e) => setBulkBabText(e.target.value)}
                  placeholder="Contoh: BAB 1, BAB 2"
                  disabled={isAutoFilled}
                />
              </div>
            </div>

            {/* Student List & Scores */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="bg-[var(--bg-secondary)] px-4 py-2 border-b border-[var(--border)] font-semibold text-sm">
                Daftar Siswa & Input Nilai Asli
              </div>
              <div className="p-4 max-h-[350px] overflow-y-auto space-y-3">
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
                  <div className="divide-y divide-[var(--border)]">
                    {siswaPerKelas.map((siswa, idx) => (
                      <div key={siswa.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <span className="text-sm font-medium">
                          {idx + 1}. {siswa.nama}
                        </span>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-[var(--text-secondary)]">Nilai Asli:</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            placeholder="0-100"
                            value={bulkScores[siswa.id] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : parseFloat(e.target.value)
                              setBulkScores((prev) => ({ ...prev, [siswa.id]: val }))
                            }}
                            className="w-24 text-center h-8 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
              <Button type="submit" disabled={bulkCreateMutation.isPending}>
                {bulkCreateMutation.isPending ? 'Menyimpan...' : 'Simpan Nilai Massal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Remedial Dialog ─── */}
      <Dialog
        open={isRemedialOpen}
        onOpenChange={(o) => {
          if (!o) {
            setIsRemedialOpen(false)
            setRemedialItem(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Input Nilai Remedial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nama Siswa</Label>
              <Input value={remedialItem?.students?.nama ?? ''} disabled />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nilai Asli</Label>
                <Input value={remedialItem?.nilai_asli ?? '-'} disabled />
              </div>
              <div className="space-y-1">
                <Label>Nilai Remedial</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={remedialNilai ?? ''}
                  onChange={(e) => setRemedialNilai(e.target.value === '' ? null : parseFloat(e.target.value))}
                  placeholder="0-100"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tipe Remedial</Label>
              <Input
                value={remedialTipe}
                onChange={(e) => setRemedialTipe(e.target.value)}
                placeholder="Contoh: Tugas Ulang, Tes Lisan"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsRemedialOpen(false); setRemedialItem(null); }}>Batal</Button>
            <Button
              onClick={() => {
                if (remedialItem) {
                  saveRemedialMutation.mutate({
                    id: remedialItem.id,
                    nilai_remedial: remedialNilai,
                    tipe_remedial: remedialTipe || null,
                  })
                }
              }}
              disabled={saveRemedialMutation.isPending}
            >
              {saveRemedialMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Confirm Approve ─── */}
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
    </GuruMapelGate>
  )
}
