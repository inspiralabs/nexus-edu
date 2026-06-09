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
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit/log'
import {
  createKategoriDisiplin,
  deleteKategoriDisiplin,
  getKategoriDisiplin,
  updateKategoriDisiplin,
} from '@/lib/queries/kedisiplinan'
import type { KategoriDisiplin } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50] as const

const kategoriSchema = z.object({
  nama_kategori: z.string().min(1, 'Nama kategori wajib diisi'),
})

type KategoriFormValues = z.infer<typeof kategoriSchema>

function kategoriToRecord(
  kategori: KategoriDisiplin
): Record<string, unknown> {
  return {
    id: kategori.id,
    nama_kategori: kategori.nama_kategori,
  }
}

function sortKategoriData(
  data: KategoriDisiplin[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): KategoriDisiplin[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortField as keyof KategoriDisiplin] ?? ''
    const bVal = b[sortField as keyof KategoriDisiplin] ?? ''
    return String(aVal).localeCompare(String(bVal), 'id')
  })
  return sortDirection === 'asc' ? sorted : sorted.reverse()
}

export default function KategoriDisiplinPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sortField, setSortField] = useState('nama_kategori')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KategoriDisiplin | null>(null)
  const [deletingItem, setDeletingItem] = useState<KategoriDisiplin | null>(
    null
  )

  const { data: allData = [], isLoading } = useQuery({
    queryKey: ['kategori-disiplin'],
    queryFn: getKategoriDisiplin,
  })

  const sortedData = useMemo(
    () => sortKategoriData(allData, sortField, sortDirection),
    [allData, sortField, sortDirection]
  )

  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return sortedData.slice(from, from + pageSize)
  }, [sortedData, page, pageSize])

  const form = useForm<KategoriFormValues>({
    resolver: zodResolver(kategoriSchema),
    defaultValues: { nama_kategori: '' },
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['kategori-disiplin'] })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (values: KategoriFormValues) =>
      createKategoriDisiplin(values.nama_kategori),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'kategori_disiplin',
          result.id,
          null,
          kategoriToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Kategori berhasil ditambahkan',
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
      values: KategoriFormValues
      oldItem: KategoriDisiplin
    }) => updateKategoriDisiplin(id, values.nama_kategori),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'kategori_disiplin',
          result.id,
          kategoriToRecord(variables.oldItem),
          kategoriToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Kategori berhasil diperbarui',
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
    mutationFn: (id: string) => deleteKategoriDisiplin(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(
          userId,
          'DELETE',
          'kategori_disiplin',
          id,
          kategoriToRecord(deletingItem),
          null
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Kategori berhasil dihapus',
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
    form.reset({ nama_kategori: '' })
    setIsFormOpen(true)
  }

  const openEditDialog = (item: KategoriDisiplin) => {
    setEditingItem(item)
    form.reset({ nama_kategori: item.nama_kategori })
    setIsFormOpen(true)
  }

  const openDeleteDialog = (item: KategoriDisiplin) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const onSubmit = (values: KategoriFormValues) => {
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

  const columns = useMemo<ColumnDef<KategoriDisiplin>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_kategori',
        header: 'Nama Kategori',
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
              aria-label="Edit kategori"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus kategori"
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
        title="Kategori Disiplin"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Kategori
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
              {editingItem ? 'Edit Kategori' : 'Tambah Kategori'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nama_kategori">Nama Kategori</Label>
              <Input id="nama_kategori" {...form.register('nama_kategori')} />
              {form.formState.errors.nama_kategori && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_kategori.message}
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
        title="Hapus Kategori"
        description="Apakah Anda yakin ingin menghapus kategori ini? Tindakan ini tidak dapat dibatalkan."
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
