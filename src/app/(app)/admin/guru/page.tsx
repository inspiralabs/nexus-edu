'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, ExternalLink, Plus, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { Combobox } from '@/components/shared/combobox'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { Badge } from '@/components/ui/badge'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  createGuru,
  deleteGuru,
  getGuru,
  updateGuru,
  type CreateGuruInput,
} from '@/lib/queries/admin-extended'
import { getKamarOptions, getMataKuliah } from '@/lib/queries/students'
import type { Guru, JenisKelamin, MataPelajaran, TipeGuru, Unit } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const TIPE_GURU: TipeGuru[] = ['guru', 'musyrif', 'guru_musyrif']
const TIPE_GURU_LABEL: Record<TipeGuru, string> = {
  guru: 'Guru',
  musyrif: 'Musyrif/ah',
  guru_musyrif: 'Guru & Musyrif',
}

const guruSchema = z
  .object({
    nama_lengkap: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
    nip: z.string().optional(),
    jenis_kelamin: z.enum(['L', 'P']).optional(),
    tipe: z.enum(['guru', 'musyrif', 'guru_musyrif']),
    mapel_ids: z.array(z.string()).optional(),
    kamar_ids: z.array(z.string()).optional(),
    unit: z.array(z.string()).optional(),
    email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
    no_hp: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isGuru = data.tipe === 'guru' || data.tipe === 'guru_musyrif'
    const isMusyrif = data.tipe === 'musyrif' || data.tipe === 'guru_musyrif'

    if (isGuru && (!data.unit || data.unit.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pilih minimal 1 unit mengajar',
        path: ['unit'],
      })
    }

    if (data.tipe === 'musyrif' && (!data.unit || data.unit.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pilih minimal 1 unit (SD/SMP/SMA) untuk menampilkan kamar',
        path: ['unit'],
      })
    }

    if (isMusyrif && (!data.kamar_ids || data.kamar_ids.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pilih minimal 1 kamar yang dibina',
        path: ['kamar_ids'],
      })
    }
  })

type GuruFormValues = z.infer<typeof guruSchema>

function guruToRecord(item: Guru): Record<string, unknown> {
  return {
    id: item.id,
    nama_lengkap: item.nama_lengkap,
    nip: item.nip,
    jenis_kelamin: item.jenis_kelamin,
    tipe: item.tipe,
    mapel_ids: item.mapel_ids,
    kamar_ids: item.kamar_ids,
    unit: item.unit,
    email: item.email,
    no_hp: item.no_hp,
    profile_id: item.profile_id,
  }
}

interface ComboboxOption {
  value: string
  label: string
}

export default function GuruPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Guru | null>(null)
  const [deletingItem, setDeletingItem] = useState<Guru | null>(null)
  const [mapelSearch, setMapelSearch] = useState('')
  const [kamarSearch, setKamarSearch] = useState('')
  const [mengasuhLebihDari1Kamar, setMengasuhLebihDari1Kamar] = useState(false)

  const debouncedSearch = useDebounce(search, 300)
  const isFormOpen = isAddOpen || isEditOpen

  const form = useForm<GuruFormValues>({
    resolver: zodResolver(guruSchema),
    defaultValues: {
      nama_lengkap: '',
      nip: '',
      tipe: 'guru',
      mapel_ids: [],
      kamar_ids: [],
      unit: [],
      email: '',
      no_hp: '',
    },
  })

  const selectedTipe = form.watch('tipe')
  const selectedMapelIds = form.watch('mapel_ids') ?? []
  const selectedKamarIds = form.watch('kamar_ids') ?? []
  const selectedUnits = form.watch('unit') ?? []

  const isGuruRole = selectedTipe === 'guru' || selectedTipe === 'guru_musyrif'
  const isMusyrifRole = selectedTipe === 'musyrif' || selectedTipe === 'guru_musyrif'

  const queryFilters = useMemo(
    () => ({ search: debouncedSearch || undefined, page, pageSize }),
    [debouncedSearch, page, pageSize]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['guru', queryFilters],
    queryFn: () => getGuru(queryFilters),
  })

  const { data: allMapel = [] } = useQuery({
    queryKey: ['all-mapel-guru-table'],
    queryFn: () => getMataKuliah(['SD', 'SMP', 'SMA']),
  })

  const { data: mapelData = [], isLoading: isMapelLoading } = useQuery({
    queryKey: ['mapel-options-guru-admin', selectedUnits],
    queryFn: () => getMataKuliah(selectedUnits),
    enabled: isFormOpen && isGuruRole && selectedUnits.length > 0,
  })

  const kamarUnits = selectedUnits.length > 0 ? selectedUnits : undefined
  const { data: kamarData = [], isLoading: isKamarLoading } = useQuery({
    queryKey: ['kamar-options-guru-admin', kamarUnits, selectedTipe],
    queryFn: () => getKamarOptions(kamarUnits),
    enabled: isFormOpen && isMusyrifRole && selectedUnits.length > 0,
  })

  useEffect(() => {
    if (selectedTipe === 'musyrif') {
      form.setValue('mapel_ids', [])
    } else if (selectedTipe === 'guru') {
      form.setValue('kamar_ids', [])
    }
  }, [selectedTipe, form])

  const serializedUnits = selectedUnits.join(',')
  useEffect(() => {
    if (isGuruRole) {
      form.setValue('mapel_ids', [])
    }
    if (isMusyrifRole) {
      form.setValue('kamar_ids', [])
    }
  }, [serializedUnits, isGuruRole, isMusyrifRole, form])

  useEffect(() => {
    if (!mengasuhLebihDari1Kamar && selectedKamarIds.length > 1) {
      form.setValue('kamar_ids', [selectedKamarIds[0]], { shouldValidate: true })
    }
  }, [mengasuhLebihDari1Kamar, selectedKamarIds, form])

  const filteredMapel: MataPelajaran[] = useMemo(() => {
    if (!mapelSearch) return mapelData
    return mapelData.filter((m) =>
      m.nama_mapel.toLowerCase().includes(mapelSearch.toLowerCase())
    )
  }, [mapelData, mapelSearch])

  const mapelOptions: ComboboxOption[] = useMemo(
    () => filteredMapel.map((m) => ({ value: m.id, label: `${m.nama_mapel} (${m.unit})` })),
    [filteredMapel]
  )

  const filteredKamar = useMemo(() => {
    if (!kamarSearch) return kamarData
    return kamarData.filter((k) =>
      k.nama_kamar.toLowerCase().includes(kamarSearch.toLowerCase())
    )
  }, [kamarData, kamarSearch])

  const kamarOptions: ComboboxOption[] = useMemo(
    () =>
      filteredKamar.map((k) => ({
        value: k.id,
        label: k.unit ? `${k.nama_kamar} (${k.unit})` : k.nama_kamar,
      })),
    [filteredKamar]
  )

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['guru'] })
  }, [queryClient])

  const closeFormDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    setMengasuhLebihDari1Kamar(false)
    form.reset({
      nama_lengkap: '',
      nip: '',
      tipe: 'guru',
      mapel_ids: [],
      kamar_ids: [],
      unit: [],
      email: '',
      no_hp: '',
    })
    setMapelSearch('')
    setKamarSearch('')
  }

  const openAddDialog = () => {
    setEditingItem(null)
    setMengasuhLebihDari1Kamar(false)
    form.reset({
      nama_lengkap: '',
      nip: '',
      tipe: 'guru',
      mapel_ids: [],
      kamar_ids: [],
      unit: [],
      email: '',
      no_hp: '',
    })
    setIsAddOpen(true)
  }

  const openEditDialog = (item: Guru) => {
    setEditingItem(item)
    const kamarIds = item.kamar_ids ?? []
    setMengasuhLebihDari1Kamar(kamarIds.length > 1)
    form.reset({
      nama_lengkap: item.nama_lengkap,
      nip: item.nip ?? '',
      jenis_kelamin: (item.jenis_kelamin as JenisKelamin) ?? undefined,
      tipe: item.tipe,
      mapel_ids: item.mapel_ids ?? [],
      kamar_ids: kamarIds,
      unit: item.unit ?? [],
      email: item.email ?? '',
      no_hp: item.no_hp ?? '',
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (item: Guru) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const buildPayload = (values: GuruFormValues): CreateGuruInput => {
    const isGuru = values.tipe === 'guru' || values.tipe === 'guru_musyrif'
    const isMusyrif = values.tipe === 'musyrif' || values.tipe === 'guru_musyrif'

    return {
      nama_lengkap: values.nama_lengkap,
      nip: values.nip || undefined,
      jenis_kelamin: values.jenis_kelamin,
      tipe: values.tipe,
      unit: isGuru || isMusyrif ? values.unit ?? [] : [],
      mapel_ids: isGuru ? values.mapel_ids ?? [] : [],
      kamar_ids: isMusyrif ? values.kamar_ids ?? [] : [],
      email: values.email || undefined,
      no_hp: values.no_hp || undefined,
    }
  }

  const handleTipeChange = (value: TipeGuru) => {
    form.setValue('tipe', value, { shouldValidate: true })
    if (value === 'musyrif') {
      form.setValue('mapel_ids', [])
    } else if (value === 'guru') {
      form.setValue('kamar_ids', [])
      setMengasuhLebihDari1Kamar(false)
    }
  }

  const showUnitSection = isGuruRole || selectedTipe === 'musyrif'
  const unitSectionLabel =
    selectedTipe === 'musyrif' ? 'Unit Binaan' : 'Unit Mengajar'

  const createMutation = useMutation({
    mutationFn: (input: CreateGuruInput) => createGuru(input),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'guru', result.id, null, guruToRecord(result))
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Data guru berhasil ditambahkan' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values, oldItem }: { id: string; values: GuruFormValues; oldItem: Guru }) =>
      updateGuru(id, {
        ...buildPayload(values),
        profile_id: oldItem.profile_id,
      }).then((result) => ({ result, oldItem })),
    onSuccess: async ({ result, oldItem }) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'UPDATE', 'guru', result.id, guruToRecord(oldItem), guruToRecord(result))
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Data guru berhasil diperbarui' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGuru(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(userId, 'DELETE', 'guru', id, guruToRecord(deletingItem), null)
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Data guru berhasil dihapus' })
      setIsDeleteOpen(false)
      setDeletingItem(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (values: GuruFormValues) => {
    if (isEditOpen && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values, oldItem: editingItem })
    } else {
      createMutation.mutate(buildPayload(values))
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const toggleMapel = (mapelId: string) => {
    const current = selectedMapelIds
    const updated = current.includes(mapelId)
      ? current.filter((id) => id !== mapelId)
      : [...current, mapelId]
    form.setValue('mapel_ids', updated, { shouldValidate: true })
  }

  const toggleKamar = (kamarId: string) => {
    const current = selectedKamarIds
    let updated: string[]
    if (mengasuhLebihDari1Kamar) {
      updated = current.includes(kamarId)
        ? current.filter((id) => id !== kamarId)
        : [...current, kamarId]
    } else {
      updated = current.includes(kamarId) ? [] : [kamarId]
    }
    form.setValue('kamar_ids', updated, { shouldValidate: true })
  }

  const toggleUnit = (unit: string) => {
    const current = selectedUnits
    const updated = current.includes(unit)
      ? current.filter((u) => u !== unit)
      : [...current, unit]
    form.setValue('unit', updated, { shouldValidate: true })

    const currentMapelIds = form.getValues('mapel_ids') ?? []
    const updatedMapelIds = currentMapelIds.filter((id) => {
      const mapel = mapelData.find((m) => m.id === id)
      return mapel && updated.includes(mapel.unit)
    })
    form.setValue('mapel_ids', updatedMapelIds, { shouldValidate: true })
  }

  const columns = useMemo<ColumnDef<Guru>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_lengkap',
        header: 'Nama',
        cell: ({ row }) => (
          <span className="font-medium text-[var(--text-primary)]">
            {row.original.nama_lengkap}
          </span>
        ),
      },
      {
        accessorKey: 'nip',
        header: 'NIP',
        cell: ({ row }) => row.original.nip ?? '-',
      },
      {
        accessorKey: 'tipe',
        header: 'Tipe',
        cell: ({ row }) => TIPE_GURU_LABEL[row.original.tipe] ?? row.original.tipe,
      },
      {
        id: 'unit',
        header: 'Unit',
        enableSorting: false,
        cell: ({ row }) => {
          const unit = row.original.unit
          if (!unit || unit.length === 0) return '-'
          return unit.join(', ')
        },
      },
      {
        id: 'mata_pelajaran',
        header: 'Mata Pelajaran',
        enableSorting: false,
        cell: ({ row }) => {
          const mapelIds = row.original.mapel_ids
          if (!mapelIds || mapelIds.length === 0) return '-'
          const names = mapelIds
            .map((id) => allMapel.find((m) => m.id === id)?.nama_mapel)
            .filter((name): name is string => typeof name === 'string' && name.length > 0)
          if (names.length === 0) return '-'
          return names.join(', ')
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <span className="text-sm text-[var(--text-secondary)]">
            {row.original.email ?? '-'}
          </span>
        ),
      },
      {
        id: 'status_akun',
        header: 'Status Akun',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.profile_id ? (
            <Badge variant="default">Punya Akun</Badge>
          ) : (
            <Badge variant="outline">Belum Ada Akun</Badge>
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
              aria-label="Edit data guru"
            >
              <Edit className="h-4 w-4" />
            </Button>
            {!row.original.profile_id && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => window.open('/admin/users', '_blank')}
                aria-label="Buat akun untuk guru"
                title="Buat Akun"
              >
                <ExternalLink className="h-4 w-4 text-primary" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus data guru"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Guru"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Guru
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <Input
          id="search-guru"
          placeholder="Cari nama guru..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pagination={{ page, pageSize, total: data?.total ?? 0 }}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onSortChange={() => {}}
        isLoading={isLoading}
      />

      {/* Dialog Tambah/Edit */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) closeFormDialog()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditOpen ? 'Edit Data Guru' : 'Tambah Data Guru'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nama Lengkap */}
            <div className="space-y-2">
              <Label htmlFor="nama-guru">Nama Lengkap</Label>
              <Input
                id="nama-guru"
                {...form.register('nama_lengkap')}
                placeholder="Nama lengkap guru"
              />
              {form.formState.errors.nama_lengkap && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_lengkap.message}
                </p>
              )}
            </div>

            {/* NIP */}
            <div className="space-y-2">
              <Label htmlFor="nip-guru">NIP (opsional)</Label>
              <Input
                id="nip-guru"
                {...form.register('nip')}
                placeholder="Nomor Induk Pegawai"
              />
            </div>

            {/* Jenis Kelamin */}
            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <RadioGroup
                value={form.watch('jenis_kelamin') ?? ''}
                onValueChange={(value) =>
                  form.setValue('jenis_kelamin', value as JenisKelamin, { shouldValidate: true })
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="L" id="guru-jk-l" />
                  <Label htmlFor="guru-jk-l" className="font-normal">
                    Laki-laki
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="P" id="guru-jk-p" />
                  <Label htmlFor="guru-jk-p" className="font-normal">
                    Perempuan
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Tipe */}
            <div className="space-y-2">
              <Label htmlFor="tipe-guru">Tipe</Label>
              <Select value={selectedTipe} onValueChange={handleTipeChange}>
                <SelectTrigger id="tipe-guru">
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  {TIPE_GURU.map((tipe) => (
                    <SelectItem key={tipe} value={tipe}>
                      {TIPE_GURU_LABEL[tipe]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unit SD/SMP/SMA — Guru, Musyrif, atau keduanya */}
            {showUnitSection && (
              <div className="space-y-2">
                <Label>{unitSectionLabel}</Label>
                <div className="flex gap-4">
                  {UNITS.map((unit) => (
                    <div key={unit} className="flex items-center gap-2">
                      <Checkbox
                        id={`guru-unit-${unit}`}
                        checked={selectedUnits.includes(unit)}
                        onCheckedChange={() => toggleUnit(unit)}
                      />
                      <Label htmlFor={`guru-unit-${unit}`} className="font-normal">
                        {unit}
                      </Label>
                    </div>
                  ))}
                </div>
                {form.formState.errors.unit && (
                  <p className="text-xs text-status-red">
                    {form.formState.errors.unit.message}
                  </p>
                )}
              </div>
            )}

            {/* Mata Pelajaran — hanya Guru / Guru & Musyrif */}
            {isGuruRole && (
              <div className="space-y-2">
                <Label>Mata Pelajaran (opsional)</Label>
                {selectedUnits.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] italic">
                    Pilih unit mengajar terlebih dahulu untuk menampilkan daftar mata pelajaran.
                  </p>
                ) : (
                  <>
                    <div className="relative">
                      <Combobox
                        options={mapelOptions}
                        value=""
                        onSelect={(val) => toggleMapel(val)}
                        onSearch={setMapelSearch}
                        placeholder="Cari mata pelajaran..."
                        isLoading={isMapelLoading}
                      />
                    </div>
                    {mapelOptions.length > 0 ? (
                      <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-md border border-[var(--border)] p-2">
                        {mapelOptions.map((opt) => (
                          <div key={opt.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`mapel-${opt.value}`}
                              checked={selectedMapelIds.includes(opt.value)}
                              onCheckedChange={() => toggleMapel(opt.value)}
                            />
                            <Label htmlFor={`mapel-${opt.value}`} className="font-normal text-sm">
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      mapelSearch && (
                        <p className="text-xs text-status-red italic mt-2">
                          Mata pelajaran tidak ditemukan
                        </p>
                      )
                    )}
                    {selectedMapelIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedMapelIds.map((id) => {
                          const mapelObj = mapelData.find((m) => m.id === id) ?? allMapel.find((m) => m.id === id)
                          if (!mapelObj) return null
                          return (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="flex items-center gap-1.5 py-1 px-2.5 text-xs bg-[var(--surface-3)] hover:bg-[var(--surface-4)] text-[var(--text-primary)] border border-[var(--border)] font-normal rounded-md"
                            >
                              <span>
                                {mapelObj.nama_mapel} - {mapelObj.unit}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleMapel(id)}
                                className="rounded-full p-0.5 hover:bg-[var(--surface-4)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus:outline-none"
                                aria-label={`Hapus ${mapelObj.nama_mapel}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                    {selectedMapelIds.length > 0 && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {selectedMapelIds.length} mata pelajaran dipilih
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Kamar Diasuh — hanya Musyrif / Guru & Musyrif */}
            {isMusyrifRole && (
              <div className="space-y-3 border-t border-[var(--border)] pt-3">
                <div className="flex items-center justify-between">
                  <Label>Pilihan Kamar</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="multi-kamar-guru-admin"
                      checked={mengasuhLebihDari1Kamar}
                      onCheckedChange={(checked) => setMengasuhLebihDari1Kamar(!!checked)}
                    />
                    <Label htmlFor="multi-kamar-guru-admin" className="font-normal text-xs cursor-pointer">
                      Mengasuh lebih dari 1 kamar
                    </Label>
                  </div>
                </div>
                {selectedUnits.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] italic">
                    Pilih unit (SD/SMP/SMA) terlebih dahulu untuk menampilkan daftar kamar.
                  </p>
                ) : (
                  <>
                    <div className="relative">
                      <Combobox
                        options={kamarOptions}
                        value={selectedKamarIds[0] ?? ''}
                        onSelect={() => {}}
                        onSearch={setKamarSearch}
                        placeholder="Cari kamar..."
                        isLoading={isKamarLoading}
                        emptyMessage={
                          kamarSearch
                            ? 'Kamar tidak ditemukan'
                            : 'Belum ada kamar tersedia'
                        }
                      />
                    </div>
                    {kamarOptions.length > 0 ? (
                      <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-md border border-[var(--border)] p-2 bg-[var(--surface-2)]">
                        {kamarOptions.map((opt) => (
                          <div key={opt.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`kamar-guru-${opt.value}`}
                              checked={selectedKamarIds.includes(opt.value)}
                              onCheckedChange={() => toggleKamar(opt.value)}
                            />
                            <Label htmlFor={`kamar-guru-${opt.value}`} className="font-normal text-sm cursor-pointer">
                              {opt.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      kamarSearch && (
                        <p className="text-xs text-status-red italic mt-2">
                          Kamar tidak ditemukan
                        </p>
                      )
                    )}
                    {selectedKamarIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedKamarIds.map((id) => {
                          const kamarObj = kamarData.find((k) => k.id === id)
                          if (!kamarObj) return null
                          return (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="flex items-center gap-1.5 py-1 px-2.5 text-xs"
                            >
                              <span>{kamarObj.nama_kamar}</span>
                              <button
                                type="button"
                                onClick={() => toggleKamar(id)}
                                className="rounded-full p-0.5 hover:bg-[var(--surface-4)]"
                                aria-label={`Hapus ${kamarObj.nama_kamar}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                    {form.formState.errors.kamar_ids && (
                      <p className="text-xs text-status-red">
                        {form.formState.errors.kamar_ids.message}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email-guru">Email (opsional)</Label>
              <Input
                id="email-guru"
                {...form.register('email')}
                placeholder="email@guru.com"
                type="email"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* No HP */}
            <div className="space-y-2">
              <Label htmlFor="nohp-guru">No HP (opsional)</Label>
              <Input
                id="nohp-guru"
                {...form.register('no_hp')}
                placeholder="08xxxxxxxxxx"
              />
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

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Data Guru"
        description={`Apakah Anda yakin ingin menghapus data guru "${deletingItem?.nama_lengkap}"? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) deleteMutation.mutate(deletingItem.id)
        }}
      />
    </div>
  )
}
