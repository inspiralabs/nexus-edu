'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { Edit, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
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
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} from '@/lib/queries/admin'
import type { Announcement } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20] as const

const announcementSchema = z.object({
  title: z.string().min(1, 'Judul wajib diisi'),
  content: z.string().min(10, 'Konten minimal 10 karakter'),
})

type AnnouncementFormValues = z.infer<typeof announcementSchema>

function formatTanggal(value: string): string {
  try {
    return format(parseISO(value), 'dd/MM/yyyy')
  } catch {
    return format(new Date(value), 'dd/MM/yyyy')
  }
}

function truncateContent(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content
  return `${content.slice(0, maxLength)}...`
}

function announcementToRecord(
  announcement: Announcement
): Record<string, unknown> {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    created_at: announcement.created_at,
  }
}

function sortAnnouncements(
  data: Announcement[],
  sortField: string,
  sortDirection: 'asc' | 'desc'
): Announcement[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[sortField as keyof Announcement] ?? ''
    const bVal = b[sortField as keyof Announcement] ?? ''
    return String(aVal).localeCompare(String(bVal), 'id')
  })
  return sortDirection === 'asc' ? sorted : sorted.reverse()
}

export default function AdminAnnouncementsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAdmin, isLoading: authLoading, profile } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [sortField, setSortField] = useState('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Announcement | null>(null)
  const [deletingItem, setDeletingItem] = useState<Announcement | null>(null)

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/dashboard')
    }
  }, [authLoading, isAdmin, router])

  const { data: allData = [], isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: getAnnouncements,
    enabled: isAdmin,
  })

  const sortedData = useMemo(
    () => sortAnnouncements(allData, sortField, sortDirection),
    [allData, sortField, sortDirection]
  )

  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return sortedData.slice(from, from + pageSize)
  }, [sortedData, page, pageSize])

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: '',
      content: '',
    },
  })

  const getUserId = useCallback((): string | null => {
    return profile?.user_id ?? null
  }, [profile?.user_id])

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })
  }, [queryClient])

  const openAddDialog = () => {
    setEditingItem(null)
    form.reset({ title: '', content: '' })
    setIsFormOpen(true)
  }

  const openEditDialog = (item: Announcement) => {
    setEditingItem(item)
    form.reset({ title: item.title, content: item.content })
    setIsFormOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (values: AnnouncementFormValues) =>
      createAnnouncement(values),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'announcements',
          result.id,
          null,
          announcementToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Pengumuman berhasil ditambahkan',
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
      values: AnnouncementFormValues
      oldItem: Announcement
    }) => updateAnnouncement(id, values),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'announcements',
          result.id,
          announcementToRecord(variables.oldItem),
          announcementToRecord(result)
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Pengumuman berhasil diperbarui',
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
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: async (_, id) => {
      const userId = getUserId()
      if (userId && deletingItem) {
        await logAudit(
          userId,
          'DELETE',
          'announcements',
          id,
          announcementToRecord(deletingItem),
          null
        )
      }
      invalidate()
      toast({
        title: 'Berhasil',
        description: 'Pengumuman berhasil dihapus',
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

  const handleSortChange = useCallback(
    (field: string, direction: 'asc' | 'desc') => {
      setSortField(field)
      setSortDirection(direction)
    },
    []
  )

  const columns = useMemo<ColumnDef<Announcement>[]>(() => {
    const rowOffset = (page - 1) * pageSize

    return [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => rowOffset + row.index + 1,
      },
      {
        accessorKey: 'title',
        header: 'Judul',
      },
      {
        accessorKey: 'content',
        header: 'Isi',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">
            {truncateContent(row.original.content)}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Tanggal',
        cell: ({ row }) => formatTanggal(row.original.created_at),
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
              aria-label="Edit pengumuman"
              onClick={() => openEditDialog(row.original)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Hapus pengumuman"
              onClick={() => {
                setDeletingItem(row.original)
                setIsDeleteOpen(true)
              }}
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ]
  }, [page, pageSize])

  const onSubmitForm = (values: AnnouncementFormValues) => {
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

  const isFormSubmitting = createMutation.isPending || updateMutation.isPending

  if (authLoading || !isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengumuman"
        actions={
          <Button type="button" onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Pengumuman
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
        onSortChange={handleSortChange}
        isLoading={isLoading}
      />

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false)
            setEditingItem(null)
            form.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Pengumuman' : 'Tambah Pengumuman'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmitForm)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="title">Judul</Label>
              <Input
                id="title"
                placeholder="Masukkan judul pengumuman"
                {...form.register('title')}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Konten</Label>
              <textarea
                id="content"
                rows={5}
                placeholder="Masukkan konten pengumuman"
                className={cn(
                  'flex min-h-[120px] w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50'
                )}
                {...form.register('content')}
              />
              {form.formState.errors.content && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.content.message}
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
              <Button type="submit" isLoading={isFormSubmitting}>
                {editingItem ? 'Simpan' : 'Tambah'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Pengumuman"
        description="Apakah Anda yakin ingin menghapus pengumuman ini? Tindakan ini tidak dapat dibatalkan."
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
