'use client'

import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ChevronRight, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDebounce } from '@/hooks/use-debounce'
import {
  getActiveSemesterDiknas,
  getKelasOptions,
  getMataKuliah,
  getNilaiHarian,
  getSemesterOptions,
  getRaportSiswa,
  type MataKuliah,
  type NilaiHarianEntry,
  type RaportSiswa,
} from '@/lib/queries/diknas'
import type { Unit } from '@/lib/supabase/types'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const

// ─── Tipe lokal ───────────────────────────────────────────────────────────────

// ─── Helper ────────────────────────────────────────────────────────────────────

function getNilaiColor(nilai: number): string {
  return nilai >= 70 ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'
}

function formatNilai(n: number | null): string {
  if (n === null) return '-'
  return n.toFixed(1)
}

// ─── Halaman ──────────────────────────────────────────────────────────────────

export default function RekapNilaiPage() {
  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [filterKelas, setFilterKelas] = useState('all')
  const [filterMapel, setFilterMapel] = useState('all')
  const [filterSemester, setFilterSemester] = useState('aktif')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detailSiswa, setDetailSiswa] = useState<RaportSiswa | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester-diknas'],
    queryFn: getActiveSemesterDiknas,
  })

  const { data: semesterList = [] } = useQuery({
    queryKey: ['semester-options'],
    queryFn: getSemesterOptions,
  })

  const { data: mapelList = [] } = useQuery({
    queryKey: ['mapel-list', activeUnit],
    queryFn: () => getMataKuliah(activeUnit),
  })

  const resolvedSemesterId = useMemo(() => {
    if (filterSemester === 'aktif') return activeSemester?.id
    if (filterSemester === 'all') return undefined
    return filterSemester
  }, [filterSemester, activeSemester])

  const raportFilters = useMemo(
    () => ({
      semesterId: resolvedSemesterId ?? '',
      unit: activeUnit,
      kelas: filterKelas !== 'all' ? filterKelas : undefined,
      mapelId: filterMapel !== 'all' ? filterMapel : undefined,
      search: debouncedSearch || undefined,
    }),
    [resolvedSemesterId, activeUnit, filterKelas, filterMapel, debouncedSearch]
  )

  const { data: raportData = [], isLoading } = useQuery({
    queryKey: ['rekap-nilai', raportFilters],
    queryFn: () =>
      resolvedSemesterId ? getRaportSiswa(raportFilters) : Promise.resolve([]),
    enabled: Boolean(resolvedSemesterId),
  })

  // Detail nilai harian untuk siswa yang dipilih
  const detailFilters = useMemo(
    () => ({
      semesterId: resolvedSemesterId ?? '',
      mapelId: filterMapel !== 'all' ? filterMapel : undefined,
      search: detailSiswa?.nama ?? '',
      page: 1,
      pageSize: 50,
    }),
    [resolvedSemesterId, filterMapel, detailSiswa]
  )

  const { data: detailNilai } = useQuery({
    queryKey: ['nilai-harian-detail', detailSiswa?.siswa_id, detailFilters],
    queryFn: async () => {
      if (!detailSiswa) return { data: [], total: 0 }
      const result = await getNilaiHarian({ ...detailFilters, search: undefined })
      // Filter ke siswa yang dipilih
      return {
        data: result.data.filter((n) => n.siswa_id === detailSiswa.siswa_id),
        total: result.data.filter((n) => n.siswa_id === detailSiswa.siswa_id).length,
      }
    },
    enabled: isDetailOpen && Boolean(detailSiswa),
  })

  // ─── Pagination client-side ───────────────────────────────────────────────

  const pagedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return raportData.slice(from, from + pageSize)
  }, [raportData, page, pageSize])

  // ─── Columns ────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<RaportSiswa>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
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
        id: 'avg_formatif',
        header: 'Avg Formatif',
        cell: ({ row }) => (
          <span className={getNilaiColor(row.original.avg_formatif)}>
            {formatNilai(row.original.avg_formatif)}
          </span>
        ),
      },
      {
        id: 'avg_sumatif',
        header: 'Avg Sumatif',
        cell: ({ row }) => (
          <span className={getNilaiColor(row.original.avg_sumatif)}>
            {formatNilai(row.original.avg_sumatif)}
          </span>
        ),
      },
      {
        id: 'nilai_uas',
        header: 'Nilai UAS',
        cell: ({ row }) =>
          row.original.nilai_uas !== null ? (
            <span className={getNilaiColor(row.original.nilai_uas)}>
              {formatNilai(row.original.nilai_uas)}
            </span>
          ) : (
            <span className="text-[var(--text-tertiary)]">-</span>
          ),
      },
      {
        id: 'nilai_rapor',
        header: 'Nilai Rapor',
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              row.original.nilai_rapor >= 70
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}
          >
            {formatNilai(row.original.nilai_rapor)}
          </span>
        ),
      },
      {
        id: 'aksi',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => {
              setDetailSiswa(row.original)
              setIsDetailOpen(true)
            }}
          >
            Detail
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [page, pageSize]
  )

  const { data: kelasList = [] } = useQuery({
    queryKey: ['kelas-options', activeUnit],
    queryFn: () => getKelasOptions(activeUnit),
  })

  // Reset filter kelas jika tidak valid saat unit berubah
  useEffect(() => {
    if (filterKelas !== 'all' && kelasList.length > 0 && !kelasList.some((k) => k.id === filterKelas)) {
      setFilterKelas('all')
    }
  }, [activeUnit, kelasList, filterKelas])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Unit Tabs */}
      <Tabs
        value={activeUnit}
        onValueChange={(v) => {
          setActiveUnit(v as Unit)
          setPage(1)
          setFilterKelas('all')
          setFilterMapel('all')
        }}
      >
        <TabsList className="no-print">
          {UNITS.map((u) => <TabsTrigger key={u} value={u}>{u}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {/* Filter bar */}
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
        <Select value={filterKelas} onValueChange={(v) => { setFilterKelas(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Kelas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {kelasList.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMapel} onValueChange={(v) => { setFilterMapel(v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Mapel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Mapel</SelectItem>
            {mapelList.map((m: MataKuliah) => <SelectItem key={m.id} value={m.id}>{m.nama_mapel}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Info tidak ada semester */}
      {!resolvedSemesterId && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800/40 dark:bg-yellow-900/20 dark:text-yellow-400">
          Pilih semester untuk menampilkan rekap nilai. Tidak ada semester aktif yang terdeteksi.
        </div>
      )}

      {/* Tabel */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={pagedData}
          pagination={{
            page,
            pageSize,
            total: raportData.length,
          }}
          pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          onSortChange={() => {}}
          isLoading={isLoading}
        />
      )}
      {/* ─── Sheet Detail ─── */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <div className="px-4 md:px-6 space-y-4">
            <SheetHeader>
              <SheetTitle>Detail Nilai — {detailSiswa?.nama}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {/* Summary card */}
              {detailSiswa && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Kelas', value: detailSiswa.kelas },
                    { label: 'Avg Formatif', value: formatNilai(detailSiswa.avg_formatif) },
                    { label: 'Avg Sumatif', value: formatNilai(detailSiswa.avg_sumatif) },
                    {
                      label: 'Nilai Rapor',
                      value: formatNilai(detailSiswa.nilai_rapor),
                      highlight: true,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-lg border p-3 ${
                        item.highlight
                          ? 'border-primary/30 bg-[var(--primary-light)]'
                          : 'border-[var(--border)] bg-[var(--surface)]'
                      }`}
                    >
                      <p className="text-xs text-[var(--text-secondary)]">{item.label}</p>
                      <p
                        className={`text-lg font-bold ${
                          item.highlight ? 'text-primary' : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabel detail nilai harian */}
              <div>
                <Label className="mb-2 block text-sm font-semibold">Riwayat Nilai Harian</Label>
                {!detailNilai ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : detailNilai.data.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Belum ada nilai harian tercatat.</p>
                ) : (
                  <div className="overflow-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                          <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Tugas</th>
                          <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)]">Tipe</th>
                          <th className="px-3 py-2 text-right font-medium text-[var(--text-secondary)]">Nilai Asli</th>
                          <th className="px-3 py-2 text-right font-medium text-[var(--text-secondary)]">Remedial</th>
                          <th className="px-3 py-2 text-right font-medium text-[var(--text-secondary)]">Final</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailNilai.data.map((n: NilaiHarianEntry) => (
                          <tr key={n.id} className="border-b border-[var(--border)] last:border-0">
                            <td className="px-3 py-2 text-[var(--text-primary)]">{n.nama_tugas}</td>
                            <td className="px-3 py-2 text-[var(--text-secondary)]">{n.tipe_nilai}</td>
                            <td className="px-3 py-2 text-right text-[var(--text-primary)]">
                              {n.nilai_asli ?? '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-[var(--text-secondary)]">
                              {n.nilai_remedial ?? '-'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={getNilaiColor(n.nilai_final ?? 0)}>
                                {n.nilai_final ?? '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
