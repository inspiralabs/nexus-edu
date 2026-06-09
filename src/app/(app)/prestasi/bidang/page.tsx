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
  createBidang,
  deleteBidang,
  updateBidang,
} from '@/lib/queries/prestasi'
import { createClient } from '@/lib/supabase/client'
import type { Bidang } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50] as const

const bidangSchema = z.object({
  nama_bidang: z.string().min(1, 'Nama bidang wajib diisi'),
})

type BidangFormValues = z.infer<typeof bidangSchema>

async function fetchBidangList(): Promise<Bidang[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bidang')
    .select('*')
    .order('nama_bidang', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Bidang[]
}

function bidangToRecord(bidang: Bidang): Record<string, unknown> {
  return {
    id: bidang.id,
    nama_bidang: bidang.nama_bidang,
  }
}

function sortBidangData(
  data: Bidang[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): Bidang[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortField as keyof Bidang] ?? ''
    const bVal = b[sortField as keyof Bidang] ?? ''
    return String(aVal).localeCompare(String(bVal), 'id')
  })
  return sortDirection === 'asc' ? sorted : sorted.reverse()
}

export default function BidangPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sortField, setSortField] = useState('nama_bidang')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Bidang | null>(null)
  const [deletingItem, setDeletingItem] = useState<Bidang | null>(null)

  const { data: allData = [], isLoading } = useQuery({
    queryKey: ['bidang'],
    queryFn: fetchBidangList,
  })

  const sortedData = useMemo(
    () => sortBidangData(allData, sortField, sortDirection),
    [allData, sortField, sortDirection]
  )

  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return sortedData.slice(from, from + pageSize)
  }, [sortedData, page, pageSize])

  const form = useForm<BidangFormValues>({
    resolver: zodResolver(bidangSchema),
    defaultValues: { nama_bidang: '' },
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bidang'] })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (values: BidangFormValues) =>
      createBidang(values.nama_bidang),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'bidang',
          result.id,
          null,
          bidangToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Bidang berhasil ditambahkan',
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
      values: BidangFormValues
      oldItem: Bidang
    }) => updateBidang(id, values.nama_bidang),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'bidang',
          result.id,
          bidangToRecord(variables.oldItem),
          bidangToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Bidang berhasil diperbarui',
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
    mutationFn: (id: string) => deleteBidang(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(
          userId,
          'DELETE',
          'bidang',
          id,
          bidangToRecord(deletingItem),
          null
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Bidang berhasil dihapus',
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
    form.reset({ nama_bidang: '' })
    setIsFormOpen(true)
  }

  const openEditDialog = (item: Bidang) => {
    setEditingItem(item)
    form.reset({ nama_bidang: item.nama_bidang })
    setIsFormOpen(true)
  }

  const openDeleteDialog = (item: Bidang) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const onSubmit = (values: BidangFormValues) => {
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

  const columns = useMemo<ColumnDef<Bidang>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_bidang',
        header: 'Nama Bidang',
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
              aria-label="Edit bidang"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus bidang"
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
        title="Bidang"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Bidang
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
              {editingItem ? 'Edit Bidang' : 'Tambah Bidang'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nama_bidang">Nama Bidang</Label>
              <Input id="nama_bidang" {...form.register('nama_bidang')} />
              {form.formState.errors.nama_bidang && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_bidang.message}
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
        title="Hapus Bidang"
        description="Apakah Anda yakin ingin menghapus bidang ini? Tindakan ini tidak dapat dibatalkan."
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
