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
  createJuara,
  deleteJuara,
  updateJuara,
} from '@/lib/queries/prestasi'
import { createClient } from '@/lib/supabase/client'
import type { Juara } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50] as const

const juaraSchema = z.object({
  nama_juara: z.string().min(1, 'Nama juara wajib diisi'),
})

type JuaraFormValues = z.infer<typeof juaraSchema>

async function fetchJuaraList(): Promise<Juara[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('juara')
    .select('*')
    .order('nama_juara', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Juara[]
}

function juaraToRecord(juara: Juara): Record<string, unknown> {
  return {
    id: juara.id,
    nama_juara: juara.nama_juara,
  }
}

function sortJuaraData(
  data: Juara[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): Juara[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortField as keyof Juara] ?? ''
    const bVal = b[sortField as keyof Juara] ?? ''
    return String(aVal).localeCompare(String(bVal), 'id')
  })
  return sortDirection === 'asc' ? sorted : sorted.reverse()
}

export default function JuaraPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sortField, setSortField] = useState('nama_juara')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Juara | null>(null)
  const [deletingItem, setDeletingItem] = useState<Juara | null>(null)

  const { data: allData = [], isLoading } = useQuery({
    queryKey: ['juara'],
    queryFn: fetchJuaraList,
  })

  const sortedData = useMemo(
    () => sortJuaraData(allData, sortField, sortDirection),
    [allData, sortField, sortDirection]
  )

  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return sortedData.slice(from, from + pageSize)
  }, [sortedData, page, pageSize])

  const form = useForm<JuaraFormValues>({
    resolver: zodResolver(juaraSchema),
    defaultValues: { nama_juara: '' },
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['juara'] })
    queryClient.invalidateQueries({ queryKey: ['juara-list'] })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (values: JuaraFormValues) =>
      createJuara(values.nama_juara),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'juara',
          result.id,
          null,
          juaraToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Juara berhasil ditambahkan',
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
      values: JuaraFormValues
      oldItem: Juara
    }) => updateJuara(id, values.nama_juara),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'juara',
          result.id,
          juaraToRecord(variables.oldItem),
          juaraToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Juara berhasil diperbarui',
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
    mutationFn: (id: string) => deleteJuara(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(
          userId,
          'DELETE',
          'juara',
          id,
          juaraToRecord(deletingItem),
          null
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Juara berhasil dihapus',
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
    form.reset({ nama_juara: '' })
    setIsFormOpen(true)
  }

  const openEditDialog = (item: Juara) => {
    setEditingItem(item)
    form.reset({ nama_juara: item.nama_juara })
    setIsFormOpen(true)
  }

  const openDeleteDialog = (item: Juara) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const onSubmit = (values: JuaraFormValues) => {
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

  const columns = useMemo<ColumnDef<Juara>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_juara',
        header: 'Nama Juara',
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
              aria-label="Edit juara"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus juara"
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
        title="Juara"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Juara
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
              {editingItem ? 'Edit Juara' : 'Tambah Juara'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nama_juara">Nama Juara</Label>
              <Input id="nama_juara" {...form.register('nama_juara')} />
              {form.formState.errors.nama_juara && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_juara.message}
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
        title="Hapus Juara"
        description="Apakah Anda yakin ingin menghapus juara ini? Tindakan ini tidak dapat dibatalkan."
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
