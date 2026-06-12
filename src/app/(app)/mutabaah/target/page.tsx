'use client'

import { Eye, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import {
  getKamar,
  getKamarByMusyrif,
  getKegiatanWithSub,
  getSiswaByKamar,
  getMutabaahProgress,
  getMutabaahProgressWithNames,
  getTargetMutabaah,
  type NilaiMutabaah,
  type MutabaahProgressItem,
  type MutabaahProgressWithName,
} from '@/lib/queries/mutabaah'
import { getActiveSemester, getSemester, type Semester } from '@/lib/queries/semester'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const

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

// ─── Tipe lokal ───────────────────────────────────────────────────────────────

interface SiswaRow {
  id: string
  nama: string
  kelas: string
  kamar?: string | null
}

interface SiswaProgress {
  siswa: SiswaRow
  progress: MutabaahProgressItem[]
}

// ─── Warna progress bar berdasarkan persentase (Poin 8) ──────────────────────

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

// ─── Komponen Progress Bar ────────────────────────────────────────────────────

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

// ─── Komponen Progress Cell (tampilan ringkas di tabel utama) ─────────────────

function ProgressCell({ item }: { item: MutabaahProgressItem | undefined }) {
  if (!item) return <span className="text-xs text-[var(--text-tertiary)]">—</span>
  const { persentase, nilai } = item
  return (
    <div className="flex flex-col items-center gap-1 py-0.5">
      <span className={cn('text-sm font-bold', NILAI_TEXT[nilai])}>{nilai}</span>
      <ProgressBar persentase={persentase} />
      <span className="text-[10px] text-[var(--text-tertiary)]">{persentase}%</span>
    </div>
  )
}

// ─── Hitung rata-rata persentase kehadiran per siswa ─────────────────────────

function rataRataPersentase(progress: MutabaahProgressItem[]): number {
  if (progress.length === 0) return 0
  const total = progress.reduce((sum, p) => sum + p.persentase, 0)
  return Math.round(total / progress.length)
}

// ─── Dialog Detail Target & Nilai ─────────────────────────────────────────────

function TargetDetailDialog({
  siswa,
  kamar,
  semesterId,
  onClose,
}: {
  siswa: SiswaRow | null
  kamar: string
  semesterId: string
  onClose: () => void
}) {
  const { data: progressList = [], isLoading } = useQuery({
    queryKey: ['mutabaah-progress-detail', siswa?.id, semesterId],
    queryFn: () =>
      siswa ? getMutabaahProgressWithNames(siswa.id, semesterId) : Promise.resolve([]),
    enabled: !!siswa && !!semesterId,
  })

  return (
    <Dialog open={!!siswa} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--text-primary)]">
                Detail Target &amp; Nilai
              </DialogTitle>
              {siswa && (
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
                  <span><strong>Siswa:</strong> {siswa.nama}</span>
                  <span><strong>Kelas:</strong> {siswa.kelas}</span>
                  <span><strong>Kamar:</strong> {kamar}</span>
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
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-max border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--surface-2)]" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                  <th
                    className="min-w-[120px] border-b border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left font-semibold text-[var(--text-secondary)]"
                    style={{ position: 'sticky', left: 0, zIndex: 30 }}
                  >
                    Metrik
                  </th>
                  {progressList.map((item, idx) => (
                    <th
                      key={`${item.kegiatan_id}-${item.sub_kegiatan_id ?? 'main'}`}
                      className="border-b border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-center font-semibold text-[var(--text-primary)] min-w-[150px]"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-normal text-[var(--text-tertiary)]">#{idx + 1}</span>
                        {item.nama_sub ? (
                          <>
                            <span className="text-[10px] font-normal text-[var(--text-tertiary)] line-clamp-1">{item.nama_kegiatan}</span>
                            <span className="text-xs font-medium line-clamp-1">↳ {item.nama_sub}</span>
                          </>
                        ) : (
                          <span className="text-xs font-semibold line-clamp-1">{item.nama_kegiatan}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Baris 1: Kehadiran */}
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <td
                    className="sticky left-0 z-10 border-r border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium text-[var(--text-secondary)]"
                  >
                    Kehadiran
                  </td>
                  {progressList.map((item) => (
                    <td
                      key={`kehadiran-${item.kegiatan_id}-${item.sub_kegiatan_id ?? 'main'}`}
                      className="border-r border-[var(--border)] px-3 py-2 text-center text-sm font-semibold text-[var(--text-primary)]"
                    >
                      {item.total_hadir}/{item.target}
                    </td>
                  ))}
                </tr>
                {/* Baris 2: Persentase */}
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]/60">
                  <td
                    className="sticky left-0 z-10 border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-medium text-[var(--text-secondary)]"
                  >
                    Persentase
                  </td>
                  {progressList.map((item) => (
                    <td
                      key={`persentase-${item.kegiatan_id}-${item.sub_kegiatan_id ?? 'main'}`}
                      className="border-r border-[var(--border)] px-3 py-2 text-center"
                    >
                      <span className={cn('text-sm font-bold', NILAI_TEXT[item.nilai])}>
                        {item.persentase}%
                      </span>
                    </td>
                  ))}
                </tr>
                {/* Baris 3: Bar Kehadiran */}
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <td
                    className="sticky left-0 z-10 border-r border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium text-[var(--text-secondary)]"
                  >
                    Bar Capaian
                  </td>
                  {progressList.map((item) => (
                    <td
                      key={`bar-${item.kegiatan_id}-${item.sub_kegiatan_id ?? 'main'}`}
                      className="border-r border-[var(--border)] px-3 py-2"
                    >
                      <div className="flex justify-center px-1">
                        <ProgressBar persentase={item.persentase} />
                      </div>
                    </td>
                  ))}
                </tr>
                {/* Baris 4: Nilai */}
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]/60">
                  <td
                    className="sticky left-0 z-10 border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-medium text-[var(--text-secondary)]"
                  >
                    Nilai
                  </td>
                  {progressList.map((item) => (
                    <td
                      key={`nilai-${item.kegiatan_id}-${item.sub_kegiatan_id ?? 'main'}`}
                      className="border-r border-[var(--border)] px-3 py-2 text-center"
                    >
                      <div className="flex flex-col items-center">
                        <span className={cn('text-sm font-bold', NILAI_TEXT[item.nilai])}>
                          {item.nilai}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)] leading-tight">
                          {NILAI_LABEL[item.nilai]}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Halaman Target & Nilai A-E ───────────────────────────────────────────────

export default function TargetMutabaahPage() {
  const { profile, isAdmin } = useAuth()

  const [activeTab, setActiveTab] = useState<'SD' | 'SMP' | 'SMA'>('SD')
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('')
  const [selectedKamar, setSelectedKamar] = useState<string>('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [detailSiswa, setDetailSiswa] = useState<SiswaRow | null>(null)

  const tabInitialized = useRef(false)

  // ── Query Kamar ──
  const { data: kamarList = [], isLoading: loadingKamar } = useQuery({
    queryKey: ['kamar-target', profile?.id, isAdmin],
    queryFn: () => {
      if (!profile) return []
      if (isAdmin) return getKamar()
      return getKamarByMusyrif(profile.id)
    },
    enabled: !!profile,
  })

  // Auto-set activeTab HANYA SEKALI
  useEffect(() => {
    if (!tabInitialized.current && kamarList.length > 0) {
      const hasSD = kamarList.some((k) => k.unit === 'SD')
      if (!hasSD) {
        setActiveTab(kamarList[0].unit as 'SD' | 'SMP' | 'SMA')
      }
      tabInitialized.current = true
    }
  }, [kamarList])

  const filteredKamarList = useMemo(() => {
    return kamarList.filter((k) => k.unit === activeTab)
  }, [kamarList, activeTab])

  useEffect(() => {
    if (filteredKamarList.length > 0) {
      const exists = filteredKamarList.some((k) => k.nama_kamar === selectedKamar)
      if (!exists) setSelectedKamar(filteredKamarList[0].nama_kamar)
    } else {
      setSelectedKamar('')
    }
  }, [filteredKamarList, selectedKamar])

  // ── Query Semester Aktif ──
  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester'],
    queryFn: getActiveSemester,
  })

  // ── Query Semua Semester ──
  const { data: semesterList = [] } = useQuery({
    queryKey: ['all-semesters-for-target'],
    queryFn: async () => {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data, error } = await supabase
        .from('semester')
        .select('*, tahun_pelajaran(*)')
        .order('tanggal_mulai', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as Semester[]
    },
  })

  const effectiveSemesterId = selectedSemesterId || activeSemester?.id || ''

  // ── Query Target dari Database untuk mengecek apakah data kosong ──
  const { data: targetsDb = [] } = useQuery({
    queryKey: ['targets-db', effectiveSemesterId],
    queryFn: () => getTargetMutabaah(undefined, effectiveSemesterId),
    enabled: !!effectiveSemesterId,
  })

  // ── Query Kegiatan ──
  const { data: kegiatanList = [], isLoading: loadingKegiatan } = useQuery({
    queryKey: ['kegiatan-with-sub-target'],
    queryFn: getKegiatanWithSub,
  })

  // ── Query Siswa ──
  const { data: siswaList = [], isLoading: loadingSiswa } = useQuery({
    queryKey: ['siswa-by-kamar-target', selectedKamar],
    queryFn: () => (selectedKamar ? getSiswaByKamar(selectedKamar) : Promise.resolve([])),
    enabled: !!selectedKamar,
  })

  // ── Query Progress per siswa ──
  const siswaProgressQuery = useQuery({
    queryKey: ['mutabaah-progress-all', selectedKamar, effectiveSemesterId],
    queryFn: async (): Promise<SiswaProgress[]> => {
      if (!effectiveSemesterId) return []
      const results: SiswaProgress[] = []
      for (const siswa of siswaList as SiswaRow[]) {
        const progress = await getMutabaahProgress(siswa.id, effectiveSemesterId)
        results.push({ siswa, progress })
      }
      return results
    },
    enabled: !!effectiveSemesterId && siswaList.length > 0,
  })

  // ── Buat kolom kegiatan ──
  const kegiatanCols = useMemo(() => {
    const cols: { kegiatanId: string; namaKegiatan: string; subId: string | null; namaSub: string | null }[] = []
    for (const kg of kegiatanList) {
      const subs = kg.sub_kegiatan ?? []
      if (subs.length === 0) {
        cols.push({ kegiatanId: kg.id, namaKegiatan: kg.nama_kegiatan, subId: null, namaSub: null })
      } else {
        for (const sub of subs) {
          cols.push({ kegiatanId: kg.id, namaKegiatan: kg.nama_kegiatan, subId: sub.id, namaSub: sub.nama_sub })
        }
      }
    }
    return cols
  }, [kegiatanList])

  // ── Filter siswa ──
  const filteredData = useMemo(() => {
    const raw = siswaProgressQuery.data ?? []
    return raw.filter((r) =>
      debouncedSearch ? r.siswa.nama.toLowerCase().includes(debouncedSearch.toLowerCase()) : true
    )
  }, [siswaProgressQuery.data, debouncedSearch])

  const totalRows = filteredData.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return filteredData.slice(from, from + pageSize)
  }, [filteredData, page, pageSize])

  const isLoading = loadingKamar || loadingKegiatan || loadingSiswa || siswaProgressQuery.isLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title="Target & Nilai A-E"
        description="Capaian kehadiran siswa — kegiatan (baris) × siswa (kolom)"
      />

      {/* ── Unit Tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as 'SD' | 'SMP' | 'SMA')
          setPage(1)
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-[300px]">
          <TabsTrigger value="SD">SD</TabsTrigger>
          <TabsTrigger value="SMP">SMP</TabsTrigger>
          <TabsTrigger value="SMA">SMA</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Semester</label>
          <Select
            value={effectiveSemesterId}
            onValueChange={(v) => { setSelectedSemesterId(v); setPage(1) }}
          >
            <SelectTrigger id="select-semester-target" className="w-56">
              <SelectValue placeholder="Pilih semester..." />
            </SelectTrigger>
            <SelectContent>
              {semesterList.map((s) => {
                const tp = s.tahun_pelajaran as { nama: string } | undefined
                const label = `Semester ${s.nomor_semester} — ${tp?.nama ?? ''}`
                return (
                  <SelectItem key={s.id} value={s.id}>
                    {label}
                    {s.is_aktif && ' (Aktif)'}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Kamar</label>
          <Select
            value={selectedKamar}
            onValueChange={(v) => { setSelectedKamar(v); setPage(1) }}
          >
            <SelectTrigger id="select-kamar-target" className="w-48">
              <SelectValue placeholder="Pilih kamar..." />
            </SelectTrigger>
            <SelectContent>
              {filteredKamarList.map((k) => (
                <SelectItem key={k.id} value={k.nama_kamar}>{k.nama_kamar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Cari Siswa</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              id="search-siswa-target"
              placeholder="Nama siswa..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-48 pl-9"
            />
          </div>
        </div>
      </div>

      {effectiveSemesterId && !isLoading && targetsDb.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
          <p className="text-sm font-semibold mb-1">⚠️ Master Data Target Belum Terisi</p>
          <p className="text-xs leading-relaxed">
            Belum ada data target mutabaah yang terkonfigurasi untuk semester ini di database. 
            Sistem saat ini menampilkan <strong>target default (30 hari)</strong> sebagai fallback agar tidak terjadi error.
            Untuk mengisi data target yang valid di database, silakan hubungi Administrator atau jalankan SQL query inisialisasi default target.
          </p>
        </div>
      )}

      {/* ── PIVOT TABEL: baris=Kegiatan, kolom=Siswa ── */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !effectiveSemesterId ? (
        <EmptyState
          title="Pilih semester"
          description="Tidak ada semester aktif. Pilih semester dari filter di atas."
        />
      ) : paginatedData.length === 0 ? (
        <EmptyState
          title="Tidak ada data"
          description="Tidak ada siswa atau data progress untuk filter yang dipilih"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                {/* Kolom No */}
                <th className="sticky left-0 z-20 w-10 border-r border-[var(--border)] bg-[var(--surface-2)] px-2 py-2.5 text-center text-xs font-semibold text-[var(--text-secondary)]">
                  No
                </th>
                {/* Kolom Nama Kegiatan */}
                <th className="sticky left-10 z-20 min-w-[180px] border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)]">
                  Nama Kegiatan
                </th>
                {/* Kolom per Siswa */}
                {paginatedData.map(({ siswa }, colIdx) => (
                  <th
                    key={`${siswa.id}-${colIdx}`}
                    className="min-w-[140px] border-r border-[var(--border)] px-2 py-1.5 text-center text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">{siswa.nama}</span>
                      <span className="text-[10px] font-normal text-[var(--text-tertiary)]">{siswa.kelas}</span>
                      {/* Rata-rata persentase */}
                      <span className="text-[10px] font-semibold text-primary">
                        {rataRataPersentase(
                          (siswaProgressQuery.data?.find((sp) => sp.siswa.id === siswa.id)?.progress) ?? []
                        )}%
                      </span>
                      {/* Tombol Lihat Detail */}
                      <button
                        type="button"
                        id={`btn-detail-target-${siswa.id}`}
                        onClick={() => setDetailSiswa(siswa)}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
                        title={`Lihat detail target ${siswa.nama}`}
                      >
                        <Eye className="h-2.5 w-2.5" />
                        Lihat Detail
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kegiatanCols.map((col, rowIdx) => {
                const isEven = rowIdx % 2 === 0
                return (
                  <tr
                    key={`${col.kegiatanId}-${col.subId ?? 'main'}`}
                    className={`border-b border-[var(--border)] ${isEven ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]/60'}`}
                  >
                    {/* No */}
                    <td className={`sticky left-0 z-10 border-r border-[var(--border)] px-2 py-2 text-center text-xs text-[var(--text-tertiary)] ${isEven ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'}`}>
                      {rowIdx + 1}
                    </td>
                    {/* Nama Kegiatan */}
                    <td className={`sticky left-10 z-10 border-r border-[var(--border)] px-3 py-2 ${isEven ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'}`}>
                      {col.namaSub ? (
                        <div>
                          <p className="text-[10px] text-[var(--text-tertiary)]">{col.namaKegiatan}</p>
                          <p className="text-xs font-medium text-[var(--text-primary)]">↳ {col.namaSub}</p>
                        </div>
                      ) : (
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{col.namaKegiatan}</p>
                      )}
                    </td>
                    {/* Progress per siswa */}
                    {paginatedData.map(({ siswa, progress }, colIdx) => {
                      const progressMap = new Map(
                        progress.map((p) => [`${p.kegiatan_id}__${p.sub_kegiatan_id ?? 'null'}`, p])
                      )
                      const key = `${col.kegiatanId}__${col.subId ?? 'null'}`
                      const item = progressMap.get(key)
                      return (
                        <td
                          key={`${siswa.id}-${key}-${colIdx}`}
                          className="min-w-[140px] border-r border-[var(--border)] px-2 py-1.5"
                        >
                          <ProgressCell item={item} />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {!isLoading && totalRows > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span>Tampilkan</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
            >
              <SelectTrigger id="select-page-size-target" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>dari {totalRows} siswa</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Sebelumnya
            </Button>
            <span className="text-sm text-[var(--text-secondary)]">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}

      {/* ── Dialog Detail Target & Nilai ── */}
      <TargetDetailDialog
        siswa={detailSiswa}
        kamar={selectedKamar}
        semesterId={effectiveSemesterId}
        onClose={() => setDetailSiswa(null)}
      />
    </div>
  )
}
