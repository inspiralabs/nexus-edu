'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { CalendarDays, Moon, TrendingUp, Users, ChevronDown, ChevronRight, Eye } from 'lucide-react'
import { useState, useMemo, useEffect, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import {
  getKamar,
  getKamarByMusyrif,
  getMutabaahDashboardData,
  getMutabaahRankings,
  getKegiatanWithSub,
  getMutabaahProgressWithNames,
  hitungNilai,
  type KegiatanItem,
  type MutabaahRankingSiswa,
  type MutabaahProgressWithName,
  type NilaiMutabaah,
} from '@/lib/queries/mutabaah'
import { getActiveSemester } from '@/lib/queries/semester'

const EMPTY_ARRAY: any[] = []
const EMPTY_PROGRESS: MutabaahProgressWithName[] = []

// ─── Konstanta & Helper Styling Peringkat ─────────────────────────────────────

const NILAI_TEXT: Record<NilaiMutabaah, string> = {
  A: 'text-emerald-600 dark:text-emerald-400',
  B: 'text-primary',
  C: 'text-yellow-600 dark:text-yellow-400',
  D: 'text-orange-500',
  E: 'text-red-600 dark:text-red-400',
}

const NILAI_LABEL: Record<NilaiMutabaah, string> = {
  A: 'Sangat Baik',
  B: 'Baik',
  C: 'Cukup',
  D: 'Kurang',
  E: 'Sangat Kurang',
}

function barColor(persentase: number): string {
  if (persentase >= 100) return 'bg-blue-500'
  if (persentase >= 80) return 'bg-emerald-500'
  if (persentase >= 45) return 'bg-yellow-400'
  return 'bg-red-500'
}

function barLabel(persentase: number): string {
  if (persentase >= 100) return 'Sempurna'
  if (persentase >= 80) return 'Hijau (≥80%)'
  if (persentase >= 45) return 'Kuning (≥45%)'
  return 'Merah (<45%)'
}

function ProgressBar({ persentase }: { persentase: number }) {
  const width = Math.min(100, persentase)
  return (
    <div className="h-3 w-full min-w-[80px] rounded-full bg-[var(--border)] overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', barColor(persentase))}
        style={{ width: `${width}%` }}
        role="progressbar"
        aria-valuenow={persentase}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${persentase}% — ${barLabel(persentase)}`}
      />
    </div>
  )
}

interface SiswaDetail {
  siswa_id: string
  nama: string
  kelas: string
  kamar: string | null
}

function RankingDetailDialog({
  siswa,
  semesterId,
  kegiatanList,
  onClose,
}: {
  siswa: SiswaDetail | null
  semesterId: string
  kegiatanList: KegiatanItem[]
  onClose: () => void
}) {
  const { data: progressList = EMPTY_PROGRESS, isLoading } = useQuery({
    queryKey: ['mutabaah-progress-detail', siswa?.siswa_id, semesterId],
    queryFn: () =>
      siswa ? getMutabaahProgressWithNames(siswa.siswa_id, semesterId) : Promise.resolve(EMPTY_PROGRESS),
    enabled: !!siswa && !!semesterId,
    retry: false,
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const [expandedKegiatan, setExpandedKegiatan] = useState<Record<string, boolean>>({})

  const toggleKegiatan = (id: string) => {
    setExpandedKegiatan((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const getParentProgress = (kegiatan: KegiatanItem) => {
    const subs = kegiatan.sub_kegiatan ?? []
    if (subs.length === 0) {
      return progressList.find(
        (p) => p.kegiatan_id === kegiatan.id && p.sub_kegiatan_id === null
      )
    }

    const subIds = new Set(subs.map(s => s.id))
    const relevant = progressList.filter(
      p => p.kegiatan_id === kegiatan.id && p.sub_kegiatan_id && subIds.has(p.sub_kegiatan_id)
    )

    if (relevant.length === 0) return undefined

    const totalHadir = relevant.reduce((sum, p) => sum + p.total_hadir, 0)
    const target = relevant.reduce((sum, p) => sum + p.target, 0)
    const persentase = target > 0 ? Math.min(100, Math.round((totalHadir / target) * 100)) : 0

    return {
      kegiatan_id: kegiatan.id,
      sub_kegiatan_id: null,
      total_hadir: totalHadir,
      target: target,
      persentase,
      nilai: hitungNilai(persentase),
      nama_kegiatan: kegiatan.nama_kegiatan,
      nama_sub: null
    }
  }

  const getChildProgress = (kegiatanId: string, subId: string) => {
    return progressList.find(
      (p) => p.kegiatan_id === kegiatanId && p.sub_kegiatan_id === subId
    )
  }

  const filteredKegiatanList = useMemo(() => {
    return kegiatanList.filter((k) => k.semester_id === semesterId)
  }, [kegiatanList, semesterId])

  return (
    <Dialog open={!!siswa} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] shadow-lg">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--text-primary)]">
                Detail Capaian Kegiatan Mutabaah
              </DialogTitle>
              {siswa && (
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
                  <span><strong>Siswa:</strong> {siswa.nama}</span>
                  <span><strong>Kelas:</strong> {siswa.kelas}</span>
                  <span><strong>Kamar:</strong> {siswa.kamar ?? '—'}</span>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6"><Skeleton className="h-40 w-full" /></div>
        ) : progressList.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">
            Belum ada data target untuk siswa ini di semester yang dipilih.
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh] p-4">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--surface-2)] border-b border-[var(--border)] text-[var(--text-secondary)] font-semibold">
                  <th className="px-4 py-2.5 text-center w-12">No</th>
                  <th className="px-4 py-2.5 text-left w-72">Nama Kegiatan / Sub</th>
                  <th className="px-4 py-2.5 text-center w-28">Kehadiran</th>
                  <th className="px-4 py-2.5 text-center w-28">Persentase</th>
                  <th className="px-4 py-2.5 text-center w-48">Bar Capaian</th>
                  <th className="px-4 py-2.5 text-center w-28">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {filteredKegiatanList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-tertiary)]">
                      Tidak ada kegiatan yang terkonfigurasi.
                    </td>
                  </tr>
                ) : (
                  filteredKegiatanList.map((kegiatan, idx) => {
                    const parentNo = String(idx + 1)
                    const hasSubs = kegiatan.sub_kegiatan && kegiatan.sub_kegiatan.length > 0
                    const isExpanded = !!expandedKegiatan[kegiatan.id]
                    const parentItem = getParentProgress(kegiatan)

                    const isEven = idx % 2 === 0
                    const parentBg = isEven ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]/60'

                    return (
                      <Fragment key={kegiatan.id}>
                        {/* Parent Row */}
                        <tr className={cn("border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/40", parentBg)}>
                          {/* No */}
                          <td className="px-4 py-3 text-center text-xs font-mono text-[var(--text-secondary)]">{parentNo}</td>

                          {/* Nama Kegiatan */}
                          <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                            <div className={cn("flex items-center gap-1.5", hasSubs && "cursor-pointer select-none")} onClick={() => hasSubs && toggleKegiatan(kegiatan.id)}>
                              {hasSubs && (
                                <span className="text-[var(--text-secondary)]">
                                  {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                </span>
                              )}
                              <span className="text-xs truncate" title={kegiatan.nama_kegiatan}>{kegiatan.nama_kegiatan}</span>
                            </div>
                          </td>

                          {/* Kehadiran */}
                          <td className="px-4 py-3 text-center text-sm font-semibold text-[var(--text-primary)] font-mono">
                            {parentItem ? `${parentItem.total_hadir} / ${parentItem.target}` : '—'}
                          </td>

                          {/* Persentase */}
                          <td className="px-4 py-3 text-center">
                            {parentItem ? <span className={cn('text-sm font-bold', NILAI_TEXT[parentItem.nilai])}>{parentItem.persentase}%</span> : '—'}
                          </td>

                          {/* Bar Capaian */}
                          <td className="px-4 py-3">
                            <div className="flex justify-center w-full">
                              {parentItem ? <ProgressBar persentase={parentItem.persentase} /> : '—'}
                            </div>
                          </td>

                          {/* Nilai */}
                          <td className="px-4 py-3 text-center">
                            {parentItem ? (
                              <div className="flex flex-col items-center">
                                <span className={cn('text-sm font-bold', NILAI_TEXT[parentItem.nilai])}>{parentItem.nilai}</span>
                                <span className="text-[10px] text-[var(--text-secondary)] leading-tight">{NILAI_LABEL[parentItem.nilai]}</span>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>

                        {/* Child Rows if Expanded */}
                        {hasSubs && isExpanded && kegiatan.sub_kegiatan!.map((sub, subIdx) => {
                          const childNo = `${parentNo}.${subIdx + 1}`
                          const childBg = 'bg-[var(--surface-2)]/30'
                          const childItem = getChildProgress(kegiatan.id, sub.id)

                          return (
                            <tr key={`${kegiatan.id}-${sub.id}`} className="border-b border-[var(--border)] bg-[var(--surface-2)]/25 hover:bg-[var(--surface-2)]/40 transition-colors">
                              {/* No */}
                              <td className={cn("px-4 py-2.5 text-center text-xs font-mono text-[var(--text-tertiary)]", childBg)}>{childNo}</td>

                              {/* Nama Sub */}
                              <td className={cn("px-4 py-2.5", childBg)}>
                                <div className="pl-6 flex items-center gap-1.5">
                                  <span className="text-xs text-[var(--text-secondary)] font-medium truncate" title={sub.nama_sub}>↳ {sub.nama_sub}</span>
                                </div>
                              </td>

                              {/* Kehadiran */}
                              <td className={cn("px-4 py-2.5 text-center text-xs font-medium text-[var(--text-secondary)] font-mono", childBg)}>
                                {childItem ? `${childItem.total_hadir} / ${childItem.target}` : '—'}
                              </td>

                              {/* Persentase */}
                              <td className={cn("px-4 py-2.5 text-center", childBg)}>
                                {childItem ? <span className={cn('text-xs font-semibold', NILAI_TEXT[childItem.nilai])}>{childItem.persentase}%</span> : '—'}
                              </td>

                              {/* Bar Capaian */}
                              <td className={cn("px-4 py-2.5", childBg)}>
                                <div className="flex justify-center w-full">
                                  {childItem ? <ProgressBar persentase={childItem.persentase} /> : '—'}
                                </div>
                              </td>

                              {/* Nilai */}
                              <td className={cn("px-4 py-2.5 text-center", childBg)}>
                                {childItem ? (
                                  <div className="flex flex-col items-center">
                                    <span className={cn('text-xs font-semibold', NILAI_TEXT[childItem.nilai])}>{childItem.nilai}</span>
                                    <span className="text-[9px] text-[var(--text-tertiary)] leading-tight">{NILAI_LABEL[childItem.nilai]}</span>
                                  </div>
                                ) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Halaman Dashboard Mutabaah ───────────────────────────────────────────────

export default function DashboardMutabaahPage() {
  const { profile, isAdmin } = useAuth()

  const [rankingUnit, setRankingUnit] = useState<'SD' | 'SMP' | 'SMA'>('SD')
  const [detailSiswa, setDetailSiswa] = useState<SiswaDetail | null>(null)

  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester-mutabaah'],
    queryFn: getActiveSemester,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: rankingsData, isLoading: loadingRankings } = useQuery({
    queryKey: ['mutabaah-rankings', activeSemester?.id, rankingUnit],
    queryFn: () =>
      activeSemester ? getMutabaahRankings(activeSemester.id, rankingUnit) : Promise.resolve({ topRajin: [], topPerluMotivasi: [] }),
    enabled: !!activeSemester,
    retry: false,
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: kegiatanList = EMPTY_ARRAY } = useQuery({
    queryKey: ['kegiatan-list-with-sub', activeSemester?.id],
    queryFn: () => getKegiatanWithSub(),
    enabled: !!activeSemester,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [filterKategori, setFilterKategori] = useState<string>('all')
  const [selectedKamar, setSelectedKamar] = useState<string>('all')
  const [selectedBulan, setSelectedBulan] = useState<string>('')

  // ── Generate pilihan bulan berdasarkan Semester Aktif ──
  const bulanOptions = useMemo(() => {
    if (!activeSemester?.tanggal_mulai || !activeSemester?.tanggal_selesai) {
      // Fallback ke 12 bulan terakhir jika semester aktif belum ter-load
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        return {
          value: format(d, 'yyyy-MM'),
          label: format(d, 'MMMM yyyy', { locale: idLocale }),
        }
      })
    }

    const start = new Date(activeSemester.tanggal_mulai)
    const end = new Date(activeSemester.tanggal_selesai)
    const options = []
    
    let current = new Date(start.getFullYear(), start.getMonth(), 1)
    const targetEnd = new Date(end.getFullYear(), end.getMonth(), 1)

    while (current <= targetEnd) {
      options.push({
        value: format(current, 'yyyy-MM'),
        label: format(current, 'MMMM yyyy', { locale: idLocale }),
      })
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    }
    
    // Urutkan dari bulan terbaru ke terlama (descending)
    return options.reverse()
  }, [activeSemester])

  // ── Default Value Dropdown Bulan berdasarkan Semester Aktif ──
  useEffect(() => {
    if (!activeSemester?.tanggal_mulai || !activeSemester?.tanggal_selesai) return

    const now = new Date()
    const nowStr = format(now, 'yyyy-MM')
    
    const startStr = activeSemester.tanggal_mulai.substring(0, 7) // 'yyyy-MM'
    const endStr = activeSemester.tanggal_selesai.substring(0, 7) // 'yyyy-MM'

    if (nowStr >= startStr && nowStr <= endStr) {
      setSelectedBulan(nowStr)
    } else {
      setSelectedBulan(endStr)
    }
  }, [activeSemester])

  // ── Query Kamar ──
  const { data: kamarList = EMPTY_ARRAY, isLoading: loadingKamar } = useQuery({
    queryKey: ['kamar-dashboard', profile?.id, isAdmin],
    queryFn: async () => {
      if (!profile) return []
      if (isAdmin) return getKamar()
      const musyrifKamar = await getKamarByMusyrif(profile.id)
      if (musyrifKamar.length > 0) return musyrifKamar
      return getKamar()
    },
    enabled: !!profile,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const filteredKamarList = useMemo(() => {
    let result = kamarList
    if (selectedUnit !== 'all') {
      result = result.filter((k) => k.unit === selectedUnit)
    }
    if (filterKategori !== 'all') {
      result = result.filter((k) => k.jenis_kelamin === filterKategori)
    }
    return result
  }, [kamarList, selectedUnit, filterKategori])

  useEffect(() => {
    if (loadingKamar) return
    if (selectedKamar !== 'all') {
      const exists = filteredKamarList.some((k) => k.nama_kamar === selectedKamar)
      if (!exists) setSelectedKamar('all')
    }
  }, [filteredKamarList, selectedKamar, loadingKamar])

  const kamarFilter = selectedKamar === 'all' ? undefined : selectedKamar

  // ── Satu query gabungan untuk semua data dashboard utama ───────────────────
  // Menggantikan 3 query terpisah (stats / kehadiranPerKegiatan / trendHarian)
  // yang masing-masing memanggil resolveSiswaIds() secara duplikat.
  const { data: dashboardData, isLoading: loadingDashboard } = useQuery({
    queryKey: ['mutabaah-dashboard', kamarFilter, selectedBulan, selectedUnit, filterKategori],
    queryFn: () => getMutabaahDashboardData(kamarFilter, selectedBulan, selectedUnit, filterKategori),
    enabled: !!selectedBulan && !!activeSemester,
    retry: false,
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const stats = dashboardData?.stats
  const loadingStats = loadingDashboard
  const loadingBar = loadingDashboard
  const loadingLine = loadingDashboard

  // Format data untuk chart
  const barData = (dashboardData?.kehadiranPerKegiatan ?? []).map((item) => ({
    name: item.nama_kegiatan.length > 16 ? item.nama_kegiatan.slice(0, 16) + '…' : item.nama_kegiatan,
    fullName: item.nama_kegiatan,
    hadir: item.total_hadir,
    persen: item.persentase,
  }))

  const lineData = (dashboardData?.trendHarian ?? []).map((item) => ({
    tgl: format(new Date(item.tanggal), 'd'),
    persen: item.persentase_hadir,
    hadir: item.total_hadir,
    total: item.total_siswa,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Mutabaah"
        description="Ringkasan kehadiran kegiatan kepesantrenan"
      />

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 no-print">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Unit</label>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger id="select-unit-dashboard" className="w-48">
              <SelectValue placeholder="Semua Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Unit</SelectItem>
              <SelectItem value="SD">SD</SelectItem>
              <SelectItem value="SMP">SMP</SelectItem>
              <SelectItem value="SMA">SMA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Kategori</label>
          <Select
            value={filterKategori}
            onValueChange={(v) => {
              setFilterKategori(v)
              setSelectedKamar('all')
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              <SelectItem value="Laki-laki">Ikhwan</SelectItem>
              <SelectItem value="Perempuan">Akhwat</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Kamar</label>
          <Select value={selectedKamar} onValueChange={setSelectedKamar}>
            <SelectTrigger id="select-kamar-dashboard" className="w-48">
              <SelectValue placeholder="Semua Kamar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kamar</SelectItem>
              {filteredKamarList.map((k) => (
                <SelectItem key={k.id} value={k.nama_kamar}>{k.nama_kamar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Bulan</label>
          <Select value={selectedBulan} onValueChange={setSelectedBulan}>
            <SelectTrigger id="select-bulan-dashboard" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bulanOptions.map((b) => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {loadingStats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Siswa Aktif"
            value={stats?.totalSiswaAktif ?? 0}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Rata-rata Kehadiran"
            value={`${stats?.rataRataKehadiran ?? 0}%`}
            icon={TrendingUp}
            variant="secondary"
            description="Bulan ini, kegiatan non-libur"
          />
          <StatCard
            title="Hari Dicatat"
            value={stats?.totalHariDicatat ?? 0}
            icon={CalendarDays}
            description="Hari yang memiliki data mutabaah"
          />
          <StatCard
            title="Hari Libur"
            value={stats?.hariLiburBulanIni ?? 0}
            icon={Moon}
            description="Hari libur dalam bulan ini"
          />
        </div>
      )}

      {/* ── Top 10 Rankings ── */}
      <Card>
        <CardHeader className="pb-3 border-b border-[var(--border)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
                Peringkat Kehadiran Mutabaah (Semester Ini)
              </CardTitle>
              <p className="text-xs text-[var(--text-secondary)]">
                10 Santri dengan persentase kehadiran tertinggi dan terendah
              </p>
            </div>
            <Tabs
              value={rankingUnit}
              onValueChange={(v) => setRankingUnit(v as 'SD' | 'SMP' | 'SMA')}
              className="no-print"
            >
              <TabsList>
                <TabsTrigger value="SD">SD</TabsTrigger>
                <TabsTrigger value="SMP">SMP</TabsTrigger>
                <TabsTrigger value="SMA">SMA</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loadingRankings ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !activeSemester ? (
            <EmptyState
              title="Tidak ada semester aktif"
              description="Semester aktif belum dikonfigurasi oleh Admin."
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Top 10 Rajin */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                  <h4 className="font-semibold text-sm text-[var(--text-primary)]">
                    10 Teratas (Terajin)
                  </h4>
                </div>
                {rankingsData?.topRajin.length === 0 ? (
                  <EmptyState title="Tidak ada data" description="Belum ada data untuk unit ini" />
                ) : (
                  <div className="overflow-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]">
                          <th className="px-3 py-2 text-center font-semibold w-12">Rank</th>
                          <th className="px-3 py-2 text-left font-semibold">Nama</th>
                          <th className="px-3 py-2 text-center font-semibold w-16">Kelas</th>
                          <th className="px-3 py-2 text-center font-semibold w-20">Kamar</th>
                          <th className="px-3 py-2 text-center font-semibold w-16">Capaian</th>
                          <th className="px-3 py-2 text-center font-semibold w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankingsData?.topRajin.map((item, idx) => (
                          <tr key={item.siswa_id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/30 text-[var(--text-primary)]">
                            <td className="px-3 py-2 text-center font-semibold text-emerald-600 dark:text-emerald-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium">{item.nama}</td>
                            <td className="px-3 py-2 text-center text-[var(--text-secondary)]">{item.kelas}</td>
                            <td className="px-3 py-2 text-center text-[var(--text-secondary)]">{item.kamar ?? '—'}</td>
                            <td className="px-3 py-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{item.persentase}%</td>
                            <td className="px-3 py-2 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => setDetailSiswa(item)}
                              >
                                Detail
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Top 10 Perlu Motivasi */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-red-500" />
                  <h4 className="font-semibold text-sm text-[var(--text-primary)]">
                    10 Terbawah (Perlu Motivasi)
                  </h4>
                </div>
                {rankingsData?.topPerluMotivasi.length === 0 ? (
                  <EmptyState title="Tidak ada data" description="Belum ada data untuk unit ini" />
                ) : (
                  <div className="overflow-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)]">
                          <th className="px-3 py-2 text-center font-semibold w-12">Rank</th>
                          <th className="px-3 py-2 text-left font-semibold">Nama</th>
                          <th className="px-3 py-2 text-center font-semibold w-16">Kelas</th>
                          <th className="px-3 py-2 text-center font-semibold w-20">Kamar</th>
                          <th className="px-3 py-2 text-center font-semibold w-16">Capaian</th>
                          <th className="px-3 py-2 text-center font-semibold w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankingsData?.topPerluMotivasi.map((item, idx) => (
                          <tr key={item.siswa_id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/30 text-[var(--text-primary)]">
                            <td className="px-3 py-2 text-center font-semibold text-red-600 dark:text-red-400">{idx + 1}</td>
                            <td className="px-3 py-2 font-medium">{item.nama}</td>
                            <td className="px-3 py-2 text-center text-[var(--text-secondary)]">{item.kelas}</td>
                            <td className="px-3 py-2 text-center text-[var(--text-secondary)]">{item.kamar ?? '—'}</td>
                            <td className="px-3 py-2 text-center font-bold text-red-600 dark:text-red-400">{item.persentase}%</td>
                            <td className="px-3 py-2 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => setDetailSiswa(item)}
                              >
                                Detail
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* BarChart: Kehadiran Per Kegiatan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
              Kehadiran per Kegiatan (Top 5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBar ? (
              <Skeleton className="h-56 w-full" />
            ) : barData.length === 0 ? (
              <EmptyState
                title="Belum ada data"
                description="Tidak ada data kehadiran untuk periode ini"
              />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                    formatter={(value: unknown, name: unknown) => {
                      const labels: Record<string, string> = { hadir: 'Total Hadir', persen: 'Persentase (%)' }
                      const nameStr = String(name)
                      return [value as number, labels[nameStr] ?? nameStr]
                    }}
                    labelFormatter={(label, payload) => {
                      const fullName = payload?.[0]?.payload?.fullName ?? label
                      return fullName
                    }}
                  />
                  <Bar dataKey="hadir" fill="#1e5d7e" radius={[4, 4, 0, 0]} name="hadir" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* LineChart: Tren Kehadiran Harian */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
              Tren Kehadiran Harian (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLine ? (
              <Skeleton className="h-56 w-full" />
            ) : lineData.length === 0 ? (
              <EmptyState
                title="Belum ada data"
                description="Tidak ada data tren kehadiran untuk periode ini"
              />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="tgl"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    label={{ value: 'Tanggal', position: 'insideBottom', offset: -4, fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                    formatter={(value: unknown) => [`${value as number}%`, 'Kehadiran']}
                    labelFormatter={(label) => `Tanggal ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="persen"
                    stroke="#1e5d7e"
                    strokeWidth={2}
                    dot={{ fill: '#1e5d7e', r: 3 }}
                    activeDot={{ r: 5 }}
                    name="persen"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Detail Dialog rankings ── */}
      <RankingDetailDialog
        siswa={detailSiswa}
        semesterId={activeSemester?.id ?? ''}
        kegiatanList={kegiatanList}
        onClose={() => setDetailSiswa(null)}
      />
    </div>
  )
}
