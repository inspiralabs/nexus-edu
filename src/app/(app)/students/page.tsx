'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Edit,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DataTable } from '@/components/shared/data-table'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  getStudentClasses,
  getStudents,
  updateStudent,
  type CreateStudentInput,
} from '@/lib/queries/students'
import type { AuditAction, JenisKelamin, Student, Unit } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

const studentSchema = z.object({
  nama: z.string().min(2, 'Nama minimal 2 karakter'),
  kelas: z.string().min(1, 'Kelas wajib diisi'),
  jenis_kelamin: z.enum(['L', 'P'], {
    message: 'Pilih jenis kelamin',
  }),
})

type StudentFormValues = z.infer<typeof studentSchema>

interface BulkParseError {
  line: number
  message: string
}

interface BulkParseResult {
  valid: CreateStudentInput[]
  errors: BulkParseError[]
}

function studentToRecord(student: Student): Record<string, unknown> {
  return {
    id: student.id,
    nama: student.nama,
    kelas: student.kelas,
    jenis_kelamin: student.jenis_kelamin,
    unit: student.unit,
    created_at: student.created_at,
  }
}

function formatJenisKelamin(jk: JenisKelamin | null): string {
  if (jk === 'L') return 'Laki-laki'
  if (jk === 'P') return 'Perempuan'
  return '-'
}

function parseBulkImport(
  text: string,
  unit: Unit
): BulkParseResult {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const valid: CreateStudentInput[] = []
  const errors: BulkParseError[] = []

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const parts = line.split(',').map((part) => part.trim())

    if (parts.length !== 3) {
      errors.push({
        line: lineNumber,
        message: 'Format harus: Nama,Kelas,JenisKelamin',
      })
      return
    }

    const [nama, kelas, jenisKelaminRaw] = parts

    if (nama.length < 2) {
      errors.push({
        line: lineNumber,
        message: 'Nama minimal 2 karakter',
      })
      return
    }

    if (kelas.length < 1) {
      errors.push({
        line: lineNumber,
        message: 'Kelas wajib diisi',
      })
      return
    }

    const jenisKelamin = jenisKelaminRaw.toUpperCase()
    if (jenisKelamin !== 'L' && jenisKelamin !== 'P') {
      errors.push({
        line: lineNumber,
        message: 'Jenis kelamin harus L atau P',
      })
      return
    }

    valid.push({
      nama,
      kelas,
      jenis_kelamin: jenisKelamin as JenisKelamin,
      unit,
    })
  })

  return { valid, errors }
}

export default function StudentsPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
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
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)

  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [bulkEditData, setBulkEditData] = useState({ kelas: '' })
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([])
  const [deletingStudents, setDeletingStudents] = useState<Student[]>([])
  const [bulkImportText, setBulkImportText] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const queryKey = [
    'students',
    activeUnit,
    page,
    pageSize,
    debouncedSearch,
    selectedClassFilter,
    sortField,
    sortDirection,
  ] as const

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      getStudents(activeUnit, {
        search: debouncedSearch || undefined,
        kelas:
          selectedClassFilter !== 'all' ? selectedClassFilter : undefined,
        page,
        pageSize,
        sortField,
        sortDirection,
      }),
  })

  const { data: studentClasses = [] } = useQuery({
    queryKey: ['students', 'classes', activeUnit],
    queryFn: () => getStudentClasses(activeUnit),
  })

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      nama: '',
      kelas: '',
      jenis_kelamin: 'L',
    },
  })

  const bulkParseResult = useMemo(
    () => parseBulkImport(bulkImportText, activeUnit),
    [bulkImportText, activeUnit]
  )

  const invalidateStudents = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['students'] })
  }, [queryClient])

  const getUserId = (): string | null => profile?.user_id ?? null

  const createMutation = useMutation({
    mutationFn: (values: StudentFormValues) =>
      createStudent({
        ...values,
        unit: activeUnit,
      }),
    onSuccess: async (result) => {
      const userId = getUserId()
      if (userId) {
        await logAudit(
          userId,
          'CREATE',
          'students',
          result.id,
          null,
          studentToRecord(result)
        )
      }
      invalidateStudents()
      toast({
        title: 'Berhasil',
        description: 'Siswa berhasil ditambahkan',
      })
      setIsAddOpen(false)
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
      oldStudent,
    }: {
      id: string
      values: StudentFormValues
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
      toast({
        title: 'Berhasil',
        description: 'Siswa berhasil diperbarui',
      })
      setIsEditOpen(false)
      setEditingStudent(null)
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
      toast({
        title: 'Berhasil',
        description: 'Siswa berhasil dihapus',
      })
      setIsDeleteOpen(false)
      setDeleteTargetIds([])
      setDeletingStudents([])
      setSelectedRows([])
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: ({
      ids,
      kelas,
    }: {
      ids: string[]
      kelas: string
      oldStudents: Student[]
    }) => bulkUpdateStudents(ids, { kelas }),
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
            {
              ...studentToRecord(oldStudent),
              kelas: variables.kelas,
            }
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
      setBulkEditData({ kelas: '' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const bulkImportMutation = useMutation({
    mutationFn: (items: CreateStudentInput[]) => bulkCreateStudents(items),
    onSuccess: async (results) => {
      const userId = getUserId()
      if (userId) {
        for (const result of results) {
          await logAudit(
            userId,
            'CREATE',
            'students',
            result.id,
            null,
            studentToRecord(result)
          )
        }
      }
      invalidateStudents()
      toast({
        title: 'Berhasil',
        description: `${results.length} siswa berhasil diimport`,
      })
      setIsBulkImportOpen(false)
      setBulkImportText('')
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleUnitChange = (unit: Unit) => {
    setActiveUnit(unit)
    setPage(1)
    setSelectedRows([])
    setSelectedClassFilter('all')
  }

  const handleSortChange = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field)
    setSortDirection(direction)
    setPage(1)
  }

  const openAddDialog = () => {
    form.reset({ nama: '', kelas: '', jenis_kelamin: 'L' })
    setIsAddOpen(true)
  }

  const openEditDialog = (student: Student) => {
    setEditingStudent(student)
    form.reset({
      nama: student.nama,
      kelas: student.kelas,
      jenis_kelamin: student.jenis_kelamin ?? 'L',
    })
    setIsEditOpen(true)
  }

  const openSingleDelete = (student: Student) => {
    setDeleteTargetIds([student.id])
    setDeletingStudents([student])
    setIsDeleteOpen(true)
  }

  const openBulkDelete = () => {
    const studentsToDelete =
      data?.data.filter((s) => selectedRows.includes(s.id)) ?? []
    setDeleteTargetIds(selectedRows)
    setDeletingStudents(studentsToDelete)
    setIsDeleteOpen(true)
  }

  const openBulkEdit = () => {
    setBulkEditData({ kelas: '' })
    setIsBulkEditOpen(true)
  }

  const handleBulkEditSubmit = () => {
    const kelas = bulkEditData.kelas.trim()
    if (kelas.length < 1) {
      toast({
        title: 'Validasi gagal',
        description: 'Kelas wajib diisi',
        variant: 'destructive',
      })
      return
    }

    const oldStudents =
      data?.data.filter((s) => selectedRows.includes(s.id)) ?? []

    bulkUpdateMutation.mutate({
      ids: selectedRows,
      kelas,
      oldStudents,
    })
  }

  const onSubmitForm = (values: StudentFormValues) => {
    if (isEditOpen && editingStudent) {
      updateMutation.mutate({
        id: editingStudent.id,
        values,
        oldStudent: editingStudent,
      })
    } else {
      createMutation.mutate(values)
    }
  }

  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama',
        header: 'Nama',
      },
      {
        accessorKey: 'kelas',
        header: 'Kelas',
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

  const isFormSubmitting = createMutation.isPending || updateMutation.isPending
  const isFormOpen = isAddOpen || isEditOpen

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Siswa"
        actions={
          <>
            <Button type="button" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Siswa
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkImportOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Banyak
            </Button>
          </>
        }
      />

      <Tabs
        value={activeUnit}
        onValueChange={(value) => handleUnitChange(value as Unit)}
      >
        <TabsList>
          {UNITS.map((unit) => (
            <TabsTrigger key={unit} value={unit}>
              {unit}
            </TabsTrigger>
          ))}
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
        </div>
        {selectedRows.length > 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            {selectedRows.length} data terpilih
          </p>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <span className="text-sm text-[var(--text-primary)]">
            {selectedRows.length} item terpilih
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openBulkEdit}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit Kelas Terpilih
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={openBulkDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus {selectedRows.length} terpilih
          </Button>
        </div>
      )}

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
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onSortChange={handleSortChange}
        selectedRows={selectedRows}
        onSelectRows={setSelectedRows}
        isLoading={isLoading}
      />

      {/* Dialog Tambah/Edit */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false)
            setIsEditOpen(false)
            setEditingStudent(null)
            form.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditOpen ? 'Edit Siswa' : 'Tambah Siswa'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(onSubmitForm)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" {...form.register('nama')} />
              {form.formState.errors.nama && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.nama.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kelas">Kelas</Label>
              <Input id="kelas" {...form.register('kelas')} />
              {form.formState.errors.kelas && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.kelas.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <RadioGroup
                value={form.watch('jenis_kelamin')}
                onValueChange={(value) =>
                  form.setValue('jenis_kelamin', value as JenisKelamin, {
                    shouldValidate: true,
                  })
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="L" id="jk-l" />
                  <Label htmlFor="jk-l" className="font-normal">
                    Laki-laki
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="P" id="jk-p" />
                  <Label htmlFor="jk-p" className="font-normal">
                    Perempuan
                  </Label>
                </div>
              </RadioGroup>
              {form.formState.errors.jenis_kelamin && (
                <p className="text-xs text-status-red">
                  {form.formState.errors.jenis_kelamin.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false)
                  setIsEditOpen(false)
                  setEditingStudent(null)
                  form.reset()
                }}
              >
                Batal
              </Button>
              <Button type="submit" isLoading={isFormSubmitting}>
                {isEditOpen ? 'Simpan' : 'Tambah'}
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

      {/* Dialog Bulk Edit */}
      <Dialog
        open={isBulkEditOpen}
        onOpenChange={(open) => {
          setIsBulkEditOpen(open)
          if (!open) {
            setBulkEditData({ kelas: '' })
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Kelas Massal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Mengedit {selectedRows.length} siswa terpilih
            </p>
            <div className="space-y-2">
              <Label htmlFor="bulk-edit-kelas">Kelas Baru</Label>
              <Input
                id="bulk-edit-kelas"
                placeholder="Masukkan kelas baru..."
                value={bulkEditData.kelas}
                onChange={(e) =>
                  setBulkEditData({ kelas: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsBulkEditOpen(false)
                setBulkEditData({ kelas: '' })
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

      {/* Dialog Bulk Import */}
      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Banyak Siswa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-import">
                Format: Nama,Kelas,JenisKelamin (satu baris per siswa)
              </Label>
              <textarea
                id="bulk-import"
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
                rows={8}
                placeholder={'Budi Santoso,5A,L\nSiti Aminah,5B,P'}
                className={cn(
                  'flex w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-primary'
                )}
              />
            </div>

            {bulkParseResult.errors.length > 0 && (
              <div className="rounded-md border border-status-red/20 bg-status-red-bg px-3 py-2">
                <p className="mb-1 text-sm font-medium text-status-red">
                  Baris dengan format salah:
                </p>
                <ul className="space-y-1 text-xs text-status-red">
                  {bulkParseResult.errors.map((err) => (
                    <li key={err.line}>
                      Baris {err.line}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {bulkParseResult.valid.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Preview ({bulkParseResult.valid.length} siswa)
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>JK</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkParseResult.valid.slice(0, 5).map((row, index) => (
                      <TableRow key={`${row.nama}-${index}`}>
                        <TableCell>{row.nama}</TableCell>
                        <TableCell>{row.kelas}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {row.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {bulkParseResult.valid.length > 5 && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    ...dan {bulkParseResult.valid.length - 5} lainnya
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsBulkImportOpen(false)
                setBulkImportText('')
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              isLoading={bulkImportMutation.isPending}
              disabled={
                bulkParseResult.valid.length === 0 ||
                bulkParseResult.errors.length > 0
              }
              onClick={() =>
                bulkImportMutation.mutate(bulkParseResult.valid)
              }
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
