'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { Edit, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { Combobox } from '@/components/shared/combobox'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { DatePicker } from '@/components/shared/date-picker'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  createPrestasi,
  deletePrestasi,
  getPrestasi,
  searchBidang,
  searchEvent,
  searchGuru,
  searchJuara,
  searchKategoriPrestasi,
  TINGKAT_KEJUARAAN,
  updatePrestasi,
  type CreatePrestasiInput,
} from '@/lib/queries/prestasi'
import { getStudentClasses, searchStudents } from '@/lib/queries/students'
import { createClient } from '@/lib/supabase/client'
import type {
  AuditAction,
  JenisJuara,
  Juara,
  Prestasi,
  Tempat,
  TingkatKejuaraan,
  Unit,
} from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

type TipePrestasi = 'siswa' | 'guru'

// Schema siswa (sama seperti sebelumnya)
const prestasiSchema = z.object({
  unit: z.enum(['SD', 'SMP', 'SMA']),
  siswa_id: z.string().uuid('Pilih siswa'),
  guru_id: z.string().uuid().optional().nullable(),
  event_id: z.string().uuid('Pilih event'),
  tempat: z.enum(['Offline', 'Online']),
  waktu: z.date({ message: 'Pilih waktu' }),
  juara_id: z.string().uuid('Pilih juara'),
  jenis_juara: z.enum(['Individu', 'Kelompok']),
  bidang_id: z.string().uuid('Pilih bidang'),
  kategori_id: z.string().uuid('Pilih kategori'),
  tingkat_kejuaraan: z.enum(
    [...TINGKAT_KEJUARAAN] as [TingkatKejuaraan, ...TingkatKejuaraan[]]
  ),
})

// Schema guru
const prestasiGuruSchema = z.object({
  unit: z.enum(['SD', 'SMP', 'SMA']),
  siswa_id: z.string().uuid().optional().nullable(),
  guru_id: z.string().uuid('Pilih guru'),
  event_id: z.string().uuid('Pilih event'),
  tempat: z.enum(['Offline', 'Online']),
  waktu: z.date({ message: 'Pilih waktu' }),
  juara_id: z.string().uuid('Pilih juara'),
  jenis_juara: z.enum(['Individu', 'Kelompok']),
  bidang_id: z.string().uuid('Pilih bidang'),
  kategori_id: z.string().uuid('Pilih kategori'),
  tingkat_kejuaraan: z.enum(
    [...TINGKAT_KEJUARAAN] as [TingkatKejuaraan, ...TingkatKejuaraan[]]
  ),
})

type PrestasiFormValues = z.infer<typeof prestasiSchema>
type PrestasiGuruFormValues = z.infer<typeof prestasiGuruSchema>

const bulkPrestasiSchema = z.object({
  event_id: z.string().uuid('Pilih event'),
  tempat: z.enum(['Offline', 'Online']),
  waktu: z.date('Pilih waktu'),
  juara_id: z.string().uuid('Pilih juara'),
  jenis_juara: z.enum(['Individu', 'Kelompok']),
  bidang_id: z.string().uuid('Pilih bidang'),
  kategori_id: z.string().uuid('Pilih kategori'),
  tingkat_kejuaraan: z.enum(
    [...TINGKAT_KEJUARAAN] as [TingkatKejuaraan, ...TingkatKejuaraan[]]
  ),
})

type BulkPrestasiFormValues = z.infer<typeof bulkPrestasiSchema>

interface ComboboxOption {
  value: string
  label: string
}

interface PendingPrestasiQueueItem extends CreatePrestasiInput {
  localId: string
  siswaLabel: string
  kelas: string
  eventLabel: string
  juaraLabel: string
}

function prestasiToRecord(item: Prestasi): Record<string, unknown> {
  return {
    id: item.id,
    unit: item.unit,
    siswa_id: item.siswa_id,
    event_id: item.event_id,
    tempat: item.tempat,
    waktu: item.waktu,
    juara_id: item.juara_id,
    jenis_juara: item.jenis_juara,
    bidang_id: item.bidang_id,
    kategori_id: item.kategori_id,
    tingkat_kejuaraan: item.tingkat_kejuaraan,
    created_at: item.created_at,
  }
}

function formatTanggal(tanggal: string | null): string {
  if (!tanggal) return '-'
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return tanggal
  }
}

const PRESTASI_SELECT = `
  *,
  students(id,nama,kelas_id,kelas(nama_kelas)),
  event(id,nama_event),
  juara(id,nama_juara),
  bidang(id,nama_bidang),
  kategori_prestasi(id,nama_kategori),
  profiles:guru_id(id,nama_lengkap)
`

const ALLOWED_SORT_FIELDS = [
  'unit',
  'waktu',
  'tempat',
  'jenis_juara',
  'tingkat_kejuaraan',
  'created_at',
  'siswa_id',
  'event_id',
  'juara_id',
  'bidang_id',
  'kategori_id',
] as const

type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number]

function resolveSortField(sortField: string): AllowedSortField {
  if (ALLOWED_SORT_FIELDS.includes(sortField as AllowedSortField)) {
    return sortField as AllowedSortField
  }
  return 'waktu'
}

async function fetchJuaraList(): Promise<Juara[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('juara')
    .select('*')
    .order('nama_juara', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Juara[]
}

// Query helper lokal sudah dipindahkan ke getPrestasi backend queries.

type BulkPrestasiUpdateInput = Omit<
  CreatePrestasiInput,
  'unit' | 'siswa_id'
>

async function bulkCreatePrestasi(
  data: CreatePrestasiInput[]
): Promise<Prestasi[]> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('prestasi')
    .insert(data)
    .select(PRESTASI_SELECT)

  if (error) throw new Error(error.message)

  return (result ?? []) as Prestasi[]
}

async function bulkUpdatePrestasiRecords(
  ids: string[],
  payload: BulkPrestasiUpdateInput
): Promise<{ oldItems: Prestasi[]; updatedItems: Prestasi[] }> {
  const supabase = createClient()

  const { data: oldItems, error: fetchError } = await supabase
    .from('prestasi')
    .select(PRESTASI_SELECT)
    .in('id', ids)

  if (fetchError) throw new Error(fetchError.message)

  const { data: updatedItems, error } = await supabase
    .from('prestasi')
    .update(payload)
    .in('id', ids)
    .select(PRESTASI_SELECT)

  if (error) throw new Error(error.message)

  return {
    oldItems: (oldItems ?? []) as Prestasi[],
    updatedItems: (updatedItems ?? []) as Prestasi[],
  }
}

export default function PrestasiDataPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState('waktu')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [activeTipe, setActiveTipe] = useState<TipePrestasi>('siswa')
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all')
  const [selectedJuaraFilter, setSelectedJuaraFilter] = useState<string>('all')
  const [selectedTingkatFilter, setSelectedTingkatFilter] = useState<string>('all')

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false)

  const [prestasiQueue, setPrestasiQueue] = useState<PendingPrestasiQueueItem[]>(
    []
  )

  const [editingItem, setEditingItem] = useState<Prestasi | null>(null)
  const [deletingItem, setDeletingItem] = useState<Prestasi | null>(null)

  const [kelasDisplay, setKelasDisplay] = useState('')

  const [guruSearch, setGuruSearch] = useState('')
  const [guruOptions, setGuruOptions] = useState<ComboboxOption[]>([])

  const [studentSearch, setStudentSearch] = useState('')
  const [eventSearch, setEventSearch] = useState('')
  const [juaraSearch, setJuaraSearch] = useState('')
  const [bidangSearch, setBidangSearch] = useState('')
  const [kategoriSearch, setKategoriSearch] = useState('')

  const [bulkEventSearch, setBulkEventSearch] = useState('')
  const [bulkJuaraSearch, setBulkJuaraSearch] = useState('')
  const [bulkBidangSearch, setBulkBidangSearch] = useState('')
  const [bulkKategoriSearch, setBulkKategoriSearch] = useState('')

  const [studentOptions, setStudentOptions] = useState<ComboboxOption[]>([])
  const [eventOptions, setEventOptions] = useState<ComboboxOption[]>([])
  const [juaraOptions, setJuaraOptions] = useState<ComboboxOption[]>([])
  const [bidangOptions, setBidangOptions] = useState<ComboboxOption[]>([])
  const [kategoriOptions, setKategoriOptions] = useState<ComboboxOption[]>([])

  const [bulkEventOptions, setBulkEventOptions] = useState<ComboboxOption[]>([])
  const [bulkJuaraOptions, setBulkJuaraOptions] = useState<ComboboxOption[]>([])
  const [bulkBidangOptions, setBulkBidangOptions] = useState<ComboboxOption[]>(
    []
  )
  const [bulkKategoriOptions, setBulkKategoriOptions] = useState<
    ComboboxOption[]
  >([])

  const debouncedSearch = useDebounce(search, 300)
  const debouncedGuruSearch = useDebounce(guruSearch, 300)
  const debouncedStudentSearch = useDebounce(studentSearch, 300)
  const debouncedEventSearch = useDebounce(eventSearch, 300)
  const debouncedJuaraSearch = useDebounce(juaraSearch, 300)
  const debouncedBidangSearch = useDebounce(bidangSearch, 300)
  const debouncedKategoriSearch = useDebounce(kategoriSearch, 300)
  const debouncedBulkEventSearch = useDebounce(bulkEventSearch, 300)
  const debouncedBulkJuaraSearch = useDebounce(bulkJuaraSearch, 300)
  const debouncedBulkBidangSearch = useDebounce(bulkBidangSearch, 300)
  const debouncedBulkKategoriSearch = useDebounce(bulkKategoriSearch, 300)

  const isFormOpen = isAddOpen || isEditOpen

  const form = useForm<PrestasiFormValues>({
    resolver: zodResolver(prestasiSchema),
    defaultValues: {
      unit: 'SD',
      siswa_id: '',
      event_id: '',
      tempat: 'Offline',
      waktu: new Date(),
      juara_id: '',
      jenis_juara: 'Individu',
      bidang_id: '',
      kategori_id: '',
      tingkat_kejuaraan: 'Tingkat Sekolah',
    },
  })

  const guruForm = useForm<PrestasiGuruFormValues>({
    resolver: zodResolver(prestasiGuruSchema),
    defaultValues: {
      unit: 'SD',
      guru_id: '',
      event_id: '',
      tempat: 'Offline',
      waktu: new Date(),
      juara_id: '',
      jenis_juara: 'Individu',
      bidang_id: '',
      kategori_id: '',
      tingkat_kejuaraan: 'Tingkat Sekolah',
    },
  })

  const bulkForm = useForm<BulkPrestasiFormValues>({
    resolver: zodResolver(bulkPrestasiSchema),
    defaultValues: {
      event_id: '',
      tempat: 'Offline',
      waktu: new Date(),
      juara_id: '',
      jenis_juara: 'Individu',
      bidang_id: '',
      kategori_id: '',
      tingkat_kejuaraan: 'Tingkat Sekolah',
    },
  })

  const queryFilters = useMemo(
    () => ({
      unit: activeUnit,
      tipe: activeTipe,
      search: debouncedSearch || undefined,
      kelas: selectedClassFilter,
      juaraId:
        selectedJuaraFilter !== 'all' ? selectedJuaraFilter : undefined,
      tingkat:
        selectedTingkatFilter !== 'all'
          ? (selectedTingkatFilter as TingkatKejuaraan)
          : undefined,
      page,
      pageSize,
      sortField,
      sortDirection,
    }),
    [
      activeUnit,
      activeTipe,
      debouncedSearch,
      selectedClassFilter,
      selectedJuaraFilter,
      selectedTingkatFilter,
      page,
      pageSize,
      sortField,
      sortDirection,
    ]
  )

  const { data: studentClasses = [] } = useQuery({
    queryKey: ['students', 'classes', activeUnit],
    queryFn: () => getStudentClasses(activeUnit),
  })

  const { data: juaraFilterList = [] } = useQuery({
    queryKey: ['juara-list'],
    queryFn: fetchJuaraList,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['prestasi', queryFilters],
    queryFn: () =>
      getPrestasi({
        unit: [queryFilters.unit],
        tipe: queryFilters.tipe,
        search: queryFilters.search,
        kelas: queryFilters.kelas !== 'all' ? queryFilters.kelas : undefined,
        juara_id: queryFilters.juaraId ? [queryFilters.juaraId] : undefined,
        tingkat_kejuaraan: queryFilters.tingkat ? [queryFilters.tingkat] : undefined,
        page: queryFilters.page,
        pageSize: queryFilters.pageSize,
        sortField: queryFilters.sortField,
        sortDirection: queryFilters.sortDirection,
      }),
  })

  const { isLoading: studentSearchLoading } = useQuery({
    queryKey: ['students-search', debouncedStudentSearch, activeUnit],
    queryFn: async () => {
      const results = await searchStudents(debouncedStudentSearch, activeUnit)
      setStudentOptions(
        results.map((s) => ({
          value: s.id,
          label: `${s.nama} - ${s.kelas?.nama_kelas || '-'}`,
        }))
      )
      return results
    },
    enabled: (isFormOpen || isBulkAddOpen) && activeTipe === 'siswa',
  })

  const { isLoading: guruSearchLoading } = useQuery({
    queryKey: ['guru-search', debouncedGuruSearch],
    queryFn: async () => {
      const results = await searchGuru(debouncedGuruSearch)
      setGuruOptions(
        results.map((g) => ({
          value: g.id,
          label: g.nama_lengkap,
        }))
      )
      return results
    },
    enabled: (isFormOpen || isBulkAddOpen) && activeTipe === 'guru',
  })

  useEffect(() => {
    if (isAddOpen || isBulkAddOpen) {
      form.setValue('unit', activeUnit, { shouldValidate: true })
    }
  }, [isAddOpen, isBulkAddOpen, activeUnit, form])

  const { isLoading: eventSearchLoading } = useQuery({
    queryKey: ['event-search', debouncedEventSearch],
    queryFn: async () => {
      const results = await searchEvent(debouncedEventSearch)
      setEventOptions(
        results.map((e) => ({
          value: e.id,
          label: e.nama_event,
        }))
      )
      return results
    },
    enabled: isFormOpen || isBulkAddOpen,
  })

  const { isLoading: juaraSearchLoading } = useQuery({
    queryKey: ['juara-search', debouncedJuaraSearch],
    queryFn: async () => {
      const results = await searchJuara(debouncedJuaraSearch)
      setJuaraOptions(
        results.map((j) => ({
          value: j.id,
          label: j.nama_juara,
        }))
      )
      return results
    },
    enabled: isFormOpen || isBulkAddOpen,
  })

  const { isLoading: bidangSearchLoading } = useQuery({
    queryKey: ['bidang-search', debouncedBidangSearch],
    queryFn: async () => {
      const results = await searchBidang(debouncedBidangSearch)
      setBidangOptions(
        results.map((b) => ({
          value: b.id,
          label: b.nama_bidang,
        }))
      )
      return results
    },
    enabled: isFormOpen || isBulkAddOpen,
  })

  const { isLoading: kategoriSearchLoading } = useQuery({
    queryKey: ['kategori-prestasi-search', debouncedKategoriSearch],
    queryFn: async () => {
      const results = await searchKategoriPrestasi(debouncedKategoriSearch)
      setKategoriOptions(
        results.map((k) => ({
          value: k.id,
          label: k.nama_kategori,
        }))
      )
      return results
    },
    enabled: isFormOpen || isBulkAddOpen,
  })

  const { isLoading: bulkEventSearchLoading } = useQuery({
    queryKey: ['bulk-event-search', debouncedBulkEventSearch],
    queryFn: async () => {
      const results = await searchEvent(debouncedBulkEventSearch)
      setBulkEventOptions(
        results.map((e) => ({
          value: e.id,
          label: e.nama_event,
        }))
      )
      return results
    },
    enabled: isBulkEditOpen,
  })

  const { isLoading: bulkJuaraSearchLoading } = useQuery({
    queryKey: ['bulk-juara-search', debouncedBulkJuaraSearch],
    queryFn: async () => {
      const results = await searchJuara(debouncedBulkJuaraSearch)
      setBulkJuaraOptions(
        results.map((j) => ({
          value: j.id,
          label: j.nama_juara,
        }))
      )
      return results
    },
    enabled: isBulkEditOpen,
  })

  const { isLoading: bulkBidangSearchLoading } = useQuery({
    queryKey: ['bulk-bidang-search', debouncedBulkBidangSearch],
    queryFn: async () => {
      const results = await searchBidang(debouncedBulkBidangSearch)
      setBulkBidangOptions(
        results.map((b) => ({
          value: b.id,
          label: b.nama_bidang,
        }))
      )
      return results
    },
    enabled: isBulkEditOpen,
  })

  const { isLoading: bulkKategoriSearchLoading } = useQuery({
    queryKey: ['bulk-kategori-prestasi-search', debouncedBulkKategoriSearch],
    queryFn: async () => {
      const results = await searchKategoriPrestasi(debouncedBulkKategoriSearch)
      setBulkKategoriOptions(
        results.map((k) => ({
          value: k.id,
          label: k.nama_kategori,
        }))
      )
      return results
    },
    enabled: isBulkEditOpen,
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['prestasi'] })
    queryClient.invalidateQueries({ queryKey: ['prestasi-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['prestasi-cetak'] })
  }, [queryClient])

  const buildPayload = (values: PrestasiFormValues): CreatePrestasiInput => ({
    unit: values.unit,
    tipe: 'siswa',
    siswa_id: values.siswa_id || undefined,
    guru_id: values.guru_id || undefined,
    event_id: values.event_id,
    tempat: values.tempat,
    waktu: format(values.waktu, 'yyyy-MM-dd'),
    juara_id: values.juara_id,
    jenis_juara: values.jenis_juara,
    bidang_id: values.bidang_id,
    kategori_id: values.kategori_id,
    tingkat_kejuaraan: values.tingkat_kejuaraan,
  })

  const buildGuruPayload = (values: PrestasiGuruFormValues): CreatePrestasiInput => ({
    unit: values.unit,
    tipe: 'guru',
    siswa_id: values.siswa_id || undefined,
    guru_id: values.guru_id || undefined,
    event_id: values.event_id,
    tempat: values.tempat,
    waktu: format(values.waktu, 'yyyy-MM-dd'),
    juara_id: values.juara_id,
    jenis_juara: values.jenis_juara,
    bidang_id: values.bidang_id,
    kategori_id: values.kategori_id,
    tingkat_kejuaraan: values.tingkat_kejuaraan,
  })

  const buildUpdatePayload = (
    values: PrestasiFormValues | PrestasiGuruFormValues,
    tipe: 'siswa' | 'guru'
  ): CreatePrestasiInput => {
    if (tipe === 'guru') {
      const gValues = values as PrestasiGuruFormValues
      return {
        unit: gValues.unit,
        tipe: 'guru',
        siswa_id: gValues.siswa_id || undefined,
        guru_id: gValues.guru_id || undefined,
        event_id: gValues.event_id,
        tempat: gValues.tempat,
        waktu: format(gValues.waktu, 'yyyy-MM-dd'),
        juara_id: gValues.juara_id,
        jenis_juara: gValues.jenis_juara,
        bidang_id: gValues.bidang_id,
        kategori_id: gValues.kategori_id,
        tingkat_kejuaraan: gValues.tingkat_kejuaraan,
      }
    } else {
      const sValues = values as PrestasiFormValues
      return {
        unit: sValues.unit,
        tipe: 'siswa',
        siswa_id: sValues.siswa_id || undefined,
        guru_id: sValues.guru_id || undefined,
        event_id: sValues.event_id,
        tempat: sValues.tempat,
        waktu: format(sValues.waktu, 'yyyy-MM-dd'),
        juara_id: sValues.juara_id,
        jenis_juara: sValues.jenis_juara,
        bidang_id: sValues.bidang_id,
        kategori_id: sValues.kategori_id,
        tingkat_kejuaraan: sValues.tingkat_kejuaraan,
      }
    }
  }

  const buildBulkPayload = (
    values: BulkPrestasiFormValues
  ): BulkPrestasiUpdateInput => ({
    event_id: values.event_id,
    tempat: values.tempat,
    waktu: format(values.waktu, 'yyyy-MM-dd'),
    juara_id: values.juara_id,
    jenis_juara: values.jenis_juara,
    bidang_id: values.bidang_id,
    kategori_id: values.kategori_id,
    tingkat_kejuaraan: values.tingkat_kejuaraan,
  })

  const createMutation = useMutation({
    mutationFn: (input: CreatePrestasiInput) =>
      createPrestasi(input, profile?.nama_lengkap),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'prestasi',
          result.id,
          null,
          prestasiToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Prestasi berhasil ditambahkan',
      })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
      tipe,
    }: {
      id: string
      values: PrestasiFormValues | PrestasiGuruFormValues
      tipe: 'siswa' | 'guru'
      oldItem: Prestasi
    }) => updatePrestasi(id, buildUpdatePayload(values, tipe)),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'prestasi',
          result.id,
          variables.oldItem ? prestasiToRecord(variables.oldItem) : null,
          prestasiToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Prestasi berhasil diperbarui',
      })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const bulkCreateMutation = useMutation({
    mutationFn: (items: CreatePrestasiInput[]) => bulkCreatePrestasi(items),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const result of results) {
          await logAudit(
            userId,
            'BULK_CREATE' as AuditAction,
            'prestasi',
            result.id,
            null,
            prestasiToRecord(result)
          )
        }
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: `Berhasil menyimpan ${results.length} data prestasi`,
      })
      closeBulkAddDialog()
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({
      ids,
      values,
    }: {
      ids: string[]
      values: BulkPrestasiFormValues
    }) => bulkUpdatePrestasiRecords(ids, buildBulkPayload(values)),
    onSuccess: async ({ oldItems, updatedItems }) => {
      const userId = getUserId()
      if (userId) {
        const oldMap = new Map(oldItems.map((item) => [item.id, item]))
        for (const updated of updatedItems) {
          const oldItem = oldMap.get(updated.id)
          if (oldItem) {
            await logAudit(
              userId,
              'BULK_UPDATE' as AuditAction,
              'prestasi',
              updated.id,
              prestasiToRecord(oldItem),
              prestasiToRecord(updated)
            )
          }
        }
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: `Berhasil memperbarui ${updatedItems.length} data prestasi`,
      })
      setSelectedRows([])
      closeBulkEditDialog()
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deletePrestasi(ids),
    onSuccess: async (_, ids) => {
      const userId = getUserId()
      if (userId) {
        for (const id of ids) {
          const item =
            deletingItem?.id === id
              ? deletingItem
              : data?.data.find((row) => row.id === id)
          await logAudit(
            userId,
            'DELETE',
            'prestasi',
            id,
            item ? prestasiToRecord(item) : { id },
            null
          )
        }
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Prestasi berhasil dihapus',
      })
      setIsDeleteOpen(false)
      setIsBulkDeleteOpen(false)
      setDeletingItem(null)
      setSelectedRows([])
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const resetComboboxState = () => {
    setGuruSearch('')
    setGuruOptions([])
    setStudentSearch('')
    setEventSearch('')
    setJuaraSearch('')
    setBidangSearch('')
    setKategoriSearch('')
    setStudentOptions([])
    setEventOptions([])
    setJuaraOptions([])
    setBidangOptions([])
    setKategoriOptions([])
    setKelasDisplay('')
  }

  const resetBulkComboboxState = () => {
    setBulkEventSearch('')
    setBulkJuaraSearch('')
    setBulkBidangSearch('')
    setBulkKategoriSearch('')
    setBulkEventOptions([])
    setBulkJuaraOptions([])
    setBulkBidangOptions([])
    setBulkKategoriOptions([])
  }

  const resetBulkFormDefaults = () => {
    bulkForm.reset({
      event_id: '',
      tempat: 'Offline',
      waktu: new Date(),
      juara_id: '',
      jenis_juara: 'Individu',
      bidang_id: '',
      kategori_id: '',
      tingkat_kejuaraan: 'Tingkat Sekolah',
    })
  }

  const closeBulkEditDialog = () => {
    setIsBulkEditOpen(false)
    resetBulkFormDefaults()
    resetBulkComboboxState()
  }

  const resetFormDefaults = (unit: Unit = activeUnit) => {
    form.reset({
      unit,
      siswa_id: '',
      event_id: '',
      tempat: 'Offline',
      waktu: new Date(),
      juara_id: '',
      jenis_juara: 'Individu',
      bidang_id: '',
      kategori_id: '',
      tingkat_kejuaraan: 'Tingkat Sekolah',
    })
    guruForm.reset({
      unit,
      guru_id: '',
      event_id: '',
      tempat: 'Offline',
      waktu: new Date(),
      juara_id: '',
      jenis_juara: 'Individu',
      bidang_id: '',
      kategori_id: '',
      tingkat_kejuaraan: 'Tingkat Sekolah',
    })
  }

  const closeFormDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    resetFormDefaults()
    resetComboboxState()
  }

  const handleActiveUnitChange = (unit: Unit) => {
    setActiveUnit(unit)
    setPage(1)
    setSelectedRows([])
    setSelectedClassFilter('all')
    setSelectedJuaraFilter('all')
    setSelectedTingkatFilter('all')
  }

  const openAddDialog = () => {
    setEditingItem(null)
    resetFormDefaults(activeUnit)
    resetComboboxState()
    setIsAddOpen(true)
  }

  const openEditDialog = (item: Prestasi) => {
    setEditingItem(item)
    resetComboboxState()

    const isGuru = item.tipe === 'guru'

    if (isGuru) {
      if (item.profiles && item.guru_id) {
        setGuruOptions([
          {
            value: item.guru_id,
            label: item.profiles?.nama_lengkap ?? 'User Dihapus',
          },
        ])
      }

      if (item.event && item.event_id) {
        setEventOptions([
          { value: item.event_id, label: item.event?.nama_event ?? 'Event Tidak Valid' },
        ])
      }

      if (item.juara && item.juara_id) {
        setJuaraOptions([
          { value: item.juara_id, label: item.juara?.nama_juara ?? 'Juara Tidak Valid' },
        ])
      }

      if (item.bidang && item.bidang_id) {
        setBidangOptions([
          { value: item.bidang_id, label: item.bidang?.nama_bidang ?? 'Bidang Tidak Valid' },
        ])
      }

      if (item.kategori_prestasi && item.kategori_id) {
        setKategoriOptions([
          {
            value: item.kategori_id,
            label: item.kategori_prestasi?.nama_kategori ?? 'Kategori Tidak Valid',
          },
        ])
      }

      guruForm.reset({
        unit: item.unit ?? 'SD',
        guru_id: item.guru_id ?? '',
        event_id: item.event_id ?? '',
        tempat: item.tempat ?? 'Offline',
        waktu: item.waktu ? parseISO(item.waktu) : new Date(),
        juara_id: item.juara_id ?? '',
        jenis_juara: item.jenis_juara ?? 'Individu',
        bidang_id: item.bidang_id ?? '',
        kategori_id: item.kategori_id ?? '',
        tingkat_kejuaraan: item.tingkat_kejuaraan ?? 'Tingkat Sekolah',
      })
    } else {
      if (item.students && item.siswa_id) {
        setStudentOptions([
          {
            value: item.siswa_id,
            label: `${item.students?.nama ?? 'Siswa Dihapus'} - ${item.students?.kelas?.nama_kelas || '-'}`,
          },
        ])
        setKelasDisplay(item.students?.kelas?.nama_kelas ?? '')
      }

      if (item.event && item.event_id) {
        setEventOptions([
          { value: item.event_id, label: item.event?.nama_event ?? 'Event Tidak Valid' },
        ])
      }

      if (item.juara && item.juara_id) {
        setJuaraOptions([
          { value: item.juara_id, label: item.juara?.nama_juara ?? 'Juara Tidak Valid' },
        ])
      }

      if (item.bidang && item.bidang_id) {
        setBidangOptions([
          { value: item.bidang_id, label: item.bidang?.nama_bidang ?? 'Bidang Tidak Valid' },
        ])
      }

      if (item.kategori_prestasi && item.kategori_id) {
        setKategoriOptions([
          {
            value: item.kategori_id,
            label: item.kategori_prestasi?.nama_kategori ?? 'Kategori Tidak Valid',
          },
        ])
      }

      form.reset({
        unit: item.unit ?? 'SD',
        siswa_id: item.siswa_id ?? '',
        event_id: item.event_id ?? '',
        tempat: item.tempat ?? 'Offline',
        waktu: item.waktu ? parseISO(item.waktu) : new Date(),
        juara_id: item.juara_id ?? '',
        jenis_juara: item.jenis_juara ?? 'Individu',
        bidang_id: item.bidang_id ?? '',
        kategori_id: item.kategori_id ?? '',
        tingkat_kejuaraan: item.tingkat_kejuaraan ?? 'Tingkat Sekolah',
      })
    }
    setIsEditOpen(true)
  }

  const openSingleDelete = (item: Prestasi) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const openBulkDelete = () => {
    setIsBulkDeleteOpen(true)
  }

  const openBulkEdit = () => {
    resetBulkFormDefaults()
    resetBulkComboboxState()
    setIsBulkEditOpen(true)
  }

  const closeBulkAddDialog = () => {
    setIsBulkAddOpen(false)
    setPrestasiQueue([])
    resetFormDefaults(activeUnit)
    resetComboboxState()
  }

  const openBulkAdd = () => {
    resetFormDefaults(activeUnit)
    resetComboboxState()
    setPrestasiQueue([])
    setIsBulkAddOpen(true)
  }

  const addToPrestasiQueue = (values: PrestasiFormValues) => {
    const siswaLabel =
      studentOptions.find((o) => o.value === values.siswa_id)?.label ?? '-'
    const eventLabel =
      eventOptions.find((o) => o.value === values.event_id)?.label ?? '-'
    const juaraLabel =
      juaraOptions.find((o) => o.value === values.juara_id)?.label ?? '-'

    setPrestasiQueue((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        ...buildPayload({ ...values, unit: activeUnit }),
        siswaLabel,
        kelas: kelasDisplay,
        eventLabel,
        juaraLabel,
      },
    ])
    resetFormDefaults(activeUnit)
    resetComboboxState()
    toast({
      title: 'Ditambahkan',
      description: 'Item ditambahkan ke daftar. Isi form untuk menambah lagi.',
    })
  }

  const onSubmitBulkEdit = (values: BulkPrestasiFormValues) => {
    bulkUpdateMutation.mutate({
      ids: selectedRows,
      values,
    })
  }

  const onSubmitForm = (values: PrestasiFormValues) => {
    if (isEditOpen && editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        values,
        tipe: 'siswa',
        oldItem: editingItem,
      })
    } else {
      createMutation.mutate(buildPayload({ ...values, unit: activeUnit }))
    }
  }

  const onSubmitGuruForm = (values: PrestasiGuruFormValues) => {
    if (isEditOpen && editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        values,
        tipe: 'guru',
        oldItem: editingItem,
      })
    } else {
      createMutation.mutate(buildGuruPayload(values))
    }
  }

  const columns = useMemo<ColumnDef<Prestasi>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'unit',
        header: 'Unit',
        cell: ({ row }) => row.original.unit ?? '-',
      },
      {
        id: 'nama_siswa',
        accessorKey: 'siswa_id',
        header: 'Nama Siswa',
        cell: ({ row }) => row.original.students?.nama ?? '-',
      },
      {
        id: 'kelas',
        header: 'Kelas',
        enableSorting: false,
        cell: ({ row }) => row.original.students?.kelas?.nama_kelas ?? '-',
      },
      {
        id: 'event',
        accessorKey: 'event_id',
        header: 'Event',
        cell: ({ row }) => row.original.event?.nama_event ?? '-',
      },
      {
        accessorKey: 'tempat',
        header: 'Tempat',
        cell: ({ row }) => row.original.tempat ?? '-',
      },
      {
        accessorKey: 'waktu',
        header: 'Waktu',
        cell: ({ row }) => formatTanggal(row.original.waktu),
      },
      {
        id: 'juara',
        accessorKey: 'juara_id',
        header: 'Juara',
        cell: ({ row }) => row.original.juara?.nama_juara ?? '-',
      },
      {
        accessorKey: 'jenis_juara',
        header: 'Jenis Juara',
        cell: ({ row }) => row.original.jenis_juara ?? '-',
      },
      {
        id: 'bidang',
        accessorKey: 'bidang_id',
        header: 'Bidang',
        cell: ({ row }) => row.original.bidang?.nama_bidang ?? '-',
      },
      {
        id: 'kategori',
        accessorKey: 'kategori_id',
        header: 'Kategori',
        cell: ({ row }) =>
          row.original.kategori_prestasi?.nama_kategori ?? '-',
      },
      {
        accessorKey: 'tingkat_kejuaraan',
        header: 'Tingkat',
        cell: ({ row }) => row.original.tingkat_kejuaraan ?? '-',
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
              aria-label="Edit prestasi"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openSingleDelete(row.original)}
              aria-label="Hapus prestasi"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize]
  )

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const isBulkSubmitting = bulkUpdateMutation.isPending
  const isBulkCreateSubmitting = bulkCreateMutation.isPending

  // Kolom tabel untuk mode guru
  const guruColumns = useMemo<ColumnDef<Prestasi>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'unit',
        header: 'Unit',
        cell: ({ row }) => row.original.unit ?? '-',
      },
      {
        id: 'nama_guru',
        header: 'Nama Guru',
        enableSorting: false,
        cell: ({ row }) => row.original.profiles?.nama_lengkap ?? '-',
      },
      {
        id: 'event',
        accessorKey: 'event_id',
        header: 'Event',
        cell: ({ row }) => row.original.event?.nama_event ?? '-',
      },
      {
        accessorKey: 'tempat',
        header: 'Tempat',
        cell: ({ row }) => row.original.tempat ?? '-',
      },
      {
        accessorKey: 'waktu',
        header: 'Waktu',
        cell: ({ row }) => formatTanggal(row.original.waktu),
      },
      {
        id: 'juara',
        accessorKey: 'juara_id',
        header: 'Juara',
        cell: ({ row }) => row.original.juara?.nama_juara ?? '-',
      },
      {
        accessorKey: 'jenis_juara',
        header: 'Jenis Juara',
        cell: ({ row }) => row.original.jenis_juara ?? '-',
      },
      {
        id: 'bidang',
        accessorKey: 'bidang_id',
        header: 'Bidang',
        cell: ({ row }) => row.original.bidang?.nama_bidang ?? '-',
      },
      {
        id: 'kategori',
        accessorKey: 'kategori_id',
        header: 'Kategori',
        cell: ({ row }) => row.original.kategori_prestasi?.nama_kategori ?? '-',
      },
      {
        accessorKey: 'tingkat_kejuaraan',
        header: 'Tingkat',
        cell: ({ row }) => row.original.tingkat_kejuaraan ?? '-',
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
              aria-label="Edit prestasi"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openSingleDelete(row.original)}
              aria-label="Hapus prestasi"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize]
  )

  const renderPrestasiFormFields = (showAddToListButton = false, isGuru = false) => {
    const watchField = (field: any) => {
      return isGuru ? guruForm.watch(field) : form.watch(field)
    }

    const setValueField = (field: any, value: any) => {
      if (isGuru) {
        guruForm.setValue(field, value, { shouldValidate: true })
      } else {
        form.setValue(field, value, { shouldValidate: true })
      }
    }

    const getFieldError = (field: any) => {
      const errors = isGuru ? guruForm.formState.errors : form.formState.errors
      return (errors as any)[field]
    }

    return (
      <div className="space-y-4">
        {!isGuru && (
          <>
            <div className="space-y-2">
              <Label>Nama Siswa</Label>
              <Combobox
                options={studentOptions}
                value={form.watch('siswa_id')}
                onSelect={(value, label) => {
                  form.setValue('siswa_id', value, { shouldValidate: true })
                  const kelasPart = label.split(' - ')[1]
                  setKelasDisplay(kelasPart ?? '')
                }}
                onSearch={setStudentSearch}
                placeholder="Cari siswa..."
                isLoading={studentSearchLoading}
              />
              {form.formState.errors.siswa_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.siswa_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kelas">Kelas</Label>
              <Input id="kelas" value={kelasDisplay} disabled readOnly />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Event</Label>
          <Combobox
            options={eventOptions}
            value={watchField('event_id')}
            onSelect={(value) =>
              setValueField('event_id', value)
            }
            onSearch={setEventSearch}
            placeholder="Cari event..."
            isLoading={eventSearchLoading}
          />
          {getFieldError('event_id') && (
            <p className="text-xs text-status-red">
              {getFieldError('event_id').message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Tempat</Label>
          <RadioGroup
            value={watchField('tempat')}
            onValueChange={(value) =>
              setValueField('tempat', value as Tempat)
            }
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Offline" id="tempat-offline" />
              <Label htmlFor="tempat-offline" className="font-normal">
                Offline
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Online" id="tempat-online" />
              <Label htmlFor="tempat-online" className="font-normal">
                Online
              </Label>
            </div>
          </RadioGroup>
          {getFieldError('tempat') && (
            <p className="text-xs text-status-red">
              {getFieldError('tempat').message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Waktu</Label>
          <DatePicker
            value={watchField('waktu')}
            onChange={(date) => {
              if (date) {
                setValueField('waktu', date)
              }
            }}
          />
          {getFieldError('waktu') && (
            <p className="text-xs text-status-red">
              {getFieldError('waktu').message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Juara</Label>
          <Combobox
            options={juaraOptions}
            value={watchField('juara_id')}
            onSelect={(value) =>
              setValueField('juara_id', value)
            }
            onSearch={setJuaraSearch}
            placeholder="Cari juara..."
            isLoading={juaraSearchLoading}
          />
          {getFieldError('juara_id') && (
            <p className="text-xs text-status-red">
              {getFieldError('juara_id').message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Jenis Juara</Label>
          <RadioGroup
            value={watchField('jenis_juara')}
            onValueChange={(value) =>
              setValueField('jenis_juara', value as JenisJuara)
            }
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Individu" id="jenis-individu" />
              <Label htmlFor="jenis-individu" className="font-normal">
                Individu
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Kelompok" id="jenis-kelompok" />
              <Label htmlFor="jenis-kelompok" className="font-normal">
                Kelompok
              </Label>
            </div>
          </RadioGroup>
          {getFieldError('jenis_juara') && (
            <p className="text-xs text-status-red">
              {getFieldError('jenis_juara').message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Bidang</Label>
          <Combobox
            options={bidangOptions}
            value={watchField('bidang_id')}
            onSelect={(value) =>
              setValueField('bidang_id', value)
            }
            onSearch={setBidangSearch}
            placeholder="Cari bidang..."
            isLoading={bidangSearchLoading}
          />
          {getFieldError('bidang_id') && (
            <p className="text-xs text-status-red">
              {getFieldError('bidang_id').message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Kategori</Label>
          <Combobox
            options={kategoriOptions}
            value={watchField('kategori_id')}
            onSelect={(value) =>
              setValueField('kategori_id', value)
            }
            onSearch={setKategoriSearch}
            placeholder="Cari kategori..."
            isLoading={kategoriSearchLoading}
          />
          {getFieldError('kategori_id') && (
            <p className="text-xs text-status-red">
              {getFieldError('kategori_id').message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Tingkat Kejuaraan</Label>
          <Select
            value={watchField('tingkat_kejuaraan')}
            onValueChange={(value) =>
              setValueField('tingkat_kejuaraan', value as TingkatKejuaraan)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih tingkat" />
            </SelectTrigger>
            <SelectContent>
              {TINGKAT_KEJUARAAN.map((tingkat) => (
                <SelectItem key={tingkat} value={tingkat}>
                  {tingkat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {getFieldError('tingkat_kejuaraan') && (
            <p className="text-xs text-status-red">
              {getFieldError('tingkat_kejuaraan').message}
            </p>
          )}
        </div>

        {showAddToListButton && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={form.handleSubmit(addToPrestasiQueue)}
          >
            Tambah ke Daftar
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Prestasi"
        actions={
          <>
            <Button type="button" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Prestasi {activeTipe === 'guru' ? 'Guru' : 'Siswa'}
            </Button>
            {activeTipe === 'siswa' && (
              <Button type="button" variant="outline" onClick={openBulkAdd}>
                <Upload className="mr-2 h-4 w-4" />
                Tambah Banyak
              </Button>
            )}
          </>
        }
      />

      <Tabs
        value={activeUnit}
        onValueChange={(value) => handleActiveUnitChange(value as Unit)}
      >
        <TabsList>
          {UNITS.map((unit) => (
            <TabsTrigger key={unit} value={unit}>
              {unit}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Toggle Tipe: Siswa / Guru */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--text-secondary)]">Tipe:</span>
        <Tabs
          value={activeTipe}
          onValueChange={(v) => {
            setActiveTipe(v as TipePrestasi)
            setPage(1)
            setSelectedRows([])
          }}
        >
          <TabsList>
            <TabsTrigger value="siswa">Siswa</TabsTrigger>
            <TabsTrigger value="guru">Guru</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              placeholder={activeTipe === 'guru' ? 'Cari nama guru...' : 'Cari nama siswa...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
          {/* Filter kelas: hanya tampil jika tipe siswa */}
          {activeTipe === 'siswa' && (
            <Select
              value={selectedClassFilter}
              onValueChange={(value) => {
                setSelectedClassFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Semua Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {studentClasses.map((kelas) => (
                  <SelectItem key={kelas} value={kelas}>
                    {kelas}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={selectedJuaraFilter}
            onValueChange={(value) => {
              setSelectedJuaraFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Semua Juara" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Juara</SelectItem>
              {juaraFilterList.map((juara) => (
                <SelectItem key={juara.id} value={juara.id}>
                  {juara.nama_juara}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedTingkatFilter}
            onValueChange={(value) => {
              setSelectedTingkatFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Semua Tingkat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tingkat</SelectItem>
              {TINGKAT_KEJUARAAN.map((tingkat) => (
                <SelectItem key={tingkat} value={tingkat}>
                  {tingkat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <span className="text-sm text-[var(--text-primary)]">
            {selectedRows.length} item terpilih
          </span>
          {activeTipe === 'siswa' && (
            <Button type="button" variant="outline" size="sm" onClick={openBulkEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Terpilih
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={openBulkDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus Terpilih
          </Button>
        </div>
      )}

      <DataTable
        columns={activeTipe === 'guru' ? guruColumns : columns}
        data={data?.data ?? []}
        pagination={{
          page,
          pageSize,
          total: data?.total ?? 0,
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

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) closeFormDialog()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditOpen ? 'Edit Prestasi' : `Tambah Prestasi ${activeTipe === 'guru' ? 'Guru' : 'Siswa'}`}
            </DialogTitle>
          </DialogHeader>
          {(editingItem ? editingItem.tipe : activeTipe) === 'guru' ? (
            <form
              onSubmit={guruForm.handleSubmit(onSubmitGuruForm)}
              className="space-y-4"
            >
              {/* Form Guru */}
              <div className="space-y-2">
                <Label>Nama Guru</Label>
                <Combobox
                  options={guruOptions}
                  value={guruForm.watch('guru_id') || ''}
                  onSelect={(value) => {
                    guruForm.setValue('guru_id', value, { shouldValidate: true })
                  }}
                  onSearch={setGuruSearch}
                  placeholder="Cari nama guru..."
                  isLoading={guruSearchLoading}
                />
                {guruForm.formState.errors.guru_id && (
                  <p className="text-xs text-status-red">
                    {guruForm.formState.errors.guru_id.message}
                  </p>
                )}
              </div>
              {renderPrestasiFormFields(false, true)}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeFormDialog}>
                  Batal
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {isEditOpen ? 'Simpan' : 'Tambah'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form
              onSubmit={form.handleSubmit(onSubmitForm)}
              className="space-y-4"
            >
              {renderPrestasiFormFields(false, false)}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeFormDialog}>
                  Batal
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  {isEditOpen ? 'Simpan' : 'Tambah'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkAddOpen}
        onOpenChange={(open) => {
          if (!open) closeBulkAddDialog()
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Banyak Data Prestasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {renderPrestasiFormFields(true)}

            {prestasiQueue.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Daftar ({prestasiQueue.length} item)
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Siswa</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Juara</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prestasiQueue.map((item) => (
                      <TableRow key={item.localId}>
                        <TableCell>{formatTanggal(item.waktu)}</TableCell>
                        <TableCell>{item.siswaLabel}</TableCell>
                        <TableCell>{item.eventLabel}</TableCell>
                        <TableCell>{item.juaraLabel}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setPrestasiQueue((prev) =>
                                prev.filter((p) => p.localId !== item.localId)
                              )
                            }
                            aria-label="Hapus dari daftar"
                          >
                            <Trash2 className="h-4 w-4 text-status-red" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeBulkAddDialog}
            >
              Batal
            </Button>
            <Button
              type="button"
              isLoading={isBulkCreateSubmitting}
              disabled={prestasiQueue.length === 0}
              onClick={() =>
                bulkCreateMutation.mutate(
                  prestasiQueue.map(
                    ({
                      localId: _localId,
                      siswaLabel: _siswaLabel,
                      kelas: _kelas,
                      eventLabel: _eventLabel,
                      juaraLabel: _juaraLabel,
                      ...payload
                    }) => payload
                  )
                )
              }
            >
              Simpan Semua ({prestasiQueue.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Prestasi"
        description="Apakah Anda yakin ingin menghapus prestasi ini? Tindakan ini tidak dapat dibatalkan."
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) {
            deleteMutation.mutate([deletingItem.id])
          }
        }}
      />

      <Dialog
        open={isBulkEditOpen}
        onOpenChange={(open) => {
          if (!open) closeBulkEditDialog()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Banyak Data Prestasi</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--text-secondary)]">
            Mengubah {selectedRows.length} data terpilih. Field Unit, Nama Siswa,
            dan Kelas tidak diubah karena setiap record memiliki siswa berbeda.
          </p>
          <form
            onSubmit={bulkForm.handleSubmit(onSubmitBulkEdit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Event</Label>
              <Combobox
                options={bulkEventOptions}
                value={bulkForm.watch('event_id')}
                onSelect={(value) =>
                  bulkForm.setValue('event_id', value, { shouldValidate: true })
                }
                onSearch={setBulkEventSearch}
                placeholder="Cari event..."
                isLoading={bulkEventSearchLoading}
              />
              {bulkForm.formState.errors.event_id && (
                <p className="text-xs text-status-red">
                  {bulkForm.formState.errors.event_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tempat</Label>
              <RadioGroup
                value={bulkForm.watch('tempat')}
                onValueChange={(value) =>
                  bulkForm.setValue('tempat', value as Tempat, {
                    shouldValidate: true,
                  })
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Offline" id="bulk-tempat-offline" />
                  <Label htmlFor="bulk-tempat-offline" className="font-normal">
                    Offline
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Online" id="bulk-tempat-online" />
                  <Label htmlFor="bulk-tempat-online" className="font-normal">
                    Online
                  </Label>
                </div>
              </RadioGroup>
              {bulkForm.formState.errors.tempat && (
                <p className="text-xs text-status-red">
                  {bulkForm.formState.errors.tempat.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Waktu</Label>
              <DatePicker
                value={bulkForm.watch('waktu')}
                onChange={(date) => {
                  if (date) {
                    bulkForm.setValue('waktu', date, { shouldValidate: true })
                  }
                }}
              />
              {bulkForm.formState.errors.waktu && (
                <p className="text-xs text-status-red">
                  {bulkForm.formState.errors.waktu.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Juara</Label>
              <Combobox
                options={bulkJuaraOptions}
                value={bulkForm.watch('juara_id')}
                onSelect={(value) =>
                  bulkForm.setValue('juara_id', value, { shouldValidate: true })
                }
                onSearch={setBulkJuaraSearch}
                placeholder="Cari juara..."
                isLoading={bulkJuaraSearchLoading}
              />
              {bulkForm.formState.errors.juara_id && (
                <p className="text-xs text-status-red">
                  {bulkForm.formState.errors.juara_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Jenis Juara</Label>
              <RadioGroup
                value={bulkForm.watch('jenis_juara')}
                onValueChange={(value) =>
                  bulkForm.setValue('jenis_juara', value as JenisJuara, {
                    shouldValidate: true,
                  })
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Individu" id="bulk-jenis-individu" />
                  <Label htmlFor="bulk-jenis-individu" className="font-normal">
                    Individu
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Kelompok" id="bulk-jenis-kelompok" />
                  <Label htmlFor="bulk-jenis-kelompok" className="font-normal">
                    Kelompok
                  </Label>
                </div>
              </RadioGroup>
              {bulkForm.formState.errors.jenis_juara && (
                <p className="text-xs text-status-red">
                  {bulkForm.formState.errors.jenis_juara.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Bidang</Label>
              <Combobox
                options={bulkBidangOptions}
                value={bulkForm.watch('bidang_id')}
                onSelect={(value) =>
                  bulkForm.setValue('bidang_id', value, { shouldValidate: true })
                }
                onSearch={setBulkBidangSearch}
                placeholder="Cari bidang..."
                isLoading={bulkBidangSearchLoading}
              />
              {bulkForm.formState.errors.bidang_id && (
                <p className="text-xs text-status-red">
                  {bulkForm.formState.errors.bidang_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Kategori</Label>
              <Combobox
                options={bulkKategoriOptions}
                value={bulkForm.watch('kategori_id')}
                onSelect={(value) =>
                  bulkForm.setValue('kategori_id', value, {
                    shouldValidate: true,
                  })
                }
                onSearch={setBulkKategoriSearch}
                placeholder="Cari kategori..."
                isLoading={bulkKategoriSearchLoading}
              />
              {bulkForm.formState.errors.kategori_id && (
                <p className="text-xs text-status-red">
                  {bulkForm.formState.errors.kategori_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tingkat Kejuaraan</Label>
              <Select
                value={bulkForm.watch('tingkat_kejuaraan')}
                onValueChange={(value) =>
                  bulkForm.setValue(
                    'tingkat_kejuaraan',
                    value as TingkatKejuaraan,
                    { shouldValidate: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tingkat" />
                </SelectTrigger>
                <SelectContent>
                  {TINGKAT_KEJUARAAN.map((tingkat) => (
                    <SelectItem key={tingkat} value={tingkat}>
                      {tingkat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bulkForm.formState.errors.tingkat_kejuaraan && (
                <p className="text-xs text-status-red">
                  {bulkForm.formState.errors.tingkat_kejuaraan.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeBulkEditDialog}
              >
                Batal
              </Button>
              <Button type="submit" isLoading={isBulkSubmitting}>
                Simpan Perubahan ({selectedRows.length} Data)
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        title="Hapus Prestasi Terpilih"
        description={`Apakah Anda yakin ingin menghapus ${selectedRows.length} prestasi terpilih? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(selectedRows)}
      />
    </div>
  )
}
