'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Edit, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit/log'
import {
  createSemester,
  createTahunPelajaran,
  deleteSemester,
  deleteTahunPelajaran,
  getSemester,
  getTahunPelajaran,
  setActiveSemester,
  setActiveTahunPelajaran,
  updateSemester,
  updateTahunPelajaran,
  type CreateSemesterInput,
  type CreateTahunPelajaranInput,
  type Semester,
  type TahunPelajaran,
} from '@/lib/queries/semester'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const tahunSchema = z.object({
  nama: z.string().min(3, 'Nama minimal 3 karakter').regex(/\d{4}/, 'Format: YYYY/YYYY'),
  tahun_mulai: z
    .number({ message: 'Wajib angka' })
    .min(2000)
    .max(2100),
  tahun_selesai: z
    .number({ message: 'Wajib angka' })
    .min(2000)
    .max(2100),
})

type TahunFormValues = z.infer<typeof tahunSchema>

const semesterSchema = z.object({
  nomor_semester: z.enum(['1', '2'], { message: 'Pilih nomor semester' }),
  tanggal_mulai: z.string().min(1, 'Tanggal mulai wajib diisi'),
  tanggal_selesai: z.string().min(1, 'Tanggal selesai wajib diisi'),
})

type SemesterFormValues = z.infer<typeof semesterSchema>

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatTanggal(date: string): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function SemesterPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAdmin, isLoading: authLoading, profile } = useAuth()

  // State Tahun Pelajaran
  const [isTahunAddOpen, setIsTahunAddOpen] = useState(false)
  const [isTahunEditOpen, setIsTahunEditOpen] = useState(false)
  const [editingTahun, setEditingTahun] = useState<TahunPelajaran | null>(null)
  const [deletingTahun, setDeletingTahun] = useState<TahunPelajaran | null>(null)
  const [isTahunDeleteOpen, setIsTahunDeleteOpen] = useState(false)

  // State Semester
  const [selectedTahunId, setSelectedTahunId] = useState<string>('')
  const [isSemAddOpen, setIsSemAddOpen] = useState(false)
  const [isSemEditOpen, setIsSemEditOpen] = useState(false)
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null)
  const [deletingSemester, setDeletingSemester] = useState<Semester | null>(null)
  const [isSemDeleteOpen, setIsSemDeleteOpen] = useState(false)

  const tahunForm = useForm<TahunFormValues>({
    resolver: zodResolver(tahunSchema),
    defaultValues: { nama: '', tahun_mulai: new Date().getFullYear(), tahun_selesai: new Date().getFullYear() + 1 },
  })

  const semesterForm = useForm<SemesterFormValues>({
    resolver: zodResolver(semesterSchema),
    defaultValues: { nomor_semester: '1', tanggal_mulai: '', tanggal_selesai: '' },
  })

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/dashboard')
  }, [authLoading, isAdmin, router])

  const getUserId = (): string => {
    if (!profile?.user_id) throw new Error('Sesi tidak valid')
    return profile.user_id
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: tahunList = [], isLoading: isLoadingTahun } = useQuery({
    queryKey: ['tahun-pelajaran'],
    queryFn: getTahunPelajaran,
    enabled: isAdmin,
  })

  const { data: semesterList = [], isLoading: isLoadingSemester } = useQuery({
    queryKey: ['semester', selectedTahunId],
    queryFn: () => getSemester(selectedTahunId),
    enabled: !!selectedTahunId,
  })

  const invalidateTahun = () => {
    queryClient.invalidateQueries({ queryKey: ['tahun-pelajaran'] })
  }
  const invalidateSemester = () => {
    queryClient.invalidateQueries({ queryKey: ['semester'] })
  }

  // ─── Mutations Tahun ─────────────────────────────────────────────────────

  const createTahunMutation = useMutation({
    mutationFn: (input: CreateTahunPelajaranInput) => createTahunPelajaran(input),
    onSuccess: async (result) => {
      await logAudit(getUserId(), 'CREATE', 'tahun_pelajaran', result.id, null, result as unknown as Record<string, unknown>)
      invalidateTahun()
      toast({ title: 'Berhasil', description: 'Tahun pelajaran berhasil ditambahkan' })
      setIsTahunAddOpen(false)
      tahunForm.reset()
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    },
  })

  const updateTahunMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TahunFormValues; old: TahunPelajaran }) =>
      updateTahunPelajaran(id, values),
    onSuccess: async (result, variables) => {
      await logAudit(getUserId(), 'UPDATE', 'tahun_pelajaran', result.id, variables.old as unknown as Record<string, unknown>, result as unknown as Record<string, unknown>)
      invalidateTahun()
      toast({ title: 'Berhasil', description: 'Tahun pelajaran berhasil diperbarui' })
      setIsTahunEditOpen(false)
      setEditingTahun(null)
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    },
  })

  const deleteTahunMutation = useMutation({
    mutationFn: (id: string) => deleteTahunPelajaran(id),
    onSuccess: async (_, id) => {
      if (deletingTahun) {
        await logAudit(getUserId(), 'DELETE', 'tahun_pelajaran', id, deletingTahun as unknown as Record<string, unknown>, null)
      }
      invalidateTahun()
      if (selectedTahunId === id) setSelectedTahunId('')
      toast({ title: 'Berhasil', description: 'Tahun pelajaran berhasil dihapus' })
      setIsTahunDeleteOpen(false)
      setDeletingTahun(null)
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    },
  })

  const setActiveTahunMutation = useMutation({
    mutationFn: (id: string) => setActiveTahunPelajaran(id),
    onSuccess: () => {
      invalidateTahun()
      toast({ title: 'Berhasil', description: 'Tahun pelajaran aktif diperbarui. Hanya 1 yang bisa aktif.' })
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    },
  })

  // ─── Mutations Semester ───────────────────────────────────────────────────

  const createSemesterMutation = useMutation({
    mutationFn: (input: CreateSemesterInput) => createSemester(input),
    onSuccess: async (result) => {
      await logAudit(getUserId(), 'CREATE', 'semester', result.id, null, result as unknown as Record<string, unknown>)
      invalidateSemester()
      toast({ title: 'Berhasil', description: 'Semester berhasil ditambahkan' })
      setIsSemAddOpen(false)
      semesterForm.reset()
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    },
  })

  const updateSemesterMutation = useMutation({
    mutationFn: ({ id, values, old }: { id: string; values: SemesterFormValues; old: Semester }) =>
      updateSemester(id, {
        nomor_semester: parseInt(values.nomor_semester) as 1 | 2,
        tanggal_mulai: values.tanggal_mulai,
        tanggal_selesai: values.tanggal_selesai,
      }).then((result) => ({ result, old })),
    onSuccess: async ({ result, old }) => {
      await logAudit(getUserId(), 'UPDATE', 'semester', result.id, old as unknown as Record<string, unknown>, result as unknown as Record<string, unknown>)
      invalidateSemester()
      toast({ title: 'Berhasil', description: 'Semester berhasil diperbarui' })
      setIsSemEditOpen(false)
      setEditingSemester(null)
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    },
  })

  const deleteSemesterMutation = useMutation({
    mutationFn: (id: string) => deleteSemester(id),
    onSuccess: async (_, id) => {
      if (deletingSemester) {
        await logAudit(getUserId(), 'DELETE', 'semester', id, deletingSemester as unknown as Record<string, unknown>, null)
      }
      invalidateSemester()
      toast({ title: 'Berhasil', description: 'Semester berhasil dihapus' })
      setIsSemDeleteOpen(false)
      setDeletingSemester(null)
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    },
  })

  const setActiveSemesterMutation = useMutation({
    mutationFn: ({ id, tahunId }: { id: string; tahunId: string }) =>
      setActiveSemester(id, tahunId),
    onSuccess: () => {
      invalidateSemester()
      toast({ title: 'Berhasil', description: 'Semester aktif diperbarui. Hanya 1 yang bisa aktif.' })
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal', description: err.message, variant: 'destructive' })
    },
  })

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const openEditTahun = (tp: TahunPelajaran) => {
    setEditingTahun(tp)
    tahunForm.reset({ nama: tp.nama, tahun_mulai: tp.tahun_mulai, tahun_selesai: tp.tahun_selesai })
    setIsTahunEditOpen(true)
  }

  const openEditSemester = (sem: Semester) => {
    setEditingSemester(sem)
    semesterForm.reset({
      nomor_semester: String(sem.nomor_semester) as '1' | '2',
      tanggal_mulai: sem.tanggal_mulai,
      tanggal_selesai: sem.tanggal_selesai,
    })
    setIsSemEditOpen(true)
  }

  const onSubmitTahun = (values: TahunFormValues) => {
    if (isTahunEditOpen && editingTahun) {
      updateTahunMutation.mutate({ id: editingTahun.id, values, old: editingTahun })
    } else {
      createTahunMutation.mutate(values)
    }
  }

  const onSubmitSemester = (values: SemesterFormValues) => {
    if (isSemEditOpen && editingSemester) {
      updateSemesterMutation.mutate({ id: editingSemester.id, values, old: editingSemester })
    } else {
      if (!selectedTahunId) return
      // Cek maksimal 2 semester per tahun
      if (semesterList.length >= 2) {
        toast({
          title: 'Batas Tercapai',
          description: 'Maksimal 2 semester per tahun pelajaran',
          variant: 'destructive',
        })
        return
      }
      createSemesterMutation.mutate({
        tahun_pelajaran_id: selectedTahunId,
        nomor_semester: parseInt(values.nomor_semester) as 1 | 2,
        tanggal_mulai: values.tanggal_mulai,
        tanggal_selesai: values.tanggal_selesai,
      })
    }
  }

  const selectedTahunData = useMemo(
    () => tahunList.find((tp) => tp.id === selectedTahunId),
    [tahunList, selectedTahunId]
  )

  const isTahunFormOpen = isTahunAddOpen || isTahunEditOpen
  const isSemFormOpen = isSemAddOpen || isSemEditOpen

  if (authLoading || !isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Semester & Tahun Pelajaran"
        actions={
          <Button type="button" onClick={() => setIsTahunAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Tahun Pelajaran
          </Button>
        }
      />

      {/* ── SECTION 1: Tahun Pelajaran ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Tahun Pelajaran</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTahun ? (
            <div className="space-y-3">
              {[...Array<number>(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : tahunList.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-tertiary)]">
              Belum ada tahun pelajaran. Klik "Tambah Tahun Pelajaran" untuk memulai.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Tahun</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tahunList.map((tp, index) => (
                  <TableRow key={tp.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{tp.nama}</TableCell>
                    <TableCell>
                      {tp.tahun_mulai} / {tp.tahun_selesai}
                    </TableCell>
                    <TableCell>
                      {tp.is_aktif ? (
                        <Badge variant="default">AKTIF</Badge>
                      ) : (
                        <Badge variant="outline">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditTahun(tp)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!tp.is_aktif && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setActiveTahunMutation.mutate(tp.id)}
                            title="Jadikan Aktif"
                            disabled={setActiveTahunMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingTahun(tp)
                            setIsTahunDeleteOpen(true)
                          }}
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4 text-status-red" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── SECTION 2: Semester ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Semester</CardTitle>
          {selectedTahunId && semesterList.length < 2 && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                semesterForm.reset({ nomor_semester: '1', tanggal_mulai: '', tanggal_selesai: '' })
                setIsSemAddOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tambah Semester
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {/* Pilih Tahun Pelajaran */}
          <div className="mb-6 max-w-sm space-y-2">
            <Label htmlFor="pilih-tahun">Pilih Tahun Pelajaran</Label>
            <Select
              value={selectedTahunId}
              onValueChange={(v) => setSelectedTahunId(v)}
            >
              <SelectTrigger id="pilih-tahun">
                <SelectValue placeholder="Pilih tahun pelajaran..." />
              </SelectTrigger>
              <SelectContent>
                {tahunList.map((tp) => (
                  <SelectItem key={tp.id} value={tp.id}>
                    {tp.nama} {tp.is_aktif ? '(Aktif)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedTahunId ? (
            <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">
              Pilih tahun pelajaran terlebih dahulu untuk melihat semesternya.
            </p>
          ) : isLoadingSemester ? (
            <div className="space-y-3">
              {[...Array<number>(2)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : semesterList.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">
              Belum ada semester untuk tahun pelajaran <strong>{selectedTahunData?.nama}</strong>.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Tanggal Mulai</TableHead>
                  <TableHead>Tanggal Selesai</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {semesterList.map((sem, index) => (
                  <TableRow key={sem.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      Semester {sem.nomor_semester}
                    </TableCell>
                    <TableCell>{formatTanggal(sem.tanggal_mulai)}</TableCell>
                    <TableCell>{formatTanggal(sem.tanggal_selesai)}</TableCell>
                    <TableCell>
                      {sem.is_aktif ? (
                        <Badge variant="default">AKTIF</Badge>
                      ) : (
                        <Badge variant="outline">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditSemester(sem)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!sem.is_aktif && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setActiveSemesterMutation.mutate({
                                id: sem.id,
                                tahunId: selectedTahunId,
                              })
                            }
                            title="Jadikan Aktif"
                            disabled={setActiveSemesterMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingSemester(sem)
                            setIsSemDeleteOpen(true)
                          }}
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4 text-status-red" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog Tahun Pelajaran ─────────────────────────────────────── */}
      <Dialog
        open={isTahunFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsTahunAddOpen(false)
            setIsTahunEditOpen(false)
            setEditingTahun(null)
            tahunForm.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isTahunEditOpen ? 'Edit Tahun Pelajaran' : 'Tambah Tahun Pelajaran'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={tahunForm.handleSubmit(onSubmitTahun)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tp-nama">Nama</Label>
              <Input
                id="tp-nama"
                {...tahunForm.register('nama')}
                placeholder="cth: 2025/2026"
              />
              {tahunForm.formState.errors.nama && (
                <p className="text-xs text-status-red">{tahunForm.formState.errors.nama.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tp-mulai">Tahun Mulai</Label>
                <Input
                  id="tp-mulai"
                  type="number"
                  {...tahunForm.register('tahun_mulai', { valueAsNumber: true })}
                  placeholder="2025"
                />
                {tahunForm.formState.errors.tahun_mulai && (
                  <p className="text-xs text-status-red">{tahunForm.formState.errors.tahun_mulai.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="tp-selesai">Tahun Selesai</Label>
                <Input
                  id="tp-selesai"
                  type="number"
                  {...tahunForm.register('tahun_selesai', { valueAsNumber: true })}
                  placeholder="2026"
                />
                {tahunForm.formState.errors.tahun_selesai && (
                  <p className="text-xs text-status-red">{tahunForm.formState.errors.tahun_selesai.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsTahunAddOpen(false)
                  setIsTahunEditOpen(false)
                  setEditingTahun(null)
                  tahunForm.reset()
                }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                isLoading={createTahunMutation.isPending || updateTahunMutation.isPending}
              >
                {isTahunEditOpen ? 'Simpan' : 'Tambah'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Semester ────────────────────────────────────────────── */}
      <Dialog
        open={isSemFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSemAddOpen(false)
            setIsSemEditOpen(false)
            setEditingSemester(null)
            semesterForm.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isSemEditOpen ? 'Edit Semester' : 'Tambah Semester'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={semesterForm.handleSubmit(onSubmitSemester)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sem-nomor">Nomor Semester</Label>
              <Select
                value={semesterForm.watch('nomor_semester')}
                onValueChange={(v) =>
                  semesterForm.setValue('nomor_semester', v as '1' | '2', { shouldValidate: true })
                }
              >
                <SelectTrigger id="sem-nomor">
                  <SelectValue placeholder="Pilih semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Semester 1 (Ganjil)</SelectItem>
                  <SelectItem value="2">Semester 2 (Genap)</SelectItem>
                </SelectContent>
              </Select>
              {semesterForm.formState.errors.nomor_semester && (
                <p className="text-xs text-status-red">
                  {semesterForm.formState.errors.nomor_semester.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sem-mulai">Tanggal Mulai</Label>
              <Input
                id="sem-mulai"
                type="date"
                {...semesterForm.register('tanggal_mulai')}
              />
              {semesterForm.formState.errors.tanggal_mulai && (
                <p className="text-xs text-status-red">
                  {semesterForm.formState.errors.tanggal_mulai.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sem-selesai">Tanggal Selesai</Label>
              <Input
                id="sem-selesai"
                type="date"
                {...semesterForm.register('tanggal_selesai')}
              />
              {semesterForm.formState.errors.tanggal_selesai && (
                <p className="text-xs text-status-red">
                  {semesterForm.formState.errors.tanggal_selesai.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsSemAddOpen(false)
                  setIsSemEditOpen(false)
                  setEditingSemester(null)
                  semesterForm.reset()
                }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                isLoading={createSemesterMutation.isPending || updateSemesterMutation.isPending}
              >
                {isSemEditOpen ? 'Simpan' : 'Tambah'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── ConfirmDialog Hapus Tahun ──────────────────────────────────── */}
      <ConfirmDialog
        open={isTahunDeleteOpen}
        onOpenChange={setIsTahunDeleteOpen}
        title="Hapus Tahun Pelajaran"
        description={`Apakah Anda yakin ingin menghapus tahun pelajaran "${deletingTahun?.nama}"? Semua semester dalam tahun ini juga akan dihapus.`}
        variant="destructive"
        isLoading={deleteTahunMutation.isPending}
        onConfirm={() => {
          if (deletingTahun) deleteTahunMutation.mutate(deletingTahun.id)
        }}
      />

      {/* ── ConfirmDialog Hapus Semester ──────────────────────────────── */}
      <ConfirmDialog
        open={isSemDeleteOpen}
        onOpenChange={setIsSemDeleteOpen}
        title="Hapus Semester"
        description={`Apakah Anda yakin ingin menghapus Semester ${deletingSemester?.nomor_semester}?`}
        variant="destructive"
        isLoading={deleteSemesterMutation.isPending}
        onConfirm={() => {
          if (deletingSemester) deleteSemesterMutation.mutate(deletingSemester.id)
        }}
      />
    </div>
  )
}
