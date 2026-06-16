'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
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
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  createOrangTua,
  deleteOrangTua,
  getOrangTua,
  updateOrangTua,
  type CreateOrangTuaInput,
} from '@/lib/queries/admin-extended'
import { searchStudents } from '@/lib/queries/students'
import type { OrangTua } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const

const orangTuaSchema = z.object({
  nama_lengkap: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  pekerjaan: z.string().optional(),
  email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  no_hp: z.string().optional(),
  siswa_ids: z.array(z.string()),
})

type OrangTuaFormValues = z.infer<typeof orangTuaSchema>

interface ComboboxOption {
  value: string
  label: string
}

function orangTuaToRecord(item: OrangTua): Record<string, unknown> {
  return {
    id: item.id,
    nama_lengkap: item.nama_lengkap,
    pekerjaan: item.pekerjaan,
    email: item.email,
    no_hp: item.no_hp,
    profile_id: item.profile_id,
  }
}

export default function OrangTuaPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OrangTua | null>(null)
  const [deletingItem, setDeletingItem] = useState<OrangTua | null>(null)

  const [siswaSearch, setSiswaSearch] = useState('')
  const [siswaOptions, setSiswaOptions] = useState<ComboboxOption[]>([])

  const debouncedSearch = useDebounce(search, 300)
  const debouncedSiswaSearch = useDebounce(siswaSearch, 300)
  const isFormOpen = isAddOpen || isEditOpen

  const form = useForm<OrangTuaFormValues>({
    resolver: zodResolver(orangTuaSchema),
    defaultValues: {
      nama_lengkap: '',
      pekerjaan: '',
      email: '',
      no_hp: '',
      siswa_ids: [],
    },
  })

  const selectedSiswaIds = form.watch('siswa_ids') ?? []

  const queryFilters = useMemo(
    () => ({ search: debouncedSearch || undefined, page, pageSize }),
    [debouncedSearch, page, pageSize]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['orangtua', queryFilters],
    queryFn: () => getOrangTua(queryFilters),
  })

  const { isLoading: siswaSearchLoading } = useQuery({
    queryKey: ['students-search-ortu', debouncedSiswaSearch],
    queryFn: async () => {
      // Search semua unit
      const [sd, smp, sma] = await Promise.all([
        searchStudents(debouncedSiswaSearch, 'SD'),
        searchStudents(debouncedSiswaSearch, 'SMP'),
        searchStudents(debouncedSiswaSearch, 'SMA'),
      ])
      const all = [...sd, ...smp, ...sma]
      setSiswaOptions(
        all.map((s) => ({
          value: s.id,
          label: `${s.nama} - ${s.kelas} (${s.unit})`,
        }))
      )
      return all
    },
    enabled: isFormOpen,
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['orangtua'] })
  }, [queryClient])

  const closeFormDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    form.reset({ nama_lengkap: '', pekerjaan: '', email: '', no_hp: '', siswa_ids: [] })
    setSiswaSearch('')
    setSiswaOptions([])
  }

  const openAddDialog = () => {
    setEditingItem(null)
    form.reset({ nama_lengkap: '', pekerjaan: '', email: '', no_hp: '', siswa_ids: [] })
    setIsAddOpen(true)
  }

  const openEditDialog = (item: OrangTua) => {
    setEditingItem(item)
    const currentSiswaIds = (item.orangtua_siswa ?? []).map((os) => os.siswa_id)
    // Pre-populate siswa options for edit
    const preloadedOptions = (item.orangtua_siswa ?? [])
      .filter((os) => os.students)
      .map((os) => ({
        value: os.siswa_id,
        label: `${os.students?.nama} - ${os.students?.kelas} (${os.students?.unit})`,
      }))
    setSiswaOptions(preloadedOptions)

    form.reset({
      nama_lengkap: item.nama_lengkap,
      pekerjaan: item.pekerjaan ?? '',
      email: item.email ?? '',
      no_hp: item.no_hp ?? '',
      siswa_ids: currentSiswaIds,
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (item: OrangTua) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const buildPayload = (values: OrangTuaFormValues): CreateOrangTuaInput => ({
    nama_lengkap: values.nama_lengkap,
    pekerjaan: values.pekerjaan || undefined,
    email: values.email || undefined,
    no_hp: values.no_hp || undefined,
    siswa_ids: values.siswa_ids,
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateOrangTuaInput) => createOrangTua(input),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'orangtua', result.id, null, orangTuaToRecord(result))
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Data orang tua berhasil ditambahkan' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values, oldItem }: { id: string; values: OrangTuaFormValues; oldItem: OrangTua }) =>
      updateOrangTua(id, buildPayload(values)).then((result) => ({ result, oldItem })),
    onSuccess: async ({ result, oldItem }) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId, 'UPDATE', 'orangtua', result.id,
          orangTuaToRecord(oldItem), orangTuaToRecord(result)
        )
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Data orang tua berhasil diperbarui' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteOrangTua(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(userId, 'DELETE', 'orangtua', id, orangTuaToRecord(deletingItem), null)
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Data orang tua berhasil dihapus' })
      setIsDeleteOpen(false)
      setDeletingItem(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (values: OrangTuaFormValues) => {
    if (isEditOpen && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values, oldItem: editingItem })
    } else {
      createMutation.mutate(buildPayload(values))
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const toggleSiswa = (siswaId: string) => {
    const current = selectedSiswaIds
    const updated = current.includes(siswaId)
      ? current.filter((id) => id !== siswaId)
      : [...current, siswaId]
    form.setValue('siswa_ids', updated, { shouldValidate: true })
  }

  const columns = useMemo<ColumnDef<OrangTua>[]>(
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
        accessorKey: 'pekerjaan',
        header: 'Pekerjaan',
        cell: ({ row }) => (
          <span className="text-sm text-[var(--text-secondary)]">
            {row.original.pekerjaan ?? '-'}
          </span>
        ),
      },
      {
        id: 'nama_anak',
        header: 'Nama Anak',
        enableSorting: false,
        cell: ({ row }) => {
          const anak = row.original.orangtua_siswa ?? []
          if (anak.length === 0) return <span className="text-[var(--text-tertiary)]">-</span>
          return (
            <div className="space-y-0.5">
              {anak.map((os) => (
                <p key={os.id} className="text-sm text-[var(--text-secondary)]">
                  {os.students?.nama} ({os.students?.kelas})
                </p>
              ))}
            </div>
          )
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
              aria-label="Edit data orang tua"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus data orang tua"
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
        title="Data Orang Tua"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Orang Tua
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <Input
          id="search-orangtua"
          placeholder="Cari nama orang tua..."
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
              {isEditOpen ? 'Edit Data Orang Tua' : 'Tambah Data Orang Tua'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nama Lengkap */}
            <div className="space-y-2">
              <Label htmlFor="nama-ortu">Nama Lengkap</Label>
              <Input
                id="nama-ortu"
                {...form.register('nama_lengkap')}
                placeholder="Nama lengkap orang tua"
              />
              {form.formState.errors.nama_lengkap && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_lengkap.message}
                </p>
              )}
            </div>

            {/* Pekerjaan */}
            <div className="space-y-2">
              <Label htmlFor="pekerjaan-ortu">Pekerjaan (opsional)</Label>
              <Input
                id="pekerjaan-ortu"
                {...form.register('pekerjaan')}
                placeholder="cth: Wiraswasta, PNS, TNI"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email-ortu">Email (opsional)</Label>
              <Input
                id="email-ortu"
                {...form.register('email')}
                placeholder="email@contoh.com"
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
              <Label htmlFor="nohp-ortu">No HP (opsional)</Label>
              <Input
                id="nohp-ortu"
                {...form.register('no_hp')}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            {/* Anak (multi-select) */}
            <div className="space-y-2">
              <Label>Anak yang Dipantau</Label>
              <Combobox
                options={siswaOptions}
                value={selectedSiswaIds[0] ?? ''}
                onSelect={() => {}}
                onSearch={setSiswaSearch}
                placeholder="Cari nama siswa..."
                isLoading={siswaSearchLoading}
              />
              {siswaOptions.length > 0 && (
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-[var(--border)] p-2">
                  {siswaOptions.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`siswa-${opt.value}`}
                        checked={selectedSiswaIds.includes(opt.value)}
                        onCheckedChange={() => toggleSiswa(opt.value)}
                      />
                      <Label
                        htmlFor={`siswa-${opt.value}`}
                        className="font-normal text-sm"
                      >
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
              {selectedSiswaIds.length > 0 && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedSiswaIds.length} anak dipilih
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

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Data Orang Tua"
        description={`Apakah Anda yakin ingin menghapus data orang tua "${deletingItem?.nama_lengkap}"? Relasi dengan siswa juga akan dihapus.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) deleteMutation.mutate(deletingItem.id)
        }}
      />
    </div>
  )
}
