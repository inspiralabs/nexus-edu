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
import { Checkbox } from '@/components/ui/checkbox'
import {
  createMapel,
  deleteMapel,
  getMapel,
  updateMapel,
  getAllKelas,
  type CreateMapelInput,
} from '@/lib/queries/admin-extended'
import type { MataPelajaran, Unit, Kelas } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

const mapelSchema = z.object({
  nama_mapel: z.string().min(2, 'Nama mata pelajaran minimal 2 karakter'),
  kategori: z.string().min(2, 'Kategori minimal 2 karakter'),
  unit: z.enum(['SD', 'SMP', 'SMA'], { message: 'Pilih unit' }),
  kelas_ids: z.array(z.string()).min(1, 'Minimal pilih satu kelas'),
})

type MapelFormValues = z.infer<typeof mapelSchema>

function mapelToRecord(item: MataPelajaran): Record<string, unknown> {
  return {
    id: item.id,
    nama_mapel: item.nama_mapel,
    kategori: item.kategori,
    unit: item.unit,
    kelas_ids: item.kelas_ids,
    created_at: item.created_at,
  }
}

export default function MapelPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MataPelajaran | null>(null)
  const [deletingItem, setDeletingItem] = useState<MataPelajaran | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const isFormOpen = isAddOpen || isEditOpen

  const form = useForm<MapelFormValues>({
    resolver: zodResolver(mapelSchema),
    defaultValues: { nama_mapel: '', kategori: '', unit: 'SD', kelas_ids: [] },
  })

  const queryFilters = useMemo(
    () => ({ unit: activeUnit, search: debouncedSearch || undefined, page, pageSize }),
    [activeUnit, debouncedSearch, page, pageSize]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['mapel', queryFilters],
    queryFn: () => getMapel(queryFilters),
  })

  const { data: allKelasList = [] } = useQuery({
    queryKey: ['all-kelas'],
    queryFn: () => getAllKelas(),
  })

  const watchedUnit = form.watch('unit')
  const formKelasList = useMemo(() => {
    return allKelasList.filter((k) => k.unit === watchedUnit)
  }, [allKelasList, watchedUnit])

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mapel'] })
  }, [queryClient])

  const closeFormDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    form.reset({ nama_mapel: '', kategori: '', unit: activeUnit, kelas_ids: [] })
  }

  const openAddDialog = () => {
    setEditingItem(null)
    form.reset({ nama_mapel: '', kategori: '', unit: activeUnit, kelas_ids: [] })
    setIsAddOpen(true)
  }

  const openEditDialog = (item: MataPelajaran) => {
    setEditingItem(item)
    form.reset({
      nama_mapel: item.nama_mapel,
      kategori: item.kategori,
      unit: item.unit,
      kelas_ids: item.kelas_ids || [],
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (item: MataPelajaran) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateMapelInput) => createMapel(input),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'mata_pelajaran', result.id, null, mapelToRecord(result))
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Mata pelajaran berhasil ditambahkan' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: MapelFormValues; oldItem: MataPelajaran }) =>
      updateMapel(id, values),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId, 'UPDATE', 'mata_pelajaran', result.id,
          mapelToRecord(variables.oldItem), mapelToRecord(result)
        )
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Mata pelajaran berhasil diperbarui' })
      closeFormDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMapel(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(userId, 'DELETE', 'mata_pelajaran', id, mapelToRecord(deletingItem), null)
      }
      invalidate()
      toast({ title: 'Berhasil', description: 'Mata pelajaran berhasil dihapus' })
      setIsDeleteOpen(false)
      setDeletingItem(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const onSubmit = (values: MapelFormValues) => {
    if (isEditOpen && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values, oldItem: editingItem })
    } else {
      createMutation.mutate(values)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const columns = useMemo<ColumnDef<MataPelajaran>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_mapel',
        header: 'Nama Mata Pelajaran',
        cell: ({ row }) => (
          <span className="font-medium text-[var(--text-primary)]">
            {row.original.nama_mapel}
          </span>
        ),
      },
      {
        id: 'kelas',
        header: 'Kelas',
        cell: ({ row }) => {
          const ids = row.original.kelas_ids || []
          const names = ids
            .map((id) => allKelasList.find((k) => k.id === id)?.nama_kelas)
            .filter(Boolean)
          return names.length > 0 ? names.join(', ') : '-'
        },
      },
      {
        accessorKey: 'kategori',
        header: 'Kategori',
        cell: ({ row }) => (
          <span className="text-sm text-[var(--text-secondary)]">
            {row.original.kategori}
          </span>
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
              aria-label="Edit mata pelajaran"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus mata pelajaran"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize, allKelasList]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mata Pelajaran"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Mapel
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
          placeholder="Cari nama mata pelajaran..."
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
            <DialogTitle>
              {isEditOpen ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama_mapel">Nama Mata Pelajaran</Label>
              <Input
                id="nama_mapel"
                {...form.register('nama_mapel')}
                placeholder="cth: Matematika, Tahfidz Al-Qur'an"
              />
              {form.formState.errors.nama_mapel && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_mapel.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kategori">Kategori</Label>
              <Input
                id="kategori"
                {...form.register('kategori')}
                placeholder="cth: DIKNAS SMA / KEPESANTRENAN SMP"
              />
              {form.formState.errors.kategori && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.kategori.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-mapel">Unit</Label>
              <Select
                value={form.watch('unit')}
                onValueChange={(value) => {
                  form.setValue('unit', value as Unit, { shouldValidate: true })
                  form.setValue('kelas_ids', [])
                }}
              >
                <SelectTrigger id="unit-mapel">
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
              <Label>Kelas (pilih minimal satu)</Label>
              {formKelasList.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 px-3 border border-dashed rounded-md text-center bg-muted/5">
                  Tidak ada data kelas untuk unit {watchedUnit}. Buat kelas terlebih dahulu.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 border border-border rounded-md p-3 max-h-[150px] overflow-y-auto bg-muted/5">
                  {formKelasList.map((kelas) => {
                    const currentIds = form.watch('kelas_ids') || []
                    const isChecked = currentIds.includes(kelas.id)
                    return (
                      <div key={kelas.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`kelas-${kelas.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              form.setValue('kelas_ids', [...currentIds, kelas.id], { shouldValidate: true })
                            } else {
                              form.setValue('kelas_ids', currentIds.filter((id) => id !== kelas.id), { shouldValidate: true })
                            }
                          }}
                        />
                        <Label
                          htmlFor={`kelas-${kelas.id}`}
                          className="text-sm font-normal cursor-pointer select-none text-foreground"
                        >
                          {kelas.nama_kelas}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              )}
              {form.formState.errors.kelas_ids && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.kelas_ids.message}
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
        title="Hapus Mata Pelajaran"
        description={`Apakah Anda yakin ingin menghapus "${deletingItem?.nama_mapel}"? Tindakan ini tidak dapat dibatalkan.`}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) deleteMutation.mutate(deletingItem.id)
        }}
      />
    </div>
  )
}
