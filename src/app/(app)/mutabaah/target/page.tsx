'use client'

import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import {
  getKamar,
  getKamarByMusyrif,
  getKegiatanWithSub,
  getSiswaByKamar,
  getMutabaahProgress,
  type KegiatanItem,
  type NilaiMutabaah,
  type MutabaahProgressItem,
} from '@/lib/queries/mutabaah'
import { getSemester, getActiveSemester, type Semester } from '@/lib/queries/semester'
import { cn } from '@/lib/utils'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const

const NILAI_COLOR: Record<NilaiMutabaah, string> = {
  A: 'bg-[var(--status-green)]',
  B: 'bg-primary',
  C: 'bg-[var(--status-yellow)]',
  D: 'bg-orange-500',
  E: 'bg-[var(--status-red)]',
}

const NILAI_TEXT: Record<NilaiMutabaah, string> = {
  A: 'text-[var(--status-green)]',
  B: 'text-primary',
  C: 'text-[var(--status-yellow)]',
  D: 'text-orange-500',
  E: 'text-[var(--status-red)]',
}

const NILAI_LABEL: Record<NilaiMutabaah, string> = {
  A: 'Sangat Baik',
  B: 'Baik',
  C: 'Cukup',
  D: 'Kurang',
  E: 'Sangat Kurang',
}

// ─── Tipe Lokal ───────────────────────────────────────────────────────────────

interface SiswaRow {
  id: string
  nama: string
  kelas: string
}

interface SiswaProgress {
  siswa: SiswaRow
  progress: MutabaahProgressItem[]
}

// ─── Komponen Progress Cell ───────────────────────────────────────────────────

function ProgressCell({ item }: { item: MutabaahProgressItem | undefined }) {
  if (!item) {
    return <span className="text-xs text-[var(--text-tertiary)]">—</span>
  }

  const { total_hadir, target, persentase, nilai } = item
  const barWidth = Math.min(100, persentase)

  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--text-primary)]">
          {total_hadir}/{target}
        </span>
        <span className={cn('text-xs font-bold', NILAI_TEXT[nilai])}>
          {nilai}
        </span>
      </div>
      {/* Progress Bar */}
      <div className="h-1.5 w-full rounded-full bg-[var(--border)]">
        <div
          className={cn('h-full rounded-full transition-all', NILAI_COLOR[nilai])}
          style={{ width: `${barWidth}%` }}
          aria-valuenow={persentase}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
          aria-label={`${persentase}% - ${NILAI_LABEL[nilai]}`}
        />
      </div>
      <span className="text-[10px] text-[var(--text-tertiary)]">
        {persentase}% · {NILAI_LABEL[nilai]}
      </span>
    </div>
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

  // Auto-set activeTab berdasarkan kamar pertama yang dimiliki
  useEffect(() => {
    if (kamarList.length > 0) {
      const firstKamarUnit = kamarList[0].unit as 'SD' | 'SMP' | 'SMA'
      if (firstKamarUnit) {
        setActiveTab(firstKamarUnit)
      }
    }
  }, [kamarList])

  // Filter Kamar berdasarkan unit tab aktif
  const filteredKamarList = useMemo(() => {
    return kamarList.filter((k) => k.unit === activeTab)
  }, [kamarList, activeTab])

  // Auto-pilih kamar pertama dari list terfilter
  useEffect(() => {
    if (filteredKamarList.length > 0) {
      const exists = filteredKamarList.some((k) => k.nama_kamar === selectedKamar)
      if (!exists) {
        setSelectedKamar(filteredKamarList[0].nama_kamar)
      }
    } else {
      setSelectedKamar('')
    }
  }, [filteredKamarList, selectedKamar])

  // ── Query Semester Aktif (default) ──
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

  // Gunakan semester aktif sebagai default
  const effectiveSemesterId = selectedSemesterId || activeSemester?.id || ''

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

  // ── Query Progress Per Siswa ──
  const siswaWithProgress = useQuery({
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

  // ── Filter + Paginate ──
  const filteredData = useMemo(() => {
    const raw = siswaWithProgress.data ?? []
    return raw.filter((r) =>
      debouncedSearch ? r.siswa.nama.toLowerCase().includes(debouncedSearch.toLowerCase()) : true
    )
  }, [siswaWithProgress.data, debouncedSearch])

  const totalRows = filteredData.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const paginatedData = useMemo(() => {
    const from = (page - 1) * pageSize
    return filteredData.slice(from, from + pageSize)
  }, [filteredData, page, pageSize])

  // ── Buat kolom dari kegiatanList ──
  interface TargetCol {
    kegiatanId: string
    namaKegiatan: string
    subId: string | null
    namaSub: string | null
  }

  const targetCols = useMemo<TargetCol[]>(() => {
    const cols: TargetCol[] = []
    for (const kegiatan of kegiatanList) {
      const subs = kegiatan.sub_kegiatan ?? []
      if (subs.length === 0) {
        cols.push({ kegiatanId: kegiatan.id, namaKegiatan: kegiatan.nama_kegiatan, subId: null, namaSub: null })
      } else {
        for (const sub of subs) {
          cols.push({ kegiatanId: kegiatan.id, namaKegiatan: kegiatan.nama_kegiatan, subId: sub.id, namaSub: sub.nama_sub })
        }
      }
    }
    return cols
  }, [kegiatanList])

  const isLoading = loadingKamar || loadingKegiatan || loadingSiswa || siswaWithProgress.isLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title="Target & Nilai A-E"
        description="Capaian kehadiran siswa terhadap target mutabaah per semester"
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

      {/* ── Legenda Nilai ── */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(NILAI_LABEL) as [NilaiMutabaah, string][]).map(([nilai, label]) => (
          <div key={nilai} className="flex items-center gap-1.5">
            <div className={cn('h-3 w-3 rounded-full', NILAI_COLOR[nilai])} />
            <span className="text-xs text-[var(--text-secondary)]">
              <strong className={NILAI_TEXT[nilai]}>{nilai}</strong> — {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Tabel ── */}
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
                <th className="sticky left-0 z-20 bg-[var(--surface-2)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)]">No</th>
                <th className="sticky left-8 z-20 min-w-[160px] border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)]">
                  Nama Siswa
                </th>
                <th className="border-r border-[var(--border)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)]">
                  Kelas
                </th>
                {targetCols.map((col) => (
                  <th
                    key={`${col.kegiatanId}-${col.subId ?? 'main'}`}
                    className="min-w-[140px] border-r border-[var(--border)] px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-primary)]"
                  >
                    {col.namaSub ? (
                      <div>
                        <div className="text-[var(--text-secondary)]">{col.namaKegiatan}</div>
                        <div className="font-normal">{col.namaSub}</div>
                      </div>
                    ) : (
                      col.namaKegiatan
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(({ siswa, progress }, rowIdx) => {
                const progressMap = new Map(
                  progress.map((p) => [`${p.kegiatan_id}__${p.sub_kegiatan_id ?? 'null'}`, p])
                )
                return (
                  <tr
                    key={siswa.id}
                    className={`border-b border-[var(--border)] ${rowIdx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'}`}
                  >
                    <td className={`sticky left-0 z-10 px-3 py-2 text-xs text-[var(--text-tertiary)] ${
                      rowIdx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'
                    }`}>
                      {(page - 1) * pageSize + rowIdx + 1}
                    </td>
                    <td className={`sticky left-8 z-10 border-r border-[var(--border)] px-3 py-2 font-medium text-[var(--text-primary)] ${
                      rowIdx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'
                    }`}>
                      {siswa.nama}
                    </td>
                    <td className="border-r border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      {siswa.kelas}
                    </td>
                    {targetCols.map((col) => {
                      const key = `${col.kegiatanId}__${col.subId ?? 'null'}`
                      const progressItem = progressMap.get(key)
                      return (
                        <td
                          key={key}
                          className="min-w-[140px] border-r border-[var(--border)] px-3 py-1"
                        >
                          <ProgressCell item={progressItem} />
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
    </div>
  )
}
