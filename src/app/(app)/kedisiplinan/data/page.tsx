'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import {
  Edit,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
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
  bulkCreateKedisiplinan,
  createKedisiplinan,
  deleteKedisiplinan,
  getDivisi,
  getKategoriDisiplin,
  getKedisiplinan,
  searchDivisi,
  searchKategoriDisiplin,
  searchPasal,
  searchTindakan,
  updateKedisiplinan,
  type CreateKedisiplinanInput,
} from '@/lib/queries/kedisiplinan'
import { searchStudents } from '@/lib/queries/students'
import type {
  Kedisiplinan,
  Pasal,
  StatusKedisiplinan,
} from '@/lib/supabase/types'
import { formatDivisiLabel } from '@/lib/utils'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const
const STATUS_OPTIONS: StatusKedisiplinan[] = [
  'Belum Diproses',
  'Pending',
  'Sudah Diproses',
]

const kedisiplinanSchema = z.object({
  tanggal: z.date({ message: 'Tanggal wajib diisi' }),
  siswa_id: z.string().uuid('Pilih siswa'),
  kategori_id: z.string().uuid('Pilih kategori'),
  divisi_id: z.string().uuid('Pilih divisi'),
  pasal_id: z.string().uuid('Pilih pasal'),
  tindakan_id: z.string().uuid('Pilih tindakan'),
  status: z.enum(['Belum Diproses', 'Pending', 'Sudah Diproses']),
})

type KedisiplinanFormValues = z.infer<typeof kedisiplinanSchema>

interface KedisiplinanFilters {
  search: string
  status: 'all' | StatusKedisiplinan
  kategori_id: string
  divisi_id: string
}

interface ComboboxOption {
  value: string
  label: string
}

interface PendingBulkItem extends CreateKedisiplinanInput {
  localId: string
  siswaLabel: string
  kelas: string
}

function kedisiplinanToRecord(
  item: Kedisiplinan
): Record<string, unknown> {
  return {
    id: item.id,
    tanggal: item.tanggal,
    diberikan_oleh: item.diberikan_oleh,
    siswa_id: item.siswa_id,
    kategori_id: item.kategori_id,
    divisi_id: item.divisi_id,
    pasal_id: item.pasal_id,
    tindakan_id: item.tindakan_id,
    status: item.status,
    created_at: item.created_at,
  }
}

function formatTanggal(tanggal: string): string {
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return tanggal
  }
}

function getStatusVariant(
  status: StatusKedisiplinan
): 'destructive' | 'warning' | 'success' {
  if (status === 'Belum Diproses') return 'destructive'
  if (status === 'Pending') return 'warning'
  return 'success'
}

function formatPasalLabel(pasal: Pasal): string {
  return `${pasal.nama_pasal} (${pasal.poin})`
}

export default function KedisiplinanDataPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState('tanggal')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  const [filters, setFilters] = useState<KedisiplinanFilters>({
    search: '',
    status: 'all',
    kategori_id: 'all',
    divisi_id: 'all',
  })

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)

  const [editingItem, setEditingItem] = useState<Kedisiplinan | null>(null)
  const [deletingItem, setDeletingItem] = useState<Kedisiplinan | null>(null)
  const [bulkEditStatus, setBulkEditStatus] =
    useState<StatusKedisiplinan>('Belum Diproses')
  const [pendingBulkItems, setPendingBulkItems] = useState<PendingBulkItem[]>(
    []
  )

  const [kelasDisplay, setKelasDisplay] = useState('')

  const [studentSearch, setStudentSearch] = useState('')
  const [kategoriSearch, setKategoriSearch] = useState('')
  const [divisiSearch, setDivisiSearch] = useState('')
  const [pasalSearch, setPasalSearch] = useState('')
  const [tindakanSearch, setTindakanSearch] = useState('')

  const [studentOptions, setStudentOptions] = useState<ComboboxOption[]>([])
  const [kategoriOptions, setKategoriOptions] = useState<ComboboxOption[]>([])
  const [divisiOptions, setDivisiOptions] = useState<ComboboxOption[]>([])
  const [pasalOptions, setPasalOptions] = useState<ComboboxOption[]>([])
  const [tindakanOptions, setTindakanOptions] = useState<ComboboxOption[]>([])

  const debouncedSearch = useDebounce(filters.search, 300)
  const debouncedStudentSearch = useDebounce(studentSearch, 300)
  const debouncedKategoriSearch = useDebounce(kategoriSearch, 300)
  const debouncedDivisiSearch = useDebounce(divisiSearch, 300)
  const debouncedPasalSearch = useDebounce(pasalSearch, 300)
  const debouncedTindakanSearch = useDebounce(tindakanSearch, 300)

  const isFormOpen = isAddOpen || isEditOpen

  const form = useForm<KedisiplinanFormValues>({
    resolver: zodResolver(kedisiplinanSchema),
    defaultValues: {
      tanggal: new Date(),
      siswa_id: '',
      kategori_id: '',
      divisi_id: '',
      pasal_id: '',
      tindakan_id: '',
      status: 'Belum Diproses',
    },
  })

  const selectedKategoriId = form.watch('kategori_id')

  const queryFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status:
        filters.status !== 'all' ? [filters.status] : undefined,
      kategori_id:
        filters.kategori_id !== 'all' ? [filters.kategori_id] : undefined,
      divisi_id:
        filters.divisi_id !== 'all' ? [filters.divisi_id] : undefined,
      page,
      pageSize,
      sortField,
      sortDirection,
    }),
    [
      debouncedSearch,
      filters.status,
      filters.kategori_id,
      filters.divisi_id,
      page,
      pageSize,
      sortField,
      sortDirection,
    ]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['kedisiplinan', queryFilters],
    queryFn: () => getKedisiplinan(queryFilters),
  })

  const { data: kategoriFilterList = [] } = useQuery({
    queryKey: ['kategori-disiplin'],
    queryFn: getKategoriDisiplin,
  })

  const { data: divisiFilterList = [] } = useQuery({
    queryKey: ['divisi'],
    queryFn: () => getDivisi(),
  })

  const { isLoading: studentSearchLoading } = useQuery({
    queryKey: ['students-search', debouncedStudentSearch],
    queryFn: async () => {
      const results = await searchStudents(debouncedStudentSearch)
      setStudentOptions(
        results.map((s) => ({
          value: s.id,
          label: `${s.nama} - ${s.kelas}`,
        }))
      )
      return results
    },
    enabled: isFormOpen || isBulkAddOpen,
  })

  const { isLoading: kategoriSearchLoading } = useQuery({
    queryKey: ['kategori-search', debouncedKategoriSearch],
    queryFn: async () => {
      const results = await searchKategoriDisiplin(debouncedKategoriSearch)
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

  const { isLoading: divisiSearchLoading } = useQuery({
    queryKey: ['divisi-search', debouncedDivisiSearch],
    queryFn: async () => {
      const results = await searchDivisi(debouncedDivisiSearch)
      setDivisiOptions(
        results.map((d) => ({
          value: d.id,
          label: formatDivisiLabel(d.nama_divisi, d.unit),
        }))
      )
      return results
    },
    enabled: isFormOpen || isBulkAddOpen,
  })

  const { isLoading: pasalSearchLoading } = useQuery({
    queryKey: ['pasal-search', debouncedPasalSearch, selectedKategoriId],
    queryFn: async () => {
      if (!selectedKategoriId) return []
      const results = await searchPasal(
        debouncedPasalSearch,
        selectedKategoriId
      )
      setPasalOptions(
        results.map((p) => ({
          value: p.id,
          label: formatPasalLabel(p),
        }))
      )
      return results
    },
    enabled:
      (isFormOpen || isBulkAddOpen) && selectedKategoriId.length > 0,
  })

  const { isLoading: tindakanSearchLoading } = useQuery({
    queryKey: ['tindakan-search', debouncedTindakanSearch, selectedKategoriId],
    queryFn: async () => {
      if (!selectedKategoriId) return []
      const results = await searchTindakan(
        debouncedTindakanSearch,
        selectedKategoriId
      )
      setTindakanOptions(
        results.map((t) => ({
          value: t.id,
          label: t.nama_tindakan,
        }))
      )
      return results
    },
    enabled:
      (isFormOpen || isBulkAddOpen) && selectedKategoriId.length > 0,
  })

  const getUserId = (): string | null => profile?.user_id ?? null
  const diberikanOleh = profile?.nama_lengkap ?? ''

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kedisiplinan'] })
    queryClient.invalidateQueries({ queryKey: ['kedisiplinan-dashboard'] })
  }, [queryClient])

  const buildPayload = (
    values: KedisiplinanFormValues
  ): CreateKedisiplinanInput => ({
    tanggal: format(values.tanggal, 'yyyy-MM-dd'),
    diberikan_oleh: diberikanOleh,
    siswa_id: values.siswa_id,
    kategori_id: values.kategori_id,
    divisi_id: values.divisi_id,
    pasal_id: values.pasal_id,
    tindakan_id: values.tindakan_id,
    status: values.status,
  })

  const createMutation = useMutation({
    mutationFn: (values: KedisiplinanFormValues) =>
      createKedisiplinan(buildPayload(values)),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'kedisiplinan',
          result.id,
          null,
          kedisiplinanToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Data kedisiplinan berhasil ditambahkan',
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
      values: KedisiplinanFormValues
      oldItem: Kedisiplinan
    }) => updateKedisiplinan(id, buildPayload(values)),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'kedisiplinan',
          result.id,
          kedisiplinanToRecord(variables.oldItem),
          kedisiplinanToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Data kedisiplinan berhasil diperbarui',
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
    mutationFn: (ids: string[]) => deleteKedisiplinan(ids),
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
            'kedisiplinan',
            id,
            item ? kedisiplinanToRecord(item) : { id },
            null
          )
        }
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Data kedisiplinan berhasil dihapus',
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

  const bulkCreateMutation = useMutation({
    mutationFn: (items: CreateKedisiplinanInput[]) =>
      bulkCreateKedisiplinan(items),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const result of results) {
          await logAudit(
            userId,
            'CREATE',
            'kedisiplinan',
            result.id,
            null,
            kedisiplinanToRecord(result)
          )
        }
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: `${results.length} data kedisiplinan berhasil ditambahkan`,
      })
      setIsBulkAddOpen(false)
      setPendingBulkItems([])
      resetComboboxState()
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
      status,
      oldItems,
    }: {
      ids: string[]
      status: StatusKedisiplinan
      oldItems: Kedisiplinan[]
    }) => {
      const results = await Promise.all(
        ids.map((id) => updateKedisiplinan(id, { status }))
      )
      return { results, oldItems }
    },
    onSuccess: async ({ results, oldItems }) => {
      const userId = getUserId()
      if (userId) {
        for (let i = 0; i < results.length; i++) {
          await logAudit(
            userId,
            'UPDATE',
            'kedisiplinan',
            results[i].id,
            kedisiplinanToRecord(oldItems[i]),
            kedisiplinanToRecord(results[i])
          )
        }
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: `${results.length} data berhasil diperbarui`,
      })
      setIsBulkEditOpen(false)
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
    setKategoriSearch('')
    setDivisiSearch('')
    setPasalSearch('')
    setTindakanSearch('')
    setStudentOptions([])
    setKategoriOptions([])
    setDivisiOptions([])
    setPasalOptions([])
    setTindakanOptions([])
    setKelasDisplay('')
  }

  const resetFormDefaults = () => {
    form.reset({
      tanggal: new Date(),
      siswa_id: '',
      kategori_id: '',
      divisi_id: '',
      pasal_id: '',
      tindakan_id: '',
      status: 'Belum Diproses',
    })
  }

  const closeFormDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    resetFormDefaults()
    resetComboboxState()
  }

  const openAddDialog = () => {
    setEditingItem(null)
    resetFormDefaults()
    resetComboboxState()
    setIsAddOpen(true)
  }

  const openEditDialog = (item: Kedisiplinan) => {
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

    if (item.kategori_disiplin && item.kategori_id) {
      setKategoriOptions([
        {
          value: item.kategori_id,
          label: item.kategori_disiplin.nama_kategori,
        },
      ])
    }

    if (item.divisi && item.divisi_id) {
      setDivisiOptions([
        {
          value: item.divisi_id,
          label: formatDivisiLabel(
            item.divisi.nama_divisi,
            item.divisi.unit
          ),
        },
      ])
    }

    if (item.pasal && item.pasal_id) {
      setPasalOptions([
        {
          value: item.pasal_id,
          label: formatPasalLabel(item.pasal),
        },
      ])
    }

    if (item.tindakan && item.tindakan_id) {
      setTindakanOptions([
        {
          value: item.tindakan_id,
          label: item.tindakan.nama_tindakan,
        },
      ])
    }

    form.reset({
      tanggal: parseISO(item.tanggal),
      siswa_id: item.siswa_id ?? '',
      kategori_id: item.kategori_id ?? '',
      divisi_id: item.divisi_id ?? '',
      pasal_id: item.pasal_id ?? '',
      tindakan_id: item.tindakan_id ?? '',
      status: item.status,
    })
    setIsEditOpen(true)
  }

  const openSingleDelete = (item: Kedisiplinan) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const openBulkDelete = () => {
    setIsBulkDeleteOpen(true)
  }

  const openBulkEdit = () => {
    setBulkEditStatus('Belum Diproses')
    setIsBulkEditOpen(true)
  }

  const openBulkAdd = () => {
    resetFormDefaults()
    resetComboboxState()
    setPendingBulkItems([])
    setIsBulkAddOpen(true)
  }

  const onSubmitForm = (values: KedisiplinanFormValues) => {
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

  const addToBulkList = (values: KedisiplinanFormValues) => {
    const siswaLabel =
      studentOptions.find((o) => o.value === values.siswa_id)?.label ?? '-'

    setPendingBulkItems((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        ...buildPayload(values),
        siswaLabel,
        kelas: kelasDisplay,
      },
    ])
    resetFormDefaults()
    resetComboboxState()
    toast({
      title: 'Ditambahkan',
      description: 'Item ditambahkan ke daftar. Isi form untuk menambah lagi.',
    })
  }

  const handleBulkEditSubmit = () => {
    const oldItems =
      data?.data.filter((row) => selectedRows.includes(row.id)) ?? []
    bulkUpdateMutation.mutate({
      ids: selectedRows,
      status: bulkEditStatus,
      oldItems,
    })
  }

  const columns = useMemo<ColumnDef<Kedisiplinan>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'tanggal',
        header: 'Tanggal',
        cell: ({ row }) => formatTanggal(row.original.tanggal),
      },
      {
        accessorKey: 'diberikan_oleh',
        header: 'Diberikan Oleh',
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
        id: 'kategori',
        accessorKey: 'kategori_id',
        header: 'Kategori',
        cell: ({ row }) =>
          row.original.kategori_disiplin?.nama_kategori ?? '-',
      },
      {
        id: 'divisi',
        accessorKey: 'divisi_id',
        header: 'Divisi',
        cell: ({ row }) =>
          formatDivisiLabel(
            row.original.divisi?.nama_divisi,
            row.original.divisi?.unit
          ),
      },
      {
        id: 'pasal',
        accessorKey: 'pasal_id',
        header: 'Pasal',
        cell: ({ row }) =>
          row.original.pasal
            ? formatPasalLabel(row.original.pasal)
            : '-',
      },
      {
        id: 'tindakan',
        accessorKey: 'tindakan_id',
        header: 'Tindakan',
        cell: ({ row }) => row.original.tindakan?.nama_tindakan ?? '-',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={getStatusVariant(row.original.status)}>
            {row.original.status}
          </Badge>
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
              aria-label="Edit data kedisiplinan"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openSingleDelete(row.original)}
              aria-label="Hapus data kedisiplinan"
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

  const renderFormFields = (showAddToListButton = false) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tanggal</Label>
        <DatePicker
          value={form.watch('tanggal')}
          onChange={(date) => {
            if (date) {
              form.setValue('tanggal', date, { shouldValidate: true })
            }
          }}
        />
        {form.formState.errors.tanggal && (
          <p className="text-xs text-status-red">
            {form.formState.errors.tanggal.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="diberikan_oleh">Diberikan Oleh</Label>
        <Input
          id="diberikan_oleh"
          value={diberikanOleh}
          disabled
          readOnly
        />
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
        <Label>Kategori</Label>
        <Combobox
          options={kategoriOptions}
          value={form.watch('kategori_id')}
          onSelect={(value) => {
            form.setValue('kategori_id', value, { shouldValidate: true })
            form.setValue('pasal_id', '')
            form.setValue('tindakan_id', '')
            setPasalOptions([])
            setTindakanOptions([])
            setPasalSearch('')
            setTindakanSearch('')
          }}
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
        <Label>Divisi</Label>
        <Combobox
          options={divisiOptions}
          value={form.watch('divisi_id')}
          onSelect={(value) =>
            form.setValue('divisi_id', value, { shouldValidate: true })
          }
          onSearch={setDivisiSearch}
          placeholder="Cari divisi..."
          isLoading={divisiSearchLoading}
        />
        {form.formState.errors.divisi_id && (
          <p className="text-xs text-status-red">
            {form.formState.errors.divisi_id.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Pasal</Label>
        <Combobox
          options={pasalOptions}
          value={form.watch('pasal_id')}
          onSelect={(value) =>
            form.setValue('pasal_id', value, { shouldValidate: true })
          }
          onSearch={setPasalSearch}
          placeholder="Cari pasal..."
          disabled={!selectedKategoriId}
          isLoading={pasalSearchLoading}
        />
        {form.formState.errors.pasal_id && (
          <p className="text-xs text-status-red">
            {form.formState.errors.pasal_id.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tindakan</Label>
        <Combobox
          options={tindakanOptions}
          value={form.watch('tindakan_id')}
          onSelect={(value) =>
            form.setValue('tindakan_id', value, { shouldValidate: true })
          }
          onSearch={setTindakanSearch}
          placeholder="Cari tindakan..."
          disabled={!selectedKategoriId}
          isLoading={tindakanSearchLoading}
        />
        {form.formState.errors.tindakan_id && (
          <p className="text-xs text-status-red">
            {form.formState.errors.tindakan_id.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={form.watch('status')}
          onValueChange={(value) =>
            form.setValue('status', value as StatusKedisiplinan, {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Pilih status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.status && (
          <p className="text-xs text-status-red">
            {form.formState.errors.status.message}
          </p>
        )}
      </div>

      {showAddToListButton && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={form.handleSubmit(addToBulkList)}
        >
          Tambah ke Daftar
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Kedisiplinan"
        actions={
          <>
            <Button type="button" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Data
            </Button>
            <Button type="button" variant="outline" onClick={openBulkAdd}>
              <Upload className="mr-2 h-4 w-4" />
              Tambah Banyak
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Cari nama siswa..."
            value={filters.search}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, search: e.target.value }))
              setPage(1)
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(value) => {
            setFilters((prev) => ({
              ...prev,
              status: value as KedisiplinanFilters['status'],
            }))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.kategori_id}
          onValueChange={(value) => {
            setFilters((prev) => ({ ...prev, kategori_id: value }))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Semua Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {kategoriFilterList.map((kategori) => (
              <SelectItem key={kategori.id} value={kategori.id}>
                {kategori.nama_kategori}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.divisi_id}
          onValueChange={(value) => {
            setFilters((prev) => ({ ...prev, divisi_id: value }))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Semua Divisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Divisi</SelectItem>
            {divisiFilterList.map((divisi) => (
              <SelectItem key={divisi.id} value={divisi.id}>
                {formatDivisiLabel(divisi.nama_divisi, divisi.unit)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <span className="text-sm text-[var(--text-primary)]">
            {selectedRows.length} item terpilih
          </span>
          <Button type="button" variant="outline" size="sm" onClick={openBulkEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Terpilih
          </Button>
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
              {isEditOpen ? 'Edit Data Kedisiplinan' : 'Tambah Data Kedisiplinan'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmitForm)}
            className="space-y-4"
          >
            {renderFormFields()}
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

      <Dialog
        open={isBulkAddOpen}
        onOpenChange={(open) => {
          setIsBulkAddOpen(open)
          if (!open) {
            setPendingBulkItems([])
            resetFormDefaults()
            resetComboboxState()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Banyak Data Kedisiplinan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {renderFormFields(true)}

            {pendingBulkItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Daftar ({pendingBulkItems.length} item)
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Siswa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingBulkItems.map((item) => (
                      <TableRow key={item.localId}>
                        <TableCell>{formatTanggal(item.tanggal)}</TableCell>
                        <TableCell>{item.siswaLabel}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(item.status)}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setPendingBulkItems((prev) =>
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
              onClick={() => {
                setIsBulkAddOpen(false)
                setPendingBulkItems([])
                resetFormDefaults()
                resetComboboxState()
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              isLoading={bulkCreateMutation.isPending}
              disabled={pendingBulkItems.length === 0}
              onClick={() =>
                bulkCreateMutation.mutate(
                  pendingBulkItems.map(
                    ({ localId: _localId, siswaLabel: _siswaLabel, kelas: _kelas, ...payload }) =>
                      payload
                  )
                )
              }
            >
              Simpan Semua ({pendingBulkItems.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkEditOpen}
        onOpenChange={setIsBulkEditOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Terpilih</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Mengedit status {selectedRows.length} data terpilih
            </p>
            <div className="space-y-2">
              <Label>Status Baru</Label>
              <Select
                value={bulkEditStatus}
                onValueChange={(value) =>
                  setBulkEditStatus(value as StatusKedisiplinan)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkEditOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              isLoading={bulkUpdateMutation.isPending}
              onClick={handleBulkEditSubmit}
            >
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Data Kedisiplinan"
        description="Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan."
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
        title="Hapus Data Terpilih"
        description={`Apakah Anda yakin ingin menghapus ${selectedRows.length} data terpilih? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(selectedRows)}
      />
    </div>
  )
}
