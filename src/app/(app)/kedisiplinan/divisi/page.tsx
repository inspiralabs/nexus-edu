'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Plus, Trash2 } from 'lucide-react'
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
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit/log'
import {
  createDivisi,
  deleteDivisi,
  getDivisi,
  updateDivisi,
} from '@/lib/queries/kedisiplinan'
import type { Divisi, Unit } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

const divisiSchema = z.object({
  nama_divisi: z.string().min(1, 'Nama divisi wajib diisi'),
  unit: z.enum(['SD', 'SMP', 'SMA'], { message: 'Pilih unit' }),
})

type DivisiFormValues = z.infer<typeof divisiSchema>

function divisiToRecord(divisi: Divisi): Record<string, unknown> {
  return {
    id: divisi.id,
    nama_divisi: divisi.nama_divisi,
    unit: divisi.unit,
  }
}

function sortDivisiData(
  data: Divisi[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): Divisi[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortField as keyof Divisi] ?? ''
    const bVal = b[sortField as keyof Divisi] ?? ''
    return String(aVal).localeCompare(String(bVal), 'id')
  })
  return sortDirection === 'asc' ? sorted : sorted.reverse()
}

export default function DivisiPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sortField, setSortField] = useState('nama_divisi')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Divisi | null>(null)
  const [deletingItem, setDeletingItem] = useState<Divisi | null>(null)

  const { data: allData = [], isLoading } = useQuery({
    queryKey: ['divisi'],
    queryFn: () => getDivisi(),
  })

  const sortedData = useMemo(
    () => sortDivisiData(allData, sortField, sortDirection),
    [allData, sortField, sortDirection]
  )

  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return sortedData.slice(from, from + pageSize)
  }, [sortedData, page, pageSize])

  const form = useForm<DivisiFormValues>({
    resolver: zodResolver(divisiSchema),
    defaultValues: { nama_divisi: '', unit: 'SD' },
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['divisi'] })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (values: DivisiFormValues) => createDivisi(values),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'divisi',
          result.id,
          null,
          divisiToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Divisi berhasil ditambahkan',
      })
      setIsFormOpen(false)
      form.reset()
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
      values: DivisiFormValues
      oldItem: Divisi
    }) => updateDivisi(id, values),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'divisi',
          result.id,
          divisiToRecord(variables.oldItem),
          divisiToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Divisi berhasil diperbarui',
      })
      setIsFormOpen(false)
      setEditingItem(null)
      form.reset()
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
    mutationFn: (id: string) => deleteDivisi(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(
          userId,
          'DELETE',
          'divisi',
          id,
          divisiToRecord(deletingItem),
          null
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Divisi berhasil dihapus',
      })
      setIsDeleteOpen(false)
      setDeletingItem(null)
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const openAddDialog = () => {
    setEditingItem(null)
    form.reset({ nama_divisi: '', unit: 'SD' })
    setIsFormOpen(true)
  }

  const openEditDialog = (item: Divisi) => {
    setEditingItem(item)
    form.reset({
      nama_divisi: item.nama_divisi,
      unit: item.unit ?? 'SD',
    })
    setIsFormOpen(true)
  }

  const openDeleteDialog = (item: Divisi) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const onSubmit = (values: DivisiFormValues) => {
    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        values,
        oldItem: editingItem,
      })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = useMemo<ColumnDef<Divisi>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_divisi',
        header: 'Nama Divisi',
      },
      {
        accessorKey: 'unit',
        header: 'Unit',
        cell: ({ row }) => row.original.unit ?? '-',
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
              aria-label="Edit divisi"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus divisi"
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
        title="Divisi"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Divisi
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={paginatedData}
        pagination={{
          page,
          pageSize,
          total: sortedData.length,
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
        isLoading={isLoading}
      />

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) {
            setEditingItem(null)
            form.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Divisi' : 'Tambah Divisi'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nama_divisi">Nama Divisi</Label>
              <Input id="nama_divisi" {...form.register('nama_divisi')} />
              {form.formState.errors.nama_divisi && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_divisi.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={form.watch('unit')}
                onValueChange={(value) =>
                  form.setValue('unit', value as Unit, {
                    shouldValidate: true,
                  })
                }
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFormOpen(false)
                  setEditingItem(null)
                  form.reset()
                }}
              >
                Batal
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {editingItem ? 'Simpan' : 'Tambah'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Divisi"
        description="Apakah Anda yakin ingin menghapus divisi ini? Tindakan ini tidak dapat dibatalkan."
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingItem) {
            deleteMutation.mutate(deletingItem.id)
          }
        }}
      />
    </div>
  )
}
