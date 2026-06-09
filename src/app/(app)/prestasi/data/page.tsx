'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
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
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  createPrestasi,
  deletePrestasi,
  searchBidang,
  searchEvent,
  searchJuara,
  searchKategoriPrestasi,
  TINGKAT_KEJUARAAN,
  updatePrestasi,
  type CreatePrestasiInput,
} from '@/lib/queries/prestasi'
import { getStudentClasses, searchStudents } from '@/lib/queries/students'
import { createClient } from '@/lib/supabase/client'
import type {
  JenisJuara,
  Juara,
  Prestasi,
  Tempat,
  TingkatKejuaraan,
  Unit,
} from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

const prestasiSchema = z.object({
  unit: z.enum(['SD', 'SMP', 'SMA']),
  siswa_id: z.string().uuid('Pilih siswa'),
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

type PrestasiFormValues = z.infer<typeof prestasiSchema>

interface ComboboxOption {
  value: string
  label: string
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
  students(id,nama,kelas),
  event(id,nama_event),
  juara(id,nama_juara),
  bidang(id,nama_bidang),
  kategori_prestasi(id,nama_kategori)
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

interface FetchPrestasiPageParams {
  unit: Unit
  search?: string
  kelas?: string
  juaraId?: string
  tingkat?: TingkatKejuaraan
  page: number
  pageSize: number
  sortField: string
  sortDirection: 'asc' | 'desc'
}

async function fetchPrestasiPageData(
  params: FetchPrestasiPageParams
): Promise<{ data: Prestasi[]; total: number }> {
  const supabase = createClient()
  let studentIds: string[] | null = null

  if (params.search || (params.kelas && params.kelas !== 'all')) {
    let studentQuery = supabase
      .from('students')
      .select('id')
      .eq('unit', params.unit)

    if (params.search) {
      studentQuery = studentQuery.ilike('nama', `%${params.search}%`)
    }

    if (params.kelas && params.kelas !== 'all') {
      studentQuery = studentQuery.eq('kelas', params.kelas)
    }

    const { data, error } = await studentQuery

    if (error) throw new Error(error.message)

    studentIds = (data ?? []).map((row) => row.id)

    if (studentIds.length === 0) {
      return { data: [], total: 0 }
    }
  }

  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1
  const sortField = resolveSortField(params.sortField)
  const ascending = params.sortDirection !== 'desc'

  let countQuery = supabase
    .from('prestasi')
    .select('*', { count: 'exact', head: true })
    .eq('unit', params.unit)

  if (studentIds) {
    countQuery = countQuery.in('siswa_id', studentIds)
  }

  if (params.juaraId) {
    countQuery = countQuery.eq('juara_id', params.juaraId)
  }

  if (params.tingkat) {
    countQuery = countQuery.eq('tingkat_kejuaraan', params.tingkat)
  }

  const { count, error: countError } = await countQuery

  if (countError) throw new Error(countError.message)

  let dataQuery = supabase
    .from('prestasi')
    .select(PRESTASI_SELECT)
    .eq('unit', params.unit)

  if (studentIds) {
    dataQuery = dataQuery.in('siswa_id', studentIds)
  }

  if (params.juaraId) {
    dataQuery = dataQuery.eq('juara_id', params.juaraId)
  }

  if (params.tingkat) {
    dataQuery = dataQuery.eq('tingkat_kejuaraan', params.tingkat)
  }

  const { data, error } = await dataQuery
    .order(sortField, { ascending })
    .range(from, to)

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as Prestasi[],
    total: count ?? 0,
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
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all')
  const [selectedJuaraFilter, setSelectedJuaraFilter] = useState<string>('all')
  const [selectedTingkatFilter, setSelectedTingkatFilter] = useState<string>('all')

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)

  const [editingItem, setEditingItem] = useState<Prestasi | null>(null)
  const [deletingItem, setDeletingItem] = useState<Prestasi | null>(null)

  const [kelasDisplay, setKelasDisplay] = useState('')

  const [studentSearch, setStudentSearch] = useState('')
  const [eventSearch, setEventSearch] = useState('')
  const [juaraSearch, setJuaraSearch] = useState('')
  const [bidangSearch, setBidangSearch] = useState('')
  const [kategoriSearch, setKategoriSearch] = useState('')

  const [studentOptions, setStudentOptions] = useState<ComboboxOption[]>([])
  const [eventOptions, setEventOptions] = useState<ComboboxOption[]>([])
  const [juaraOptions, setJuaraOptions] = useState<ComboboxOption[]>([])
  const [bidangOptions, setBidangOptions] = useState<ComboboxOption[]>([])
  const [kategoriOptions, setKategoriOptions] = useState<ComboboxOption[]>([])

  const debouncedSearch = useDebounce(search, 300)
  const debouncedStudentSearch = useDebounce(studentSearch, 300)
  const debouncedEventSearch = useDebounce(eventSearch, 300)
  const debouncedJuaraSearch = useDebounce(juaraSearch, 300)
  const debouncedBidangSearch = useDebounce(bidangSearch, 300)
  const debouncedKategoriSearch = useDebounce(kategoriSearch, 300)

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

  const selectedUnit = form.watch('unit')

  const queryFilters = useMemo(
    () => ({
      unit: activeUnit,
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
    queryFn: () => fetchPrestasiPageData(queryFilters),
  })

  const { isLoading: studentSearchLoading } = useQuery({
    queryKey: ['students-search', debouncedStudentSearch, selectedUnit],
    queryFn: async () => {
      const results = await searchStudents(debouncedStudentSearch, selectedUnit)
      setStudentOptions(
        results.map((s) => ({
          value: s.id,
          label: `${s.nama} - ${s.kelas}`,
        }))
      )
      return results
    },
    enabled: isFormOpen && Boolean(selectedUnit),
  })

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
    enabled: isFormOpen,
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
    enabled: isFormOpen,
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
    enabled: isFormOpen,
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
    enabled: isFormOpen,
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['prestasi'] })
    queryClient.invalidateQueries({ queryKey: ['prestasi-dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['prestasi-cetak'] })
  }, [queryClient])

  const buildPayload = (values: PrestasiFormValues): CreatePrestasiInput => ({
    unit: values.unit,
    siswa_id: values.siswa_id,
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
    mutationFn: (values: PrestasiFormValues) =>
      createPrestasi(buildPayload(values)),
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
    }: {
      id: string
      values: PrestasiFormValues
      oldItem: Prestasi
    }) => updatePrestasi(id, buildPayload(values)),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'prestasi',
          result.id,
          prestasiToRecord(variables.oldItem),
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

  const resetFormDefaults = () => {
    form.reset({
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
    })
  }

  const closeFormDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    resetFormDefaults()
    resetComboboxState()
  }

  const handleUnitChange = (unit: Unit) => {
    form.setValue('unit', unit, { shouldValidate: true })
    form.setValue('siswa_id', '')
    setKelasDisplay('')
    setStudentOptions([])
    setStudentSearch('')
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
    resetFormDefaults()
    resetComboboxState()
    setIsAddOpen(true)
  }

  const openEditDialog = (item: Prestasi) => {
    setEditingItem(item)
    resetComboboxState()

    if (item.students && item.siswa_id) {
      setStudentOptions([
        {
          value: item.siswa_id,
          label: `${item.students.nama} - ${item.students.kelas}`,
        },
      ])
      setKelasDisplay(item.students.kelas)
    }

    if (item.event && item.event_id) {
      setEventOptions([
        { value: item.event_id, label: item.event.nama_event },
      ])
    }

    if (item.juara && item.juara_id) {
      setJuaraOptions([
        { value: item.juara_id, label: item.juara.nama_juara },
      ])
    }

    if (item.bidang && item.bidang_id) {
      setBidangOptions([
        { value: item.bidang_id, label: item.bidang.nama_bidang },
      ])
    }

    if (item.kategori_prestasi && item.kategori_id) {
      setKategoriOptions([
        {
          value: item.kategori_id,
          label: item.kategori_prestasi.nama_kategori,
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
    setIsEditOpen(true)
  }

  const openSingleDelete = (item: Prestasi) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const openBulkDelete = () => {
    setIsBulkDeleteOpen(true)
  }

  const onSubmitForm = (values: PrestasiFormValues) => {
    if (isEditOpen && editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        values,
        oldItem: editingItem,
      })
    } else {
      createMutation.mutate(values)
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
        cell: ({ row }) => row.original.students?.kelas ?? '-',
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Prestasi"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Prestasi
          </Button>
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

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              placeholder="Cari nama siswa..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
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
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <span className="text-sm text-[var(--text-primary)]">
            {selectedRows.length} item terpilih
          </span>
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
        columns={columns}
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
              {isEditOpen ? 'Edit Prestasi' : 'Tambah Prestasi'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmitForm)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={form.watch('unit')}
                onValueChange={(value) => handleUnitChange(value as Unit)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.unit && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.unit.message}
                </p>
              )}
            </div>

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
                disabled={!selectedUnit}
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

            <div className="space-y-2">
              <Label>Event</Label>
              <Combobox
                options={eventOptions}
                value={form.watch('event_id')}
                onSelect={(value) =>
                  form.setValue('event_id', value, { shouldValidate: true })
                }
                onSearch={setEventSearch}
                placeholder="Cari event..."
                isLoading={eventSearchLoading}
              />
              {form.formState.errors.event_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.event_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tempat</Label>
              <RadioGroup
                value={form.watch('tempat')}
                onValueChange={(value) =>
                  form.setValue('tempat', value as Tempat, {
                    shouldValidate: true,
                  })
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
              {form.formState.errors.tempat && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.tempat.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Waktu</Label>
              <DatePicker
                value={form.watch('waktu')}
                onChange={(date) => {
                  if (date) {
                    form.setValue('waktu', date, { shouldValidate: true })
                  }
                }}
              />
              {form.formState.errors.waktu && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.waktu.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Juara</Label>
              <Combobox
                options={juaraOptions}
                value={form.watch('juara_id')}
                onSelect={(value) =>
                  form.setValue('juara_id', value, { shouldValidate: true })
                }
                onSearch={setJuaraSearch}
                placeholder="Cari juara..."
                isLoading={juaraSearchLoading}
              />
              {form.formState.errors.juara_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.juara_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Jenis Juara</Label>
              <RadioGroup
                value={form.watch('jenis_juara')}
                onValueChange={(value) =>
                  form.setValue('jenis_juara', value as JenisJuara, {
                    shouldValidate: true,
                  })
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
              {form.formState.errors.jenis_juara && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.jenis_juara.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Bidang</Label>
              <Combobox
                options={bidangOptions}
                value={form.watch('bidang_id')}
                onSelect={(value) =>
                  form.setValue('bidang_id', value, { shouldValidate: true })
                }
                onSearch={setBidangSearch}
                placeholder="Cari bidang..."
                isLoading={bidangSearchLoading}
              />
              {form.formState.errors.bidang_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.bidang_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Kategori</Label>
              <Combobox
                options={kategoriOptions}
                value={form.watch('kategori_id')}
                onSelect={(value) =>
                  form.setValue('kategori_id', value, {
                    shouldValidate: true,
                  })
                }
                onSearch={setKategoriSearch}
                placeholder="Cari kategori..."
                isLoading={kategoriSearchLoading}
              />
              {form.formState.errors.kategori_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.kategori_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tingkat Kejuaraan</Label>
              <Select
                value={form.watch('tingkat_kejuaraan')}
                onValueChange={(value) =>
                  form.setValue(
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
              {form.formState.errors.tingkat_kejuaraan && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.tingkat_kejuaraan.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeFormDialog}>
                Batal
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {isEditOpen ? 'Simpan' : 'Tambah'}
              </Button>
            </DialogFooter>
          </form>
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
