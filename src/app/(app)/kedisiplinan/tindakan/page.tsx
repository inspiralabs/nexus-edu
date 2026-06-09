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
  createTindakan,
  deleteTindakan,
  getKategoriDisiplin,
  getTindakanByKategori,
  updateTindakan,
} from '@/lib/queries/kedisiplinan'
import type { Tindakan } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50] as const

const tindakanSchema = z.object({
  nama_tindakan: z.string().min(1, 'Nama tindakan wajib diisi'),
  kategori_id: z.string().min(1, 'Pilih kategori'),
})

type TindakanFormValues = z.infer<typeof tindakanSchema>

interface TindakanRow extends Tindakan {
  nama_kategori: string
}

function tindakanToRecord(tindakan: Tindakan): Record<string, unknown> {
  return {
    id: tindakan.id,
    nama_tindakan: tindakan.nama_tindakan,
    kategori_id: tindakan.kategori_id,
  }
}

function sortTindakanData(
  data: TindakanRow[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): TindakanRow[] {
  const sorted = [...data].sort((a, b) => {
    const aVal =
      sortField === 'nama_kategori'
        ? a.nama_kategori
        : String(a[sortField as keyof TindakanRow] ?? '')
    const bVal =
      sortField === 'nama_kategori'
        ? b.nama_kategori
        : String(b[sortField as keyof TindakanRow] ?? '')
    return String(aVal).localeCompare(String(bVal), 'id')
  })
  return sortDirection === 'asc' ? sorted : sorted.reverse()
}

export default function TindakanPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sortField, setSortField] = useState('nama_tindakan')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Tindakan | null>(null)
  const [deletingItem, setDeletingItem] = useState<Tindakan | null>(null)

  const { data: kategoriList = [] } = useQuery({
    queryKey: ['kategori-disiplin'],
    queryFn: getKategoriDisiplin,
  })

  const { data: allData = [], isLoading } = useQuery({
    queryKey: ['tindakan', kategoriList.map((k) => k.id)],
    queryFn: async () => {
      if (kategoriList.length === 0) return [] as TindakanRow[]
      const map = new Map(
        kategoriList.map((kategori) => [kategori.id, kategori.nama_kategori])
      )
      const results = await Promise.all(
        kategoriList.map((kategori) => getTindakanByKategori(kategori.id))
      )
      return results.flat().map((tindakan) => ({
        ...tindakan,
        nama_kategori: map.get(tindakan.kategori_id ?? '') ?? '-',
      }))
    },
    enabled: kategoriList.length > 0,
  })

  const sortedData = useMemo(
    () => sortTindakanData(allData, sortField, sortDirection),
    [allData, sortField, sortDirection]
  )

  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return sortedData.slice(from, from + pageSize)
  }, [sortedData, page, pageSize])

  const form = useForm<TindakanFormValues>({
    resolver: zodResolver(tindakanSchema),
    defaultValues: { nama_tindakan: '', kategori_id: '' },
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tindakan'] })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (values: TindakanFormValues) => createTindakan(values),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'tindakan',
          result.id,
          null,
          tindakanToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Tindakan berhasil ditambahkan',
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
      values: TindakanFormValues
      oldItem: Tindakan
    }) => updateTindakan(id, values),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'tindakan',
          result.id,
          tindakanToRecord(variables.oldItem),
          tindakanToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Tindakan berhasil diperbarui',
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
    mutationFn: (id: string) => deleteTindakan(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(
          userId,
          'DELETE',
          'tindakan',
          id,
          tindakanToRecord(deletingItem),
          null
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Tindakan berhasil dihapus',
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
    form.reset({
      nama_tindakan: '',
      kategori_id: kategoriList[0]?.id ?? '',
    })
    setIsFormOpen(true)
  }

  const openEditDialog = (item: TindakanRow) => {
    setEditingItem(item)
    form.reset({
      nama_tindakan: item.nama_tindakan,
      kategori_id: item.kategori_id ?? '',
    })
    setIsFormOpen(true)
  }

  const openDeleteDialog = (item: TindakanRow) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const onSubmit = (values: TindakanFormValues) => {
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

  const columns = useMemo<ColumnDef<TindakanRow>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_tindakan',
        header: 'Nama Tindakan',
      },
      {
        accessorKey: 'nama_kategori',
        header: 'Kategori',
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
              aria-label="Edit tindakan"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus tindakan"
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
        title="Tindakan"
        actions={
          <Button
            type="button"
            onClick={openAddDialog}
            disabled={kategoriList.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Tindakan
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
              {editingItem ? 'Edit Tindakan' : 'Tambah Tindakan'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nama_tindakan">Nama Tindakan</Label>
              <Input id="nama_tindakan" {...form.register('nama_tindakan')} />
              {form.formState.errors.nama_tindakan && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_tindakan.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={form.watch('kategori_id')}
                onValueChange={(value) =>
                  form.setValue('kategori_id', value, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {kategoriList.map((kategori) => (
                    <SelectItem key={kategori.id} value={kategori.id}>
                      {kategori.nama_kategori}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.kategori_id && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.kategori_id.message}
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
        title="Hapus Tindakan"
        description="Apakah Anda yakin ingin menghapus tindakan ini? Tindakan ini tidak dapat dibatalkan."
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
