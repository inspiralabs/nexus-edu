'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Edit,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  UserX,
} from 'lucide-react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { logAudit } from '@/lib/audit/log'
import {
  bulkCreateStudents,
  bulkUpdateStudents,
  createStudent,
  deleteStudents,
  getAlumniStudents,
  getStudentClasses,
  getStudents,
  restoreStudent,
  updateStudent,
  type CreateStudentInput,
} from '@/lib/queries/students'
import type { AuditAction, JenisKelamin, Student, Unit } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
type TabValue = Unit | 'Alumni'

// Schema tambah siswa baru (tanpa is_alumni, dengan kamar & nomor_induk opsional)
const studentAddSchema = z.object({
  nama: z.string().min(2, 'Nama minimal 2 karakter'),
  kelas: z.string().min(1, 'Kelas wajib diisi'),
  jenis_kelamin: z.enum(['L', 'P'], { message: 'Pilih jenis kelamin' }),
  kamar: z.string().optional(),
  nomor_induk: z.string().optional(),
})

// Schema edit siswa — lengkap
const studentEditSchema = z.object({
  nama: z.string().min(2, 'Nama minimal 2 karakter'),
  kelas: z.string().min(1, 'Kelas wajib diisi'),
  jenis_kelamin: z.enum(['L', 'P'], { message: 'Pilih jenis kelamin' }),
  kamar: z.string().optional(),
  nomor_induk: z.string().optional(),
  is_alumni: z.boolean(),
})

type StudentAddFormValues = z.infer<typeof studentAddSchema>
type StudentEditFormValues = z.infer<typeof studentEditSchema>

interface PendingStudentQueueItem extends CreateStudentInput {
  localId: string
}

function studentToRecord(student: Student): Record<string, unknown> {
  return {
    id: student.id,
    nama: student.nama,
    kelas: student.kelas,
    jenis_kelamin: student.jenis_kelamin,
    unit: student.unit,
    is_alumni: student.is_alumni,
    kamar: student.kamar,
    nomor_induk: student.nomor_induk,
    created_at: student.created_at,
  }
}

function formatJenisKelamin(jk: JenisKelamin | null): string {
  if (jk === 'L') return 'Laki-laki'
  if (jk === 'P') return 'Perempuan'
  return '-'
}

export default function StudentsPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [activeTab, setActiveTab] = useState<TabValue>('SD')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all')
  const [sortField, setSortField] = useState('nama')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isAlumniConfirmOpen, setIsAlumniConfirmOpen] = useState(false)
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)

  const [studentsQueue, setStudentsQueue] = useState<PendingStudentQueueItem[]>([])
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [alumniTargetStudent, setAlumniTargetStudent] = useState<Student | null>(null)
  const [restoreTargetStudent, setRestoreTargetStudent] = useState<Student | null>(null)
  const [bulkEditData, setBulkEditData] = useState<{
    kelas: string
    jenis_kelamin: JenisKelamin | ''
    kamar: string
    nomor_induk: string
  }>({ kelas: '', jenis_kelamin: '', kamar: '', nomor_induk: '' })
  const [alumniUnitFilter, setAlumniUnitFilter] = useState<Unit | 'all'>('all')
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([])
  const [deletingStudents, setDeletingStudents] = useState<Student[]>([])

  const debouncedSearch = useDebounce(search, 300)

  const isAlumniTab = activeTab === 'Alumni'
  const activeUnit = isAlumniTab ? null : (activeTab as Unit)

  const queryKey = [
    'students',
    activeTab,
    page,
    pageSize,
    debouncedSearch,
    selectedClassFilter,
    alumniUnitFilter,
    sortField,
    sortDirection,
  ] as const

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const opts = {
        search: debouncedSearch || undefined,
        kelas: selectedClassFilter !== 'all' ? selectedClassFilter : undefined,
        page,
        pageSize,
        sortField,
        sortDirection,
      }
      if (isAlumniTab) {
        return getAlumniStudents({
          ...opts,
          unit: alumniUnitFilter !== 'all' ? alumniUnitFilter : undefined,
        })
      }
      return getStudents(activeTab as Unit, opts)
    },
  })

  const { data: studentClasses = [] } = useQuery({
    queryKey: ['students', 'classes', activeTab],
    queryFn: () => {
      if (isAlumniTab) return Promise.resolve([])
      return getStudentClasses(activeTab as Unit)
    },
  })

  const addForm = useForm<StudentAddFormValues>({
    resolver: zodResolver(studentAddSchema),
    defaultValues: { nama: '', kelas: '', jenis_kelamin: 'L', kamar: '', nomor_induk: '' },
  })

  const editForm = useForm<StudentEditFormValues>({
    resolver: zodResolver(studentEditSchema) as import('react-hook-form').Resolver<StudentEditFormValues>,
    defaultValues: {
      nama: '',
      kelas: '',
      jenis_kelamin: 'L',
      kamar: '',
      nomor_induk: '',
      is_alumni: false,
    },
  })

  const invalidateStudents = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['students'] })
  }, [queryClient])

  const getUserId = (): string | null => profile?.user_id ?? null

  const createMutation = useMutation({
    mutationFn: (values: StudentAddFormValues) =>
      createStudent({ ...values, unit: activeUnit ?? 'SD' }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(userId, 'CREATE', 'students', result.id, null, studentToRecord(result))
      }
      invalidateStudents()
      toast({ title: 'Berhasil', description: 'Siswa berhasil ditambahkan' })
      setIsAddOpen(false)
      addForm.reset()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string
      values: StudentEditFormValues
      oldStudent: Student
    }) => updateStudent(id, values),
    onSuccess: async (result, variables) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'students',
          result.id,
          studentToRecord(variables.oldStudent),
          studentToRecord(result)
        )
      }
      invalidateStudents()
      toast({ title: 'Berhasil', description: 'Siswa berhasil diperbarui' })
      setIsEditOpen(false)
      setEditingStudent(null)
      editForm.reset()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteStudents(ids),
    onSuccess: async (_, ids) => {
      const userId = getUserId()
      if (userId) {
        for (const id of ids) {
          const student =
            deletingStudents.find((s) => s.id === id) ??
            data?.data.find((s) => s.id === id)
          await logAudit(
            userId,
            'DELETE',
            'students',
            id,
            student ? studentToRecord(student) : { id },
            null
          )
        }
      }
      invalidateStudents()
      toast({ title: 'Berhasil', description: 'Siswa berhasil dihapus' })
      setIsDeleteOpen(false)
      setDeleteTargetIds([])
      setDeletingStudents([])
      setSelectedRows([])
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const alumniMutation = useMutation({
    mutationFn: (id: string) => updateStudent(id, { is_alumni: true }),
    onSuccess: async (result, id) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'students',
          id,
          { is_alumni: false },
          { is_alumni: true }
        )
      }
      invalidateStudents()
      toast({ title: 'Berhasil', description: `${result.nama} telah ditandai sebagai alumni` })
      setIsAlumniConfirmOpen(false)
      setAlumniTargetStudent(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreStudent(id),
    onSuccess: async (result, id) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'UPDATE',
          'students',
          id,
          { is_alumni: true },
          { is_alumni: false }
        )
      }
      invalidateStudents()
      toast({ title: 'Berhasil', description: `${result.nama} telah dikembalikan ke siswa aktif` })
      setIsRestoreConfirmOpen(false)
      setRestoreTargetStudent(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: ({
      ids,
      oldStudents: _old,
      ...payload
    }: {
      ids: string[]
      kelas?: string
      jenis_kelamin?: JenisKelamin
      kamar?: string
      nomor_induk?: string
      oldStudents: Student[]
    }) => bulkUpdateStudents(ids, payload),
    onSuccess: async (_, variables) => {
      const userId = getUserId()
      if (userId) {
        for (const oldStudent of variables.oldStudents) {
          await logAudit(
            userId,
            'BULK_UPDATE' as AuditAction,
            'students',
            oldStudent.id,
            studentToRecord(oldStudent),
            { ...studentToRecord(oldStudent), ...variables }
          )
        }
      }
      invalidateStudents()
      toast({
        title: 'Berhasil',
        description: `${variables.ids.length} siswa berhasil diperbarui`,
      })
      setSelectedRows([])
      setIsBulkEditOpen(false)
      setBulkEditData({ kelas: '', jenis_kelamin: '', kamar: '', nomor_induk: '' })
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const bulkCreateMutation = useMutation({
    mutationFn: (items: CreateStudentInput[]) => bulkCreateStudents(items),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const result of results) {
          await logAudit(userId, 'BULK_CREATE' as AuditAction, 'students', result.id, null, studentToRecord(result))
        }
      }
      invalidateStudents()
      toast({ title: 'Berhasil', description: `Berhasil menambahkan ${results.length} siswa baru` })
      closeBulkAddDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    },
  })

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabValue)
    setPage(1)
    setSelectedRows([])
    setSelectedClassFilter('all')
    setAlumniUnitFilter('all')
  }

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field)
    setSortDirection(direction)
    setPage(1)
  }

  const openAddDialog = () => {
    addForm.reset({ nama: '', kelas: '', jenis_kelamin: 'L', kamar: '', nomor_induk: '' })
    setIsAddOpen(true)
  }

  const openEditDialog = (student: Student) => {
    setEditingStudent(student)
    editForm.reset({
      nama: student.nama,
      kelas: student.kelas,
      jenis_kelamin: student.jenis_kelamin ?? 'L',
      kamar: student.kamar ?? '',
      nomor_induk: student.nomor_induk ?? '',
      is_alumni: student.is_alumni ?? false,
    })
    setIsEditOpen(true)
  }

  const openSingleDelete = (student: Student) => {
    setDeleteTargetIds([student.id])
    setDeletingStudents([student])
    setIsDeleteOpen(true)
  }

  const openBulkDelete = () => {
    const studentsToDelete = data?.data.filter((s) => selectedRows.includes(s.id)) ?? []
    setDeleteTargetIds(selectedRows)
    setDeletingStudents(studentsToDelete)
    setIsDeleteOpen(true)
  }

  const openBulkEdit = () => {
    setBulkEditData({ kelas: '', jenis_kelamin: '', kamar: '', nomor_induk: '' })
    setIsBulkEditOpen(true)
  }

  const openAlumniConfirm = (student: Student) => {
    setAlumniTargetStudent(student)
    setIsAlumniConfirmOpen(true)
  }

  const openRestoreConfirm = (student: Student) => {
    setRestoreTargetStudent(student)
    setIsRestoreConfirmOpen(true)
  }

  const resetAddFormDefaults = () => {
    addForm.reset({ nama: '', kelas: '', jenis_kelamin: 'L', kamar: '', nomor_induk: '' })
  }

  const closeBulkAddDialog = () => {
    setIsBulkAddOpen(false)
    setStudentsQueue([])
    resetAddFormDefaults()
  }

  const openBulkAdd = () => {
    resetAddFormDefaults()
    setStudentsQueue([])
    setIsBulkAddOpen(true)
  }

  const addToStudentsQueue = (values: StudentAddFormValues) => {
    setStudentsQueue((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        nama: values.nama,
        kelas: values.kelas,
        jenis_kelamin: values.jenis_kelamin,
        kamar: values.kamar,
        nomor_induk: values.nomor_induk,
        unit: activeUnit ?? 'SD',
      },
    ])
    resetAddFormDefaults()
    toast({ title: 'Ditambahkan', description: 'Item ditambahkan ke daftar. Isi form untuk menambah lagi.' })
  }

  const handleBulkEditSubmit = () => {
    const hasAnyValue =
      bulkEditData.kelas.trim() ||
      bulkEditData.jenis_kelamin ||
      bulkEditData.kamar.trim() ||
      bulkEditData.nomor_induk.trim()

    if (!hasAnyValue) {
      toast({ title: 'Validasi gagal', description: 'Isi minimal satu field yang ingin diubah', variant: 'destructive' })
      return
    }
    const payload: { kelas?: string; jenis_kelamin?: JenisKelamin; kamar?: string; nomor_induk?: string } = {}
    if (bulkEditData.kelas.trim()) payload.kelas = bulkEditData.kelas.trim()
    if (bulkEditData.jenis_kelamin) payload.jenis_kelamin = bulkEditData.jenis_kelamin
    if (bulkEditData.kamar.trim()) payload.kamar = bulkEditData.kamar.trim()
    if (bulkEditData.nomor_induk.trim()) payload.nomor_induk = bulkEditData.nomor_induk.trim()

    const oldStudents = data?.data.filter((s) => selectedRows.includes(s.id)) ?? []
    bulkUpdateMutation.mutate({ ids: selectedRows, ...payload, oldStudents })
  }

  const onSubmitEditForm = (values: StudentEditFormValues) => {
    if (editingStudent) {
      updateMutation.mutate({ id: editingStudent.id, values, oldStudent: editingStudent })
    }
  }

  const onSubmitAddForm = (values: StudentAddFormValues) => {
    createMutation.mutate(values)
  }

  // Kolom untuk tab SD/SMP/SMA
  const activeColumns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      { accessorKey: 'nama', header: 'Nama' },
      { accessorKey: 'kelas', header: 'Kelas' },
      {
        accessorKey: 'jenis_kelamin',
        header: 'Jenis Kelamin',
        enableSorting: false,
        cell: ({ row }) => formatJenisKelamin(row.original.jenis_kelamin),
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
              aria-label="Edit siswa"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openAlumniConfirm(row.original)}
              aria-label="Jadikan alumni"
              title="Tandai sebagai alumni"
            >
              <UserX className="h-4 w-4 text-status-yellow" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openSingleDelete(row.original)}
              aria-label="Hapus siswa"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize]
  )

  // Kolom untuk tab Alumni
  const alumniColumns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      { accessorKey: 'nama', header: 'Nama' },
      { accessorKey: 'kelas', header: 'Kelas Terakhir' },
      {
        accessorKey: 'unit',
        header: 'Unit',
        enableSorting: false,
      },
      {
        accessorKey: 'jenis_kelamin',
        header: 'Jenis Kelamin',
        enableSorting: false,
        cell: ({ row }) => formatJenisKelamin(row.original.jenis_kelamin),
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
              size="sm"
              onClick={() => openRestoreConfirm(row.original)}
              aria-label="Kembalikan ke aktif"
              className="gap-1 text-xs text-primary hover:text-primary"
            >
              <RotateCcw className="h-3 w-3" />
              Kembalikan ke Aktif
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => openSingleDelete(row.original)}
              aria-label="Hapus siswa"
            >
              <Trash2 className="h-4 w-4 text-status-red" />
            </Button>
          </div>
        ),
      },
    ],
    [page, pageSize]
  )

  const isFormSubmitting = updateMutation.isPending
  const isAddSubmitting = createMutation.isPending
  const isBulkCreateSubmitting = bulkCreateMutation.isPending

  const renderAddFormFields = (showAddToListButton = false) => (
    <div className="space-y-4">
      {showAddToListButton && (
        <div className="space-y-2">
          <Label htmlFor="bulk-unit">Unit</Label>
          <Input id="bulk-unit" value={activeUnit ?? ''} disabled readOnly />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="add-nama">Nama Siswa</Label>
        <Input id="add-nama" {...addForm.register('nama')} />
        {addForm.formState.errors.nama && (
          <p className="text-xs text-status-red">{addForm.formState.errors.nama.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={showAddToListButton ? 'bulk-kelas' : 'add-kelas'}>Kelas</Label>
        <Input
          id={showAddToListButton ? 'bulk-kelas' : 'add-kelas'}
          list={showAddToListButton ? 'kelas-suggestions' : undefined}
          {...addForm.register('kelas')}
        />
        {showAddToListButton && studentClasses.length > 0 && (
          <datalist id="kelas-suggestions">
            {studentClasses.map((kelas) => (
              <option key={kelas} value={kelas} />
            ))}
          </datalist>
        )}
        {addForm.formState.errors.kelas && (
          <p className="text-xs text-status-red">{addForm.formState.errors.kelas.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Jenis Kelamin</Label>
        <RadioGroup
          value={addForm.watch('jenis_kelamin')}
          onValueChange={(value) =>
            addForm.setValue('jenis_kelamin', value as JenisKelamin, { shouldValidate: true })
          }
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="L" id={showAddToListButton ? 'bulk-jk-l' : 'add-jk-l'} />
            <Label htmlFor={showAddToListButton ? 'bulk-jk-l' : 'add-jk-l'} className="font-normal">Laki-laki</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="P" id={showAddToListButton ? 'bulk-jk-p' : 'add-jk-p'} />
            <Label htmlFor={showAddToListButton ? 'bulk-jk-p' : 'add-jk-p'} className="font-normal">Perempuan</Label>
          </div>
        </RadioGroup>
        {addForm.formState.errors.jenis_kelamin && (
          <p className="text-xs text-status-red">{addForm.formState.errors.jenis_kelamin.message}</p>
        )}
      </div>

      {/* Kamar (opsional) */}
      <div className="space-y-2">
        <Label htmlFor={showAddToListButton ? 'bulk-kamar' : 'add-kamar'}>
          Kamar Pesantren <span className="text-[var(--text-tertiary)]">(opsional)</span>
        </Label>
        <Input
          id={showAddToListButton ? 'bulk-kamar' : 'add-kamar'}
          placeholder="Contoh: Al-Fatih"
          {...addForm.register('kamar')}
        />
      </div>

      {/* Nomor Induk (opsional) */}
      <div className="space-y-2">
        <Label htmlFor={showAddToListButton ? 'bulk-nomor-induk' : 'add-nomor-induk'}>
          Nomor Induk <span className="text-[var(--text-tertiary)]">(opsional)</span>
        </Label>
        <Input
          id={showAddToListButton ? 'bulk-nomor-induk' : 'add-nomor-induk'}
          placeholder="Contoh: 2024001"
          {...addForm.register('nomor_induk')}
        />
      </div>

      {showAddToListButton && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={addForm.handleSubmit(addToStudentsQueue)}
        >
          Tambah ke Daftar
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Siswa"
        actions={
          <>
            {!isAlumniTab && (
              <>
                <Button type="button" onClick={openAddDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Siswa
                </Button>
                <Button type="button" variant="outline" onClick={openBulkAdd}>
                  <Upload className="mr-2 h-4 w-4" />
                  Tambah Banyak
                </Button>
              </>
            )}
          </>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <TabsList>
          {UNITS.map((unit) => (
            <TabsTrigger key={unit} value={unit}>
              {unit}
            </TabsTrigger>
          ))}
          <TabsTrigger value="Alumni">Alumni</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              placeholder="Cari nama siswa..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
          {!isAlumniTab && (
            <Select
              value={selectedClassFilter}
              onValueChange={(value) => {
                setSelectedClassFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Semua Kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kelas</SelectItem>
                {studentClasses.map((kelas) => (
                  <SelectItem key={kelas} value={kelas}>
                    {kelas}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isAlumniTab && (
            <Select
              value={alumniUnitFilter}
              onValueChange={(value) => {
                setAlumniUnitFilter(value as Unit | 'all')
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Semua Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Unit</SelectItem>
                {UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {selectedRows.length > 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            {selectedRows.length} data terpilih
          </p>
        )}
      </div>

      {selectedRows.length > 0 && !isAlumniTab && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <span className="text-sm text-[var(--text-primary)]">
            {selectedRows.length} item terpilih
          </span>
          <Button type="button" variant="outline" size="sm" onClick={openBulkEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit {selectedRows.length} Siswa Terpilih
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={openBulkDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus {selectedRows.length} Siswa terpilih
          </Button>
        </div>
      )}

      <DataTable
        columns={isAlumniTab ? alumniColumns : activeColumns}
        data={data?.data ?? []}
        pagination={{
          page,
          pageSize,
          total: data?.total ?? 0,
        }}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onSortChange={handleSortChange}
        selectedRows={isAlumniTab ? [] : selectedRows}
        onSelectRows={isAlumniTab ? undefined : setSelectedRows}
        isLoading={isLoading}
      />

      {/* Dialog Tambah */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false)
            addForm.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Siswa</DialogTitle>
          </DialogHeader>
          <form onSubmit={addForm.handleSubmit(onSubmitAddForm)} className="space-y-4">
            {renderAddFormFields(false)}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false)
                  addForm.reset()
                }}
              >
                Batal
              </Button>
              <Button type="submit" isLoading={isAddSubmitting}>
                Tambah
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit — form lengkap */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsEditOpen(false)
            setEditingStudent(null)
            editForm.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Siswa</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onSubmitEditForm)} className="space-y-4">
            {/* Nama */}
            <div className="space-y-2">
              <Label htmlFor="edit-nama">Nama Siswa</Label>
              <Input id="edit-nama" {...editForm.register('nama')} />
              {editForm.formState.errors.nama && (
                <p className="text-xs text-status-red">{editForm.formState.errors.nama.message}</p>
              )}
            </div>

            {/* Kelas */}
            <div className="space-y-2">
              <Label htmlFor="edit-kelas">Kelas</Label>
              <Input id="edit-kelas" {...editForm.register('kelas')} />
              {editForm.formState.errors.kelas && (
                <p className="text-xs text-status-red">{editForm.formState.errors.kelas.message}</p>
              )}
            </div>

            {/* Jenis Kelamin */}
            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <RadioGroup
                value={editForm.watch('jenis_kelamin')}
                onValueChange={(value) =>
                  editForm.setValue('jenis_kelamin', value as JenisKelamin, { shouldValidate: true })
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="L" id="edit-jk-l" />
                  <Label htmlFor="edit-jk-l" className="font-normal">Laki-laki</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="P" id="edit-jk-p" />
                  <Label htmlFor="edit-jk-p" className="font-normal">Perempuan</Label>
                </div>
              </RadioGroup>
              {editForm.formState.errors.jenis_kelamin && (
                <p className="text-xs text-status-red">{editForm.formState.errors.jenis_kelamin.message}</p>
              )}
            </div>

            {/* Kamar (opsional) */}
            <div className="space-y-2">
              <Label htmlFor="edit-kamar">Kamar Pesantren <span className="text-[var(--text-tertiary)]">(opsional)</span></Label>
              <Input id="edit-kamar" placeholder="Contoh: Al-Fatih" {...editForm.register('kamar')} />
            </div>

            {/* Nomor Induk (opsional) */}
            <div className="space-y-2">
              <Label htmlFor="edit-nomor-induk">Nomor Induk <span className="text-[var(--text-tertiary)]">(opsional)</span></Label>
              <Input id="edit-nomor-induk" placeholder="Contoh: 2024001" {...editForm.register('nomor_induk')} />
            </div>

            {/* Switch: Tandai Alumni */}
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Tandai sebagai Alumni</p>
                <p className="text-xs text-[var(--text-secondary)]">Siswa tidak akan tampil di tab unit aktif</p>
              </div>
              <Switch
                id="edit-is-alumni"
                checked={editForm.watch('is_alumni')}
                onCheckedChange={(checked) =>
                  editForm.setValue('is_alumni', checked, { shouldValidate: true })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false)
                  setEditingStudent(null)
                  editForm.reset()
                }}
              >
                Batal
              </Button>
              <Button type="submit" isLoading={isFormSubmitting}>
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Hapus */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Hapus Siswa"
        description={
          deleteTargetIds.length > 1
            ? `Apakah Anda yakin ingin menghapus ${deleteTargetIds.length} siswa terpilih? Tindakan ini tidak dapat dibatalkan.`
            : 'Apakah Anda yakin ingin menghapus siswa ini? Tindakan ini tidak dapat dibatalkan.'
        }
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTargetIds)}
      />

      {/* Dialog Konfirmasi Alumni */}
      <ConfirmDialog
        open={isAlumniConfirmOpen}
        onOpenChange={(open) => {
          setIsAlumniConfirmOpen(open)
          if (!open) setAlumniTargetStudent(null)
        }}
        title="Tandai sebagai Alumni"
        description={
          alumniTargetStudent
            ? `Apakah Anda yakin ingin menandai "${alumniTargetStudent.nama}" sebagai alumni? Siswa tidak akan tampil di daftar aktif.`
            : 'Apakah Anda yakin ingin menandai siswa ini sebagai alumni?'
        }
        variant="destructive"
        isLoading={alumniMutation.isPending}
        onConfirm={() => {
          if (alumniTargetStudent) alumniMutation.mutate(alumniTargetStudent.id)
        }}
      />

      {/* Dialog Konfirmasi Kembalikan Alumni */}
      <ConfirmDialog
        open={isRestoreConfirmOpen}
        onOpenChange={(open) => {
          setIsRestoreConfirmOpen(open)
          if (!open) setRestoreTargetStudent(null)
        }}
        title="Kembalikan ke Siswa Aktif"
        description={
          restoreTargetStudent
            ? `Apakah Anda yakin ingin mengembalikan "${restoreTargetStudent.nama}" ke daftar siswa aktif?`
            : 'Apakah Anda yakin ingin mengembalikan siswa ini ke daftar aktif?'
        }
        isLoading={restoreMutation.isPending}
        onConfirm={() => {
          if (restoreTargetStudent) restoreMutation.mutate(restoreTargetStudent.id)
        }}
      />

      {/* Dialog Bulk Edit — semua field */}
      <Dialog
        open={isBulkEditOpen}
        onOpenChange={(open) => {
          setIsBulkEditOpen(open)
          if (!open) setBulkEditData({ kelas: '', jenis_kelamin: '', kamar: '', nomor_induk: '' })
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Massal Siswa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Mengedit <strong>{selectedRows.length}</strong> siswa terpilih. Kosongkan field yang tidak ingin diubah.
            </p>

            {/* Kelas */}
            <div className="space-y-2">
              <Label htmlFor="bulk-edit-kelas">Kelas Baru <span className="text-[var(--text-tertiary)]">(opsional)</span></Label>
              <Input
                id="bulk-edit-kelas"
                placeholder="Contoh: VII-A"
                value={bulkEditData.kelas}
                onChange={(e) => setBulkEditData((prev) => ({ ...prev, kelas: e.target.value }))}
              />
            </div>

            {/* Jenis Kelamin */}
            <div className="space-y-2">
              <Label>Jenis Kelamin <span className="text-[var(--text-tertiary)]">(opsional)</span></Label>
              <RadioGroup
                value={bulkEditData.jenis_kelamin}
                onValueChange={(v) => setBulkEditData((prev) => ({ ...prev, jenis_kelamin: v as JenisKelamin | '' }))}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="" id="bulk-jk-none" />
                  <Label htmlFor="bulk-jk-none" className="font-normal">Tidak diubah</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="L" id="bulk-jk-l" />
                  <Label htmlFor="bulk-jk-l" className="font-normal">Laki-laki</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="P" id="bulk-jk-p" />
                  <Label htmlFor="bulk-jk-p" className="font-normal">Perempuan</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Kamar */}
            <div className="space-y-2">
              <Label htmlFor="bulk-edit-kamar">Kamar Pesantren <span className="text-[var(--text-tertiary)]">(opsional)</span></Label>
              <Input
                id="bulk-edit-kamar"
                placeholder="Contoh: Al-Fatih"
                value={bulkEditData.kamar}
                onChange={(e) => setBulkEditData((prev) => ({ ...prev, kamar: e.target.value }))}
              />
            </div>

            {/* Nomor Induk */}
            <div className="space-y-2">
              <Label htmlFor="bulk-edit-nomor">Nomor Induk <span className="text-[var(--text-tertiary)]">(opsional)</span></Label>
              <Input
                id="bulk-edit-nomor"
                placeholder="Contoh: 2024001"
                value={bulkEditData.nomor_induk}
                onChange={(e) => setBulkEditData((prev) => ({ ...prev, nomor_induk: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsBulkEditOpen(false)
                setBulkEditData({ kelas: '', jenis_kelamin: '', kamar: '', nomor_induk: '' })
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              isLoading={bulkUpdateMutation.isPending}
              onClick={handleBulkEditSubmit}
            >
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tambah Banyak */}
      <Dialog
        open={isBulkAddOpen}
        onOpenChange={(open) => {
          if (!open) closeBulkAddDialog()
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Banyak Data Siswa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {renderAddFormFields(true)}

            {studentsQueue.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Daftar ({studentsQueue.length} item)
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Jenis Kelamin</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsQueue.map((item) => (
                      <TableRow key={item.localId}>
                        <TableCell>{item.nama}</TableCell>
                        <TableCell>{item.kelas}</TableCell>
                        <TableCell>{formatJenisKelamin(item.jenis_kelamin)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setStudentsQueue((prev) =>
                                prev.filter((p) => p.localId !== item.localId)
                              )
                            }
                            aria-label="Hapus dari daftar"
                          >
                            <Trash2 className="h-4 w-4 text-status-red" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeBulkAddDialog}>
              Batal
            </Button>
            <Button
              type="button"
              isLoading={isBulkCreateSubmitting}
              disabled={studentsQueue.length === 0}
              onClick={() =>
                bulkCreateMutation.mutate(
                  studentsQueue.map(({ localId: _localId, ...payload }) => payload)
                )
              }
            >
              Simpan Semua ({studentsQueue.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
