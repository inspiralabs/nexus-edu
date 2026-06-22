'use client'

// src/app/(app)/diknas/laporan-bulanan/page.tsx

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import {
  BookOpen,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Filter,
  GraduationCap,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { PrintPreviewModal } from '@/components/report/print-preview-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { getAllKelas } from '@/lib/queries/admin-extended'
import { getSemesterOptions, getActiveSemesterDiknas } from '@/lib/queries/diknas'
import {
  getKelasReportSummary,
  getSiswaReport,
  type ReportPeriod,
  type SiswaReport,
} from '@/lib/queries/report'
import type { Kelas, Unit } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: format(new Date(2000, i, 1), 'MMMM', { locale: idLocale }),
}))

type PeriodMode = 'month' | 'semester'

function CompletionBadge({ status }: { status: 'Lengkap' | 'Belum Lengkap' | 'Kosong' }) {
  const config = {
    Lengkap: {
      className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25',
      label: 'Lengkap',
    },
    'Belum Lengkap': {
      className: 'bg-amber-500/15 text-amber-600 border-amber-500/25',
      label: 'Belum Lengkap',
    },
    Kosong: {
      className: 'bg-slate-500/15 text-slate-500 border-slate-500/25',
      label: 'Kosong',
    },
  }
  const { className, label } = config[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className
      )}
    >
      {label}
    </span>
  )
}

function FilterPanel({
  unit,
  onUnitChange,
  periodMode,
  onPeriodModeChange,
  selectedMonthKey,
  monthOptions,
  onMonthChange,
  onYearChange,
  selectedSemesterId,
  onSemesterIdChange,
  semesterOptions,
  kelasList,
  selectedKelasId,
  onKelasChange,
  search,
  onSearchChange,
}: {
  unit: Unit
  onUnitChange: (v: Unit) => void
  periodMode: PeriodMode
  onPeriodModeChange: (v: PeriodMode) => void
  selectedMonthKey: string
  monthOptions: Array<{ value: string; label: string; year: number; month: number }>
  onMonthChange: (v: number) => void
  onYearChange: (v: number) => void
  selectedSemesterId: string
  onSemesterIdChange: (v: string) => void
  semesterOptions: Array<{ id: string; label: string; tahunAjaran: string }>
  kelasList: Kelas[]
  selectedKelasId: string
  onKelasChange: (v: string) => void
  search: string
  onSearchChange: (v: string) => void
}) {
  return (
    <Card className="border-[var(--border)] bg-[var(--surface)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
          <Filter className="h-4 w-4" />
          Filter Laporan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unit Tabs */}
        <div>
          <Label className="mb-2 block text-xs text-[var(--text-secondary)]">Unit</Label>
          <Tabs
            value={unit}
            onValueChange={(v) => onUnitChange(v as Unit)}
          >
            <TabsList className="h-9">
              {UNITS.map((u) => (
                <TabsTrigger key={u} value={u} className="text-xs">
                  {u}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Period Mode */}
        <div>
          <Label className="mb-2 block text-xs text-[var(--text-secondary)]">Mode Periode</Label>
          <Tabs
            value={periodMode}
            onValueChange={(v) => onPeriodModeChange(v as PeriodMode)}
          >
            <TabsList className="h-9">
              <TabsTrigger value="month" className="text-xs gap-1.5">
                <Calendar className="h-3 w-3" />
                Per Bulan
              </TabsTrigger>
              <TabsTrigger value="semester" className="text-xs gap-1.5">
                <BookOpen className="h-3 w-3" />
                Per Semester
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Period Selector */}
        {periodMode === 'month' ? (
          <div>
            <Label className="mb-1 block text-xs text-[var(--text-secondary)]">Bulan</Label>
            <Select
              value={selectedMonthKey}
              onValueChange={(v) => {
                const opt = monthOptions.find((m) => m.value === v)
                if (opt) {
                  onMonthChange(opt.month)
                  onYearChange(opt.year)
                }
              }}
              disabled={monthOptions.length === 0}
            >
              <SelectTrigger id="select-month" className="h-9 text-xs">
                <SelectValue placeholder="Pilih bulan..." />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <Label className="mb-1 block text-xs text-[var(--text-secondary)]">Semester</Label>
            <Select
              value={selectedSemesterId}
              onValueChange={onSemesterIdChange}
              disabled={semesterOptions.length === 0}
            >
              <SelectTrigger id="select-semester" className="h-9 text-xs">
                <SelectValue placeholder="Pilih semester..." />
              </SelectTrigger>
              <SelectContent>
                {semesterOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Kelas */}
        <div>
          <Label className="mb-1 block text-xs text-[var(--text-secondary)]">Kelas</Label>
          <Select
            value={selectedKelasId}
            onValueChange={onKelasChange}
            disabled={kelasList.length === 0}
          >
            <SelectTrigger id="select-kelas" className="h-9 text-xs">
              <SelectValue placeholder="Pilih kelas..." />
            </SelectTrigger>
            <SelectContent>
              {kelasList.map((k) => (
                <SelectItem key={k.id} value={k.id} className="text-xs">
                  {k.nama_kelas}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div>
          <Label className="mb-1 block text-xs text-[var(--text-secondary)]">Cari Siswa</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              id="search-siswa"
              placeholder="Nama siswa..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function LaporanBulananPage() {
  const { profile } = useAuth()

  // ── Filter State ─────────────────────────────────────────────────────────────
  const now = new Date()
  const [unit, setUnit] = useState<Unit>('SD')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)

  // ── Print Modal State ─────────────────────────────────────────────────────────
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printSiswaId, setPrintSiswaId] = useState<string | null>(null)
  const [printReport, setPrintReport] = useState<SiswaReport | null>(null)
  const [printLoading, setPrintLoading] = useState(false)

  // ── Semester Options ──────────────────────────────────────────────────────────
  const { data: rawSemesters = [] } = useQuery({
    queryKey: ['semester-options'],
    queryFn: getSemesterOptions,
  })

  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester-diknas'],
    queryFn: getActiveSemesterDiknas,
  })

  // Sync selectedSemesterId ke activeSemester ketika activeSemester diload
  useEffect(() => {
    if (activeSemester?.id && !selectedSemesterId) {
      setSelectedSemesterId(activeSemester.id)
    }
  }, [activeSemester, selectedSemesterId])

  // ── Derived Period ────────────────────────────────────────────────────────────
  const period = useMemo<ReportPeriod | null>(() => {
    if (periodMode === 'month') {
      return { type: 'month', year: selectedYear, month: selectedMonth }
    }
    const semId = selectedSemesterId || activeSemester?.id
    if (semId) {
      return { type: 'semester', semesterId: semId }
    }
    return null
  }, [periodMode, selectedYear, selectedMonth, selectedSemesterId, activeSemester])

  const monthOptions = useMemo(() => {
    if (!activeSemester?.tanggal_mulai || !activeSemester?.tanggal_selesai) return []
    const start = new Date(activeSemester.tanggal_mulai)
    const end = new Date(activeSemester.tanggal_selesai)
    const months: { value: string; label: string; year: number; month: number }[] = []
    
    const monthNamesIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    let current = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)

    while (current <= last) {
      const m = current.getMonth()
      const y = current.getFullYear()
      
      months.push({
        value: `${y}-${String(m + 1).padStart(2, '0')}`,
        label: `${monthNamesIndo[m]} - ${y}`,
        year: y,
        month: m + 1,
      })
      current.setMonth(current.getMonth() + 1)
    }
    return months
  }, [activeSemester])

  const selectedMonthKey = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
  }, [selectedYear, selectedMonth])

  useEffect(() => {
    if (monthOptions.length > 0) {
      const exists = monthOptions.some((m) => m.value === selectedMonthKey)
      if (!exists) {
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const currentOpt = monthOptions.find((m) => m.value === currentMonthKey)
        if (currentOpt) {
          setSelectedMonth(currentOpt.month)
          setSelectedYear(currentOpt.year)
        } else {
          setSelectedMonth(monthOptions[0].month)
          setSelectedYear(monthOptions[0].year)
        }
      }
    }
  }, [monthOptions, selectedMonthKey])

  const semesterOptions = useMemo(
    () =>
      rawSemesters.map((s) => {
        const tp = s.tahun_pelajaran
        const tahunAjaran = tp
          ? Array.isArray(tp)
            ? ((tp[0] as { nama: string } | undefined)?.nama ?? '')
            : ((tp as unknown as { nama: string }).nama ?? '')
          : ''
        return {
          id: s.id,
          tahunAjaran,
          label: `Semester ${s.nomor_semester} — ${tahunAjaran}`,
        }
      }),
    [rawSemesters]
  )

  const currentSemester = useMemo(() => {
    if (periodMode === 'semester') {
      return rawSemesters.find((s) => s.id === selectedSemesterId) ?? null
    }
    return rawSemesters.find((s) => s.is_aktif) ?? null
  }, [selectedSemesterId, periodMode, rawSemesters])

  const tahunAjaran = useMemo(() => {
    if (periodMode === 'semester') {
      const found = semesterOptions.find((s) => s.id === selectedSemesterId)
      if (found) return found.tahunAjaran
    }
    const activeSmt = rawSemesters.find((s) => s.is_aktif)
    if (activeSmt) {
      const tp = activeSmt.tahun_pelajaran
      return tp
        ? Array.isArray(tp)
          ? ((tp[0] as { nama: string } | undefined)?.nama ?? '')
          : ((tp as unknown as { nama: string }).nama ?? '')
        : ''
    }
    return ''
  }, [semesterOptions, selectedSemesterId, periodMode, rawSemesters])

  // ── Kelas List ────────────────────────────────────────────────────────────────
  const { data: kelasList = [], isLoading: kelasLoading } = useQuery({
    queryKey: ['kelas-all', unit],
    queryFn: () => getAllKelas(unit),
  })

  // Reset kelas when unit changes
  const handleUnitChange = useCallback(
    (v: Unit) => {
      setUnit(v)
      setSelectedKelasId('')
    },
    []
  )

  // ── Summary Data ──────────────────────────────────────────────────────────────
  const canFetch =
    Boolean(selectedKelasId) &&
    period !== null &&
    (period.type === 'month' || period.semesterId !== '')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['kelas-report-summary', selectedKelasId, period],
    queryFn: () =>
      getKelasReportSummary({
        unit,
        kelasId: selectedKelasId,
        period: period!,
      }),
    enabled: canFetch,
  })

  // Filter siswa by search
  const filteredStudents = useMemo(() => {
    if (!summary) return []
    const q = debouncedSearch.toLowerCase().trim()
    if (!q) return summary.students
    return summary.students.filter((s) => s.nama.toLowerCase().includes(q))
  }, [summary, debouncedSearch])

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!summary) return null
    const total = summary.students.length
    const lengkap = summary.students.filter((s) => s.completenessStatus === 'Lengkap').length
    const belumLengkap = summary.students.filter(
      (s) => s.completenessStatus === 'Belum Lengkap'
    ).length
    const kosong = summary.students.filter((s) => s.completenessStatus === 'Kosong').length
    return { total, lengkap, belumLengkap, kosong }
  }, [summary])

  // ── Print Handler ─────────────────────────────────────────────────────────────
  const handlePrint = useCallback(
    async (siswaId: string) => {
      if (!period) return
      setPrintSiswaId(siswaId)
      setPrintReport(null)
      setPrintLoading(true)
      setPrintModalOpen(true)
      try {
        const report = await getSiswaReport(siswaId, selectedKelasId, period)
        setPrintReport(report)
      } catch (err) {
        console.error('Gagal memuat laporan:', err)
      } finally {
        setPrintLoading(false)
      }
    },
    [period, selectedKelasId]
  )

  const handleClosePrint = useCallback(() => {
    setPrintModalOpen(false)
    setPrintSiswaId(null)
    setPrintReport(null)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Hasil Belajar"
        description="Generate dan cetak laporan nilai, presensi, kedisiplinan, dan prestasi siswa per bulan atau semester."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* ── Sidebar Filter ── */}
        <aside>
          <FilterPanel
            unit={unit}
            onUnitChange={handleUnitChange}
            periodMode={periodMode}
            onPeriodModeChange={setPeriodMode}
            selectedMonthKey={selectedMonthKey}
            monthOptions={monthOptions}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            selectedSemesterId={selectedSemesterId}
            onSemesterIdChange={setSelectedSemesterId}
            semesterOptions={semesterOptions}
            kelasList={kelasList}
            selectedKelasId={selectedKelasId}
            onKelasChange={setSelectedKelasId}
            search={search}
            onSearchChange={setSearch}
          />
        </aside>

        {/* ── Main Content ── */}
        <main className="space-y-5">
          {/* Empty State – no kelas or period */}
          {!canFetch ? (
            <Card className="border-[var(--border)] bg-[var(--surface)]">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <GraduationCap className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Pilih Filter untuk Memulai
                </p>
                <p className="text-xs text-[var(--text-secondary)] text-center max-w-xs">
                  Pilih unit, periode, dan kelas pada panel filter di sebelah kiri untuk menampilkan
                  daftar siswa beserta status kelengkapan data.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Stats Bar ── */}
              {summaryLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: 'Total Siswa',
                      value: stats.total,
                      color: 'text-[var(--text-primary)]',
                      bg: 'bg-[var(--surface)]',
                    },
                    {
                      label: 'Lengkap',
                      value: stats.lengkap,
                      color: 'text-emerald-600',
                      bg: 'bg-emerald-500/8',
                    },
                    {
                      label: 'Belum Lengkap',
                      value: stats.belumLengkap,
                      color: 'text-amber-600',
                      bg: 'bg-amber-500/8',
                    },
                    {
                      label: 'Kosong',
                      value: stats.kosong,
                      color: 'text-slate-500',
                      bg: 'bg-slate-500/8',
                    },
                  ].map(({ label, value, color, bg }) => (
                    <Card
                      key={label}
                      className={cn('border-[var(--border)]', bg)}
                    >
                      <CardContent className="flex flex-col items-center justify-center p-4 gap-0.5">
                        <p className={cn('text-2xl font-bold', color)}>{value}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {/* ── Students List ── */}
              <Card className="border-[var(--border)] bg-[var(--surface)]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    Daftar Siswa — {summary?.kelasNama ?? '...'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {summaryLoading ? (
                    <div className="divide-y divide-[var(--border)]">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-6 py-4">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-36" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                          <Skeleton className="h-6 w-24 rounded-full" />
                          <Skeleton className="h-8 w-20 rounded-lg" />
                        </div>
                      ))}
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--text-secondary)]">
                      <Search className="h-6 w-6" />
                      <p className="text-sm">
                        {search
                          ? `Tidak ada siswa dengan nama "${search}"`
                          : 'Tidak ada siswa di kelas ini.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border)]">
                      {filteredStudents.map((siswa, idx) => (
                        <div
                           key={siswa.siswaId}
                           className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-[var(--background)]"
                        >
                          {/* Number */}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--background)] text-xs font-semibold text-[var(--text-secondary)]">
                            {idx + 1}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                              {siswa.nama}
                            </p>
                            {siswa.nomorInduk && (
                              <p className="text-xs text-[var(--text-tertiary)]">
                                NISN: {siswa.nomorInduk}
                              </p>
                            )}
                          </div>

                          {/* Status */}
                          <CompletionBadge status={siswa.completenessStatus} />

                          {/* Action */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePrint(siswa.siswaId)}
                            className="gap-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label={`Lihat laporan ${siswa.nama}`}
                            id={`btn-print-${siswa.siswaId}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Detail
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>

      {/* ── Print Preview Modal ── */}
      <PrintPreviewModal
        isOpen={printModalOpen}
        onClose={handleClosePrint}
        report={printReport}
        isLoading={printLoading}
        period={period ?? { type: 'month', year: now.getFullYear(), month: now.getMonth() + 1 }}
        tahunAjaran={tahunAjaran || undefined}
        semester={currentSemester}
      />
    </div>
  )
}
