'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  createKamar,
  deleteKamar,
  getKamar,
  getMusyrifOptions,
  updateKamar,
  type CreateKamarInput,
} from '@/lib/queries/kamar'
import type { Kamar, Unit } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

const kamarSchema = z.object({
  nama_kamar: z.string().min(2, 'Nama kamar minimal 2 karakter'),
  unit: z.enum(['SD', 'SMP', 'SMA'], { message: 'Pilih unit' }),
  musyrif_id: z.string().uuid().nullable().optional().or(z.literal('')),
})

type KamarFormValues = z.infer<typeof kamarSchema>

function kamarToRecord(item: Kamar): Record<string, unknown> {
  return {
    id: item.id,
    nama_kamar: item.nama_kamar,
    musyrif_id: item.musyrif_id,
    unit: item.unit,
    created_at: item.created_at,
  }
}

export default function KamarPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Kamar | null>(null)
  const [deletingItem, setDeletingItem] = useState<Kamar | null>(null)

  const debouncedSearch = useDebounce(search, 300)
  const isFormOpen = isAddOpen || isEditOpen

  const form = useForm<KamarFormValues>({
    resolver: zodResolver(kamarSchema),
    defaultValues: { nama_kamar: '', unit: 'SD', musyrif_id: '' },
  })

  const queryFilters = useMemo(
    () => ({ unit: activeUnit, search: debouncedSearch || undefined, page, pageSize }),
    [activeUnit, debouncedSearch, page, pageSize]
  )

  // Fetch rooms list
  const { data, isLoading } = useQuery({
    queryKey: ['kamar', queryFilters],
    queryFn: () => getKamar(queryFilters),
  })

  // Fetch Musyrif profiles for select dropdown
  const { data: musyrifOptions = [], isLoading: isMusyrifLoading } = useQuery({
    queryKey: ['musyrif-options-kamar'],
    queryFn: () => getMusyrifOptions(),
    enabled: isFormOpen,
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kamar'] })
  }, [queryClient])

  const closeFormDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    form.reset({ nama_kamar: '', unit: activeUnit, musyrif_id: '' })
  }

  const openAddDialog = () => {
    setEditingItem(null)
    form.reset({ nama_kamar: '', unit: activeUnit, musyrif_id: '' })
    setIsAddOpen(true)
  }

  const openEditDialog = (item: Kamar) => {
    setEditingItem(item)
    form.reset({
      nama_kamar: item.nama_kamar,
      unit: item.unit,
      musyrif_id: item.musyrif_id ?? '',
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (item: Kamar) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateKamarInput) => createKamar(input),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'kamar', result.id, null, kamarToRecord(result))
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Data kamar berhasil ditambahkan' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CreateKamarInput }) =>
      updateKamar(id, values),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId && editingItem) {
        await logAudit(
          userId,
          'UPDATE',
          'kamar',
          result.id,
          kamarToRecord(editingItem),
          kamarToRecord(result)
        )
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Data kamar berhasil diperbarui' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKamar(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(userId, 'DELETE', 'kamar', id, kamarToRecord(deletingItem), null)
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Data kamar berhasil dihapus' })
      setIsDeleteOpen(false)
      setDeletingItem(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (values: KamarFormValues) => {
    const payload: CreateKamarInput = {
      nama_kamar: values.nama_kamar,
      unit: values.unit,
      musyrif_id: values.musyrif_id && values.musyrif_id !== '' ? values.musyrif_id : null,
    }

    if (isEditOpen && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const columns = useMemo<ColumnDef<Kamar>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_kamar',
        header: 'Nama Kamar / Asrama',
        cell: ({ row }) => (
          <span className="font-semibold text-[var(--text-primary)]">
            {row.original.nama_kamar}
          </span>
        ),
      },
      {
        id: 'musyrif',
        header: 'Musyrif / Musyrifah',
        cell: ({ row }) => {
          const profile = row.original.profiles
          return profile ? (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {profile.nama_lengkap}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                @{profile.username}
              </span>
            </div>
          ) : (
            <span className="text-xs text-[var(--text-tertiary)] italic">Belum ada musyrif</span>
          )
        },
      },
      {
        accessorKey: 'unit',
        header: 'Unit',
        cell: ({ row }) => row.original.unit,
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
              aria-label="Edit data kamar"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus data kamar"
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
        title="Manajemen Kamar"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Kamar
          </Button>
        }
      />

      <Tabs
        value={activeUnit}
        onValueChange={(value) => {
          setActiveUnit(value as Unit)
          setPage(1)
        }}
      >
        <TabsList>
          {UNITS.map((unit) => (
            <TabsTrigger key={unit} value={unit}>
              {unit}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <Input
          placeholder="Cari nama kamar..."
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Data Kamar' : 'Tambah Kamar Baru'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nama Kamar */}
            <div className="space-y-2">
              <Label htmlFor="nama_kamar">Nama Kamar</Label>
              <Input
                id="nama_kamar"
                {...form.register('nama_kamar')}
                placeholder="cth: Al-Fatih, Maryam 1"
              />
              {form.formState.errors.nama_kamar && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_kamar.message}
                </p>
              )}
            </div>

            {/* Unit */}
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select
                value={form.watch('unit')}
                onValueChange={(value) =>
                  form.setValue('unit', value as Unit, { shouldValidate: true })
                }
              >
                <SelectTrigger id="unit">
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
                <p className="text-xs text-status-red">{form.formState.errors.unit.message}</p>
              )}
            </div>

            {/* Musyrif (Select/Combobox) */}
            <div className="space-y-2">
              <Label htmlFor="musyrif_id">Musyrif / Musyrifah (opsional)</Label>
              <Select
                value={form.watch('musyrif_id') || 'none'}
                onValueChange={(value) =>
                  form.setValue('musyrif_id', value === 'none' ? '' : value, {
                    shouldValidate: true,
                  })
                }
                disabled={isMusyrifLoading}
              >
                <SelectTrigger id="musyrif_id">
                  <SelectValue placeholder="Pilih musyrif" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ada musyrif/ah</SelectItem>
                  {musyrifOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.nama_lengkap} (@{opt.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.musyrif_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.musyrif_id.message}
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
        title="Hapus Data Kamar"
        description={`Apakah Anda yakin ingin menghapus kamar "${deletingItem?.nama_kamar}"? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) deleteMutation.mutate(deletingItem.id)
        }}
      />
    </div>
  )
}
