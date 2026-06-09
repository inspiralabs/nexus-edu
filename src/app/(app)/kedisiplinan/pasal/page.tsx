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
  createPasal,
  deletePasal,
  getKategoriDisiplin,
  getPasalByKategori,
  updatePasal,
} from '@/lib/queries/kedisiplinan'
import type { Pasal } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50] as const

const pasalSchema = z.object({
  nama_pasal: z.string().min(1, 'Nama pasal wajib diisi'),
  kategori_id: z.string().min(1, 'Pilih kategori'),
  poin: z.number({ message: 'Poin harus angka' }).min(0, 'Poin minimal 0'),
})

type PasalFormValues = z.infer<typeof pasalSchema>

interface PasalRow extends Pasal {
  nama_kategori: string
}

function pasalToRecord(pasal: Pasal): Record<string, unknown> {
  return {
    id: pasal.id,
    nama_pasal: pasal.nama_pasal,
    kategori_id: pasal.kategori_id,
    poin: pasal.poin,
  }
}

function sortPasalData(
  data: PasalRow[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): PasalRow[] {
  const sorted = [...data].sort((a, b) => {
    if (sortField === 'poin') {
      return a.poin - b.poin
    }
    const aVal =
      sortField === 'nama_kategori'
        ? a.nama_kategori
        : String(a[sortField as keyof PasalRow] ?? '')
    const bVal =
      sortField === 'nama_kategori'
        ? b.nama_kategori
        : String(b[sortField as keyof PasalRow] ?? '')
    return String(aVal).localeCompare(String(bVal), 'id')
  })
  return sortDirection === 'asc' ? sorted : sorted.reverse()
}

export default function PasalPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sortField, setSortField] = useState('nama_pasal')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Pasal | null>(null)
  const [deletingItem, setDeletingItem] = useState<Pasal | null>(null)

  const { data: kategoriList = [] } = useQuery({
    queryKey: ['kategori-disiplin'],
    queryFn: getKategoriDisiplin,
  })

  const { data: allData = [], isLoading } = useQuery({
    queryKey: ['pasal', kategoriList.map((k) => k.id)],
    queryFn: async () => {
      if (kategoriList.length === 0) return [] as PasalRow[]
      const map = new Map(
        kategoriList.map((kategori) => [kategori.id, kategori.nama_kategori])
      )
      const results = await Promise.all(
        kategoriList.map((kategori) => getPasalByKategori(kategori.id))
      )
      return results.flat().map((pasal) => ({
        ...pasal,
        nama_kategori: map.get(pasal.kategori_id ?? '') ?? '-',
      }))
    },
    enabled: kategoriList.length > 0,
  })

  const sortedData = useMemo(
    () => sortPasalData(allData, sortField, sortDirection),
    [allData, sortField, sortDirection]
  )

  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return sortedData.slice(from, from + pageSize)
  }, [sortedData, page, pageSize])

  const form = useForm<PasalFormValues>({
    resolver: zodResolver(pasalSchema),
    defaultValues: { nama_pasal: '', kategori_id: '', poin: 0 },
  })

  const getUserId = (): string | null => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pasal'] })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (values: PasalFormValues) => createPasal(values),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'pasal',
          result.id,
          null,
          pasalToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Pasal berhasil ditambahkan',
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
      values: PasalFormValues
      oldItem: Pasal
    }) => updatePasal(id, values),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'pasal',
          result.id,
          pasalToRecord(variables.oldItem),
          pasalToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Pasal berhasil diperbarui',
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
    mutationFn: (id: string) => deletePasal(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(
          userId,
          'DELETE',
          'pasal',
          id,
          pasalToRecord(deletingItem),
          null
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Pasal berhasil dihapus',
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
      nama_pasal: '',
      kategori_id: kategoriList[0]?.id ?? '',
      poin: 0,
    })
    setIsFormOpen(true)
  }

  const openEditDialog = (item: PasalRow) => {
    setEditingItem(item)
    form.reset({
      nama_pasal: item.nama_pasal,
      kategori_id: item.kategori_id ?? '',
      poin: item.poin,
    })
    setIsFormOpen(true)
  }

  const openDeleteDialog = (item: PasalRow) => {
    setDeletingItem(item)
    setIsDeleteOpen(true)
  }

  const onSubmit = (values: PasalFormValues) => {
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

  const columns = useMemo<ColumnDef<PasalRow>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama_pasal',
        header: 'Nama Pasal',
      },
      {
        accessorKey: 'nama_kategori',
        header: 'Kategori',
      },
      {
        accessorKey: 'poin',
        header: 'Poin',
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
              aria-label="Edit pasal"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openDeleteDialog(row.original)}
              aria-label="Hapus pasal"
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
        title="Pasal"
        actions={
          <Button
            type="button"
            onClick={openAddDialog}
            disabled={kategoriList.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Pasal
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
              {editingItem ? 'Edit Pasal' : 'Tambah Pasal'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nama_pasal">Nama Pasal</Label>
              <Input id="nama_pasal" {...form.register('nama_pasal')} />
              {form.formState.errors.nama_pasal && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama_pasal.message}
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
            <div className="space-y-2">
              <Label htmlFor="poin">Poin</Label>
              <Input
                id="poin"
                type="number"
                min={0}
                {...form.register('poin', { valueAsNumber: true })}
              />
              {form.formState.errors.poin && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.poin.message}
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
        title="Hapus Pasal"
        description="Apakah Anda yakin ingin menghapus pasal ini? Tindakan ini tidak dapat dibatalkan."
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
