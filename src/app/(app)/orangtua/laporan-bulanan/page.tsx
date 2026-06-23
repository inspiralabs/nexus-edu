'use client'

// src/app/(app)/orangtua/laporan-bulanan/page.tsx

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import {
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  Printer,
  Scale,
  Trophy,
  Users,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { PrintContent } from '@/components/report/print-preview-modal'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { getSemesterOptions, getActiveSemesterDiknas } from '@/lib/queries/diknas'
import { getAnakSaya } from '@/lib/queries/orangtua'
import { getLaporanAnak, type ReportPeriod } from '@/lib/queries/report'

type PeriodMode = 'month' | 'semester'

export default function OrangTuaLaporanBulananPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isLoading: authLoading } = useAuth()

  // Guard: Hanya role 'orangtua' yang boleh masuk
  useEffect(() => {
    if (!authLoading && profile && profile.role !== 'orangtua') {
      router.replace('/dashboard')
    }
  }, [profile, authLoading, router])

  // Query daftar anak
  const { data: anakList = [], isLoading: anakLoading } = useQuery({
    queryKey: ['orangtua-anak-list-laporan', profile?.id],
    queryFn: () => getAnakSaya(profile?.id || ''),
    enabled: !!profile?.id && profile.role === 'orangtua',
  })

  // State anak terpilih
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>('')

  useEffect(() => {
    if (anakList.length > 0 && !selectedSiswaId) {
      const urlSiswaId = searchParams.get('siswaId')
      const matched = anakList.find((s) => s.id === urlSiswaId)
      if (matched) {
        setSelectedSiswaId(matched.id)
      } else {
        setSelectedSiswaId(anakList[0].id)
      }
    }
  }, [anakList, selectedSiswaId, searchParams])

  const activeStudent = useMemo(() => {
    return anakList.find((s) => s.id === selectedSiswaId) || anakList[0] || null
  }, [anakList, selectedSiswaId])

  // Handler pergantian anak
  const handleSiswaChange = (id: string) => {
    setSelectedSiswaId(id)
    const params = new URLSearchParams(window.location.search)
    params.set('siswaId', id)
    router.push(`${window.location.pathname}?${params.toString()}`)
  }

  // ── Filter State ─────────────────────────────────────────────────────────────
  const now = new Date()
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedSemesterId, setSelectedSemesterId] = useState('')

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

  const selectedSemesterObj = useMemo(() => {
    return rawSemesters.find((s) => s.id === selectedSemesterId) ?? activeSemester ?? null
  }, [rawSemesters, selectedSemesterId, activeSemester])

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
    if (!selectedSemesterObj?.tanggal_mulai || !selectedSemesterObj?.tanggal_selesai) return []
    const start = new Date(selectedSemesterObj.tanggal_mulai)
    const end = new Date(selectedSemesterObj.tanggal_selesai)
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
  }, [selectedSemesterObj])

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

  const tahunAjaran = useMemo(() => {
    if (periodMode === 'semester') {
      const found = semesterOptions.find((s) => s.id === selectedSemesterId)
      if (found) return found.tahunAjaran
    }
    if (selectedSemesterObj) {
      const tp = selectedSemesterObj.tahun_pelajaran
      return tp
        ? Array.isArray(tp)
          ? ((tp[0] as { nama: string } | undefined)?.nama ?? '')
          : ((tp as unknown as { nama: string }).nama ?? '')
        : ''
    }
    return ''
  }, [semesterOptions, selectedSemesterId, periodMode, selectedSemesterObj])

  // ── Query Laporan Siswa ────────────────────────────────────────────────────────
  const canFetch = Boolean(selectedSiswaId) && period !== null

  const { data: report, isLoading: reportLoading, error: reportError } = useQuery({
    queryKey: ['orangtua-laporan-siswa', selectedSiswaId, period],
    queryFn: () => getLaporanAnak(selectedSiswaId, period!),
    enabled: canFetch,
  })

  // Print function
  const handlePrint = () => {
    window.print()
  }

  // Loading state umum
  if (authLoading || anakLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (anakList.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Laporan Hasil Belajar" />
        <EmptyState
          title="Belum Terhubung dengan Siswa"
          description="Belum ada data anak yang dihubungkan ke akun ini. Silakan hubungi admin sekolah."
          icon={GraduationCap}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* CSS Print Medis Lokal */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
        }
      `}} />

      {/* Screen Header dengan Selector Anak */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <PageHeader
          title="Laporan Hasil Belajar"
          description={`Laporan nilai, presensi, kedisiplinan, dan prestasi dari ${activeStudent?.nama || ''}`}
        />
        
        {anakList.length > 1 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">
              Lihat data:
            </span>
            <Select value={selectedSiswaId} onValueChange={handleSiswaChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Pilih Anak" />
              </SelectTrigger>
              <SelectContent>
                {anakList.map((siswa) => (
                  <SelectItem key={siswa.id} value={siswa.id}>
                    {siswa.nama} ({siswa.kelas?.nama_kelas || '-'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Filter panel */}
      <Card className="no-print bg-[var(--surface)] border-[var(--border)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[var(--text-secondary)]">
            Filter Laporan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
          {/* Mode Periode */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-[var(--text-secondary)]">Mode Periode</Label>
            <Tabs
              value={periodMode}
              onValueChange={(v) => setPeriodMode(v as PeriodMode)}
              className="w-full"
            >
              <TabsList className="h-9 w-full grid grid-cols-2">
                <TabsTrigger value="month" className="text-xs gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Per Bulan
                </TabsTrigger>
                <TabsTrigger value="semester" className="text-xs gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Per Semester
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Dropdown Semester */}
          <div className="space-y-2">
            <Label htmlFor="select-semester" className="text-xs font-semibold text-[var(--text-secondary)]">Semester</Label>
            <Select
              value={selectedSemesterId}
              onValueChange={setSelectedSemesterId}
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

          {/* Dropdown Bulan (Hanya aktif jika Per Bulan) */}
          <div className="space-y-2">
            <Label htmlFor="select-month" className="text-xs font-semibold text-[var(--text-secondary)]">Bulan</Label>
            <Select
              value={selectedMonthKey}
              onValueChange={(v) => {
                const opt = monthOptions.find((m) => m.value === v)
                if (opt) {
                  setSelectedMonth(opt.month)
                  setSelectedYear(opt.year)
                }
              }}
              disabled={periodMode !== 'month' || monthOptions.length === 0}
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
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Print Button (no-print) */}
        {report && !reportLoading && (
          <div className="flex justify-end no-print">
            <Button onClick={handlePrint} size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Cetak Laporan
            </Button>
          </div>
        )}

        {/* Report Paper Preview */}
        <Card className="print-card bg-white border-[var(--border)] overflow-hidden shadow-sm max-w-4xl mx-auto">
          <CardContent className="p-8 print:p-0">
            {reportLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-[var(--text-secondary)]">
                <LoadingSpinner size="lg" />
                <p className="text-sm">Memuat data laporan belajar...</p>
              </div>
            ) : reportError ? (
              <div className="text-center py-16 text-destructive">
                <p className="text-sm font-semibold">Gagal memuat laporan</p>
                <p className="text-xs mt-1 text-[var(--text-secondary)]">{(reportError as Error)?.message ?? 'Terjadi kesalahan sistem.'}</p>
              </div>
            ) : report && period ? (
              <PrintContent
                report={report}
                period={period}
                tahunAjaran={tahunAjaran}
                semester={selectedSemesterObj}
              />
            ) : (
              <div className="text-center py-16 text-[var(--text-secondary)]">
                <p className="text-sm">Silakan tentukan filter laporan di atas.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
