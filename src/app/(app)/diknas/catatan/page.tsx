'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { Edit, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Combobox } from '@/components/shared/combobox'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
import { DatePicker } from '@/components/shared/date-picker'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  createCatatanKelakuan,
  deleteCatatanKelakuan,
  getActiveSemesterDiknas,
  getCatatanKelakuan,
  getKelasOptions,
  getSemesterOptions,
  updateCatatanKelakuan,
  type CatatanKelakuanEntry,
} from '@/lib/queries/diknas'
import { searchStudents } from '@/lib/queries/students'
import type { Unit } from '@/lib/supabase/types'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const
const TIPE_CATATAN = ['Baik', 'Kurang Baik'] as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const catatanSchema = z.object({
  siswa_id: z.string().min(1, 'Pilih siswa'),
  semester_id: z.string().nullable(),
  tipe: z.enum(['Baik', 'Kurang Baik']),
  catatan: z.string().min(1, 'Catatan wajib diisi'),
  tanggal: z.date().nullable(),
})

type CatatanFormValues = z.infer<typeof catatanSchema>

interface ComboboxOption {
  value: string
  label: string
}

// ─── Halaman ──────────────────────────────────────────────────────────────────

export default function CatatanKelakuanPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [filterKelas, setFilterKelas] = useState('all')
  const [filterSemester, setFilterSemester] = useState('aktif')
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatatanKelakuanEntry | null>(null)
  const [deletingItem, setDeletingItem] = useState<CatatanKelakuanEntry | null>(null)

  const [siswaSearch, setSiswaSearch] = useState('')
  const [siswaOptions, setSiswaOptions] = useState<ComboboxOption[]>([])

  const debouncedSearch = useDebounce(search, 300)
  const debouncedSiswaSearch = useDebounce(siswaSearch, 300)

  const form = useForm<CatatanFormValues>({
    resolver: zodResolver(catatanSchema),
    defaultValues: {
      siswa_id: '',
      semester_id: null,
      tipe: 'Baik',
      catatan: '',
      tanggal: new Date(),
    },
  })

  const isFormOpen = isAddOpen || isEditOpen

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester-diknas'],
    queryFn: getActiveSemesterDiknas,
  })

  const { data: semesterList = [] } = useQuery({
    queryKey: ['semester-options'],
    queryFn: getSemesterOptions,
  })

  const resolvedSemesterId = useMemo(() => {
    if (filterSemester === 'aktif') return activeSemester?.id ?? undefined
    if (filterSemester === 'all') return undefined
    return filterSemester
  }, [filterSemester, activeSemester])

  const queryFilters = useMemo(
    () => ({
      unit: activeUnit,
      kelas: filterKelas !== 'all' ? filterKelas : undefined,
      semesterId: resolvedSemesterId,
      search: debouncedSearch || undefined,
      page,
      pageSize,
    }),
    [activeUnit, filterKelas, resolvedSemesterId, debouncedSearch, page, pageSize]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['catatan-kelakuan', queryFilters],
    queryFn: () => getCatatanKelakuan(queryFilters),
  })

  useQuery({
    queryKey: ['siswa-search-catatan', debouncedSiswaSearch, activeUnit],
    queryFn: async () => {
      const results = await searchStudents(debouncedSiswaSearch, activeUnit)
      setSiswaOptions(results.map((s) => ({ value: s.id, label: `${s.nama} — ${s.kelas}` })))
      return results
    },
    enabled: isFormOpen,
  })

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getUserId = () => profile?.user_id ?? null

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['catatan-kelakuan'] })
    queryClient.invalidateQueries({ queryKey: ['diknas-dashboard-stats'] })
  }, [queryClient])

  const closeDialog = () => {
    setIsAddOpen(false)
    setIsEditOpen(false)
    setEditingItem(null)
    form.reset()
    setSiswaOptions([])
  }

  const openEditDialog = (item: CatatanKelakuanEntry) => {
    setEditingItem(item)
    setSiswaOptions(
      item.students
        ? [{ value: item.siswa_id, label: `${item.students.nama} — ${item.students.kelas}` }]
        : []
    )
    form.reset({
      siswa_id: item.siswa_id,
      semester_id: item.semester_id,
      tipe: item.tipe,
      catatan: item.catatan,
      tanggal: item.tanggal ? parseISO(item.tanggal) : null,
    })
    setIsEditOpen(true)
  }

  function formatTanggal(t: string | null) {
    if (!t) return '-'
    try {
      return format(parseISO(t), 'dd/MM/yyyy')
    } catch {
      return t
    }
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (values: CatatanFormValues) =>
      createCatatanKelakuan({
        siswa_id: values.siswa_id,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
        tipe: values.tipe,
        catatan: values.catatan,
        tanggal: values.tanggal ? format(values.tanggal, 'yyyy-MM-dd') : null,
        dicatat_oleh: profile?.user_id ?? null,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) await logAudit(userId, 'CREATE', 'catatan_kelakuan', result.id, null, { id: result.id })
      invalidate()
      toast({ title: 'Catatan kelakuan berhasil ditambahkan' })
      closeDialog()
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menyimpan data', description: e.message, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CatatanFormValues }) =>
      updateCatatanKelakuan(id, {
        tipe: values.tipe,
        catatan: values.catatan,
        tanggal: values.tanggal ? format(values.tanggal, 'yyyy-MM-dd') : null,
        semester_id: values.semester_id ?? activeSemester?.id ?? null,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) await logAudit(userId, 'UPDATE', 'catatan_kelakuan', result.id, null, { id: result.id })
      invalidate()
      toast({ title: 'Catatan kelakuan berhasil diperbarui' })
      closeDialog()
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal memperbarui data', description: e.message, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteCatatanKelakuan(ids),
    onSuccess: async (_, ids) => {
      const userId = getUserId()
      if (userId) {
        for (const id of ids) {
          await logAudit(userId, 'DELETE', 'catatan_kelakuan', id, { id }, null)
        }
      }
      invalidate()
      toast({ title: 'Catatan kelakuan berhasil dihapus' })
      setIsDeleteOpen(false)
      setIsBulkDeleteOpen(false)
      setDeletingItem(null)
      setSelectedRows([])
    },
    onError: (e: Error) =>
      toast({ title: 'Gagal menghapus data', description: e.message, variant: 'destructive' }),
  })

  // ─── Columns ────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<CatatanKelakuanEntry>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        id: 'nama',
        header: 'Nama',
        cell: ({ row }) => row.original.students?.nama ?? '-',
      },
      {
        id: 'kelas',
        header: 'Kelas',
        cell: ({ row }) => row.original.students?.kelas ?? '-',
      },
      {
        accessorKey: 'tipe',
        header: 'Tipe',
        cell: ({ row }) => (
          <Badge variant={row.original.tipe === 'Baik' ? 'success' : 'destructive'}>
            {row.original.tipe}
          </Badge>
        ),
      },
      {
        accessorKey: 'catatan',
        header: 'Catatan',
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[280px] text-sm">{row.original.catatan}</span>
        ),
      },
      {
        id: 'tanggal',
        header: 'Tanggal',
        cell: ({ row }) => formatTanggal(row.original.tanggal),
      },
      {
        id: 'dicatat_oleh',
        header: 'Dicatat Oleh',
        cell: ({ row }) => row.original.dicatat_oleh ?? '-',
      },
      {
        id: 'aksi',
        header: 'Aksi',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0"
              onClick={() => openEditDialog(row.original)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
              onClick={() => { setDeletingItem(row.original); setIsDeleteOpen(true) }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize]
  )

  const onSubmit = (values: CatatanFormValues) => {
    if (isEditOpen && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const { data: kelasList = [] } = useQuery({
    queryKey: ['kelas-options', activeUnit],
    queryFn: () => getKelasOptions(activeUnit),
  })

  // Reset filter kelas jika tidak valid saat unit berubah
  useEffect(() => {
    if (filterKelas !== 'all' && kelasList.length > 0 && !kelasList.includes(filterKelas)) {
      setFilterKelas('all')
    }
  }, [activeUnit, kelasList, filterKelas])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Tabs
        value={activeUnit}
        onValueChange={(v) => {
          setActiveUnit(v as Unit)
          setPage(1)
          setSelectedRows([])
          setFilterKelas('all')
        }}
      >
        <TabsList className="no-print">
          {UNITS.map((u) => <TabsTrigger key={u} value={u}>{u}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="no-print flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
          <Input
            placeholder="Cari nama siswa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={filterKelas} onValueChange={(v) => { setFilterKelas(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {kelasList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSemester} onValueChange={(v) => { setFilterSemester(v); setPage(1) }}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktif">Semester Aktif</SelectItem>
            <SelectItem value="all">Semua Semester</SelectItem>
            {semesterList.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                Smt {s.nomor_semester} — {s.tahun_pelajaran?.nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          {selectedRows.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus ({selectedRows.length})
            </Button>
          )}
          <Button size="sm" onClick={() => { form.reset(); setIsAddOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          pagination={{
            page,
            pageSize,
            total: data?.total ?? 0,
          }}
          pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          onSortChange={() => {}}
          selectedRows={selectedRows}
          onSelectRows={setSelectedRows}
          isLoading={isLoading}
        />
      )}

      <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Catatan Kelakuan' : 'Tambah Catatan Kelakuan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Siswa</Label>
              <Combobox
                options={siswaOptions}
                value={form.watch('siswa_id')}
                onSelect={(v) => form.setValue('siswa_id', v)}
                onSearch={setSiswaSearch}
                placeholder="Cari nama siswa..."
                emptyMessage="Siswa tidak ditemukan"
              />
              {form.formState.errors.siswa_id && (
                <p className="text-xs text-destructive">{form.formState.errors.siswa_id.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipe</Label>
                <Select
                  value={form.watch('tipe')}
                  onValueChange={(v) => form.setValue('tipe', v as 'Baik' | 'Kurang Baik')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPE_CATATAN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tanggal</Label>
                <DatePicker
                  value={form.watch('tanggal') ?? undefined}
                  onChange={(d) => form.setValue('tanggal', d ?? null)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Catatan</Label>
              <Textarea
                {...form.register('catatan')}
                placeholder="Tuliskan catatan kelakuan siswa secara detail..."
                rows={4}
              />
              {form.formState.errors.catatan && (
                <p className="text-xs text-destructive">{form.formState.errors.catatan.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Batal</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Catatan Kelakuan"
        description="Catatan ini akan dihapus permanen. Lanjutkan?"
        onConfirm={() => deletingItem && deleteMutation.mutate([deletingItem.id])}
        isLoading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        title="Hapus Catatan Terpilih"
        description={`${selectedRows.length} catatan kelakuan akan dihapus permanen. Lanjutkan?`}
        onConfirm={() => deleteMutation.mutate(selectedRows)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
