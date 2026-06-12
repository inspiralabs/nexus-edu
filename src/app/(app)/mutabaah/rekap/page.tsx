'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Eye, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { DatePicker } from '@/components/shared/date-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import {
  getKamar,
  getKamarByMusyrif,
  getMutabaahRekap,
  getKegiatanWithSub,
  getMutabaahDetailBySiswa,
  STATUS_LEGEND,
  STATUS_DISPLAY_CODE,
  type MutabaahRekapItem,
  type MutabaahStatus,
  type KegiatanItem,
} from '@/lib/queries/mutabaah'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const

// ─── Komponen Status Badge ────────────────────────────────────────────────────

function StatusBadge({ label, count }: { label: string; count: number }) {
  if (count === 0) return null
  const variantMap: Record<string, string> = {
    Hadir: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    Izin: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    Sakit: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    Alpha: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    Terlambat: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    Libur: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantMap[label] ?? 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}`}
    >
      {label}: {count}
    </span>
  )
}

// ─── Komponen Legend Keterangan ───────────────────────────────────────────────

function KeteranganLegend() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        Keterangan Kode Kehadiran
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {STATUS_LEGEND.map(({ kode, label }) => (
          <div key={kode} className="flex items-center gap-1.5">
            <span className="min-w-[28px] rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-center text-xs font-bold font-mono text-[var(--text-primary)]">
              {kode}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tipe Dialog Detail ───────────────────────────────────────────────────────

interface SiswaDetailTarget {
  siswaId: string
  nama: string
  kelas: string
  kamar: string
}

// ─── Komponen Dialog Detail Rekap ────────────────────────────────────────────

function RekapDetailDialog({
  target,
  tanggalDari,
  tanggalSampai,
  kegiatanList,
  onClose,
}: {
  target: SiswaDetailTarget | null
  tanggalDari: string
  tanggalSampai: string
  kegiatanList: KegiatanItem[]
  onClose: () => void
}) {
  const { data: detailData = [], isLoading } = useQuery({
    queryKey: ['mutabaah-detail-siswa', target?.siswaId, tanggalDari, tanggalSampai],
    queryFn: () =>
      target ? getMutabaahDetailBySiswa(target.siswaId, tanggalDari, tanggalSampai) : Promise.resolve([]),
    enabled: !!target,
  })

  // Bangun kolom: kegiatan/sub (horizontal)
  const cols = useMemo(() => {
    const result: { kegiatanId: string; subId: string | null; label: string; namaKegiatan: string }[] = []
    for (const kg of kegiatanList) {
      const subs = kg.sub_kegiatan ?? []
      if (subs.length === 0) {
        result.push({ kegiatanId: kg.id, subId: null, label: kg.nama_kegiatan, namaKegiatan: kg.nama_kegiatan })
      } else {
        for (const sub of subs) {
          result.push({ kegiatanId: kg.id, subId: sub.id, label: sub.nama_sub, namaKegiatan: kg.nama_kegiatan })
        }
      }
    }
    return result
  }, [kegiatanList])

  // Bangun baris: tanggal (vertikal, bisa di-scroll)
  const tanggalList = useMemo(() => {
    const tanggalSet = new Set(detailData.map((d) => d.tanggal))
    return Array.from(tanggalSet).sort()
  }, [detailData])

  // Map data: `tanggal__kegiatanId__subId` → status
  const dataMap = useMemo(() => {
    const m = new Map<string, MutabaahStatus>()
    for (const d of detailData) {
      const k = `${d.tanggal}__${d.kegiatan_id}__${d.sub_kegiatan_id ?? 'null'}`
      m.set(k, d.status)
    }
    return m
  }, [detailData])

  // Total hadir per kolom
  const totalHadirPerCol = useMemo(() => {
    const totals = new Map<string, number>()
    for (const col of cols) {
      let count = 0
      for (const tgl of tanggalList) {
        const k = `${tgl}__${col.kegiatanId}__${col.subId ?? 'null'}`
        const s = dataMap.get(k)
        if (s === 'Hadir') count++
      }
      totals.set(`${col.kegiatanId}__${col.subId ?? 'null'}`, count)
    }
    return totals
  }, [cols, tanggalList, dataMap])

  const renderCell = (status: MutabaahStatus | undefined): string => {
    if (!status) return '-'
    return STATUS_DISPLAY_CODE[status] ?? status
  }

  const cellColor = (status: MutabaahStatus | undefined): string => {
    if (!status || status === '-') return ''
    if (status === 'Hadir') return 'text-emerald-600 font-medium'
    if (status === 'L') return 'text-slate-400'
    if (status === 'Alpha') return 'text-red-600 font-medium'
    if (status === 'Sakit') return 'text-blue-600'
    if (status === 'Izin') return 'text-yellow-600'
    if (status === 'Terlambat' || status === 'Terlambat Sekali') return 'text-orange-600'
    if (status === 'Istihadhah') return 'text-purple-600'
    if (status === 'Haid') return 'text-pink-600'
    return 'text-[var(--text-secondary)]'
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--text-primary)]">
                Detail Rekap Kegiatan
              </DialogTitle>
              {target && (
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
                  <span><strong>Siswa:</strong> {target.nama}</span>
                  <span><strong>Kelas:</strong> {target.kelas}</span>
                  <span><strong>Kamar:</strong> {target.kamar}</span>
                  <span><strong>Periode:</strong> {format(new Date(tanggalDari), 'dd MMM yyyy', { locale: idLocale })} — {format(new Date(tanggalSampai), 'dd MMM yyyy', { locale: idLocale })}</span>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6"><Skeleton className="h-40 w-full" /></div>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-max border-collapse text-xs">
              <thead>
                {/* Baris 1: Nama Kegiatan Header (sticky top-0) */}
                <tr className="bg-[var(--surface-2)]" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                  <th
                    className="min-w-[110px] border-b border-r border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-left font-semibold text-[var(--text-secondary)]"
                    style={{ position: 'sticky', left: 0, zIndex: 30 }}
                  >
                    Tanggal
                  </th>
                  {cols.map((col) => (
                    <th
                      key={`${col.kegiatanId}-${col.subId ?? 'main'}`}
                      className="border-b border-r border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-center font-semibold text-[var(--text-primary)]"
                    >
                      <div className="flex flex-col gap-0.5">
                        {col.subId && (
                          <span className="text-[10px] font-normal text-[var(--text-tertiary)]">{col.namaKegiatan}</span>
                        )}
                        <span>{col.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
                {/* Baris 2: Total Kehadiran (sticky di bawah baris 1) */}
                <tr className="bg-primary/5" style={{ position: 'sticky', top: 36, zIndex: 20 }}>
                  <th
                    className="border-b-2 border-r border-[var(--border)] bg-primary/5 px-2 py-1.5 text-left font-semibold text-primary"
                    style={{ position: 'sticky', left: 0, zIndex: 30 }}
                  >
                    Total Hadir
                  </th>
                  {cols.map((col) => {
                    const total = totalHadirPerCol.get(`${col.kegiatanId}__${col.subId ?? 'null'}`) ?? 0
                    return (
                      <th
                        key={`total-${col.kegiatanId}-${col.subId ?? 'main'}`}
                        className="border-b-2 border-r border-[var(--border)] bg-primary/5 px-2 py-1.5 text-center font-bold text-primary"
                      >
                        {total}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {tanggalList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={cols.length + 1}
                      className="px-4 py-8 text-center text-[var(--text-tertiary)]"
                    >
                      Belum ada data mutabaah untuk periode ini
                    </td>
                  </tr>
                ) : (
                  tanggalList.map((tgl, rowIdx) => (
                    <tr
                      key={tgl}
                      className={`border-b border-[var(--border)] ${rowIdx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]/60'}`}
                    >
                      <td
                        className={`border-r border-[var(--border)] px-2 py-2 font-medium text-[var(--text-secondary)] ${rowIdx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'}`}
                        style={{ position: 'sticky', left: 0, zIndex: 10 }}
                      >
                        {format(new Date(tgl), 'EEE, dd MMM', { locale: idLocale })}
                      </td>
                      {cols.map((col) => {
                        const k = `${tgl}__${col.kegiatanId}__${col.subId ?? 'null'}`
                        const status = dataMap.get(k)
                        return (
                          <td
                            key={`${tgl}-${col.kegiatanId}-${col.subId ?? 'main'}`}
                            className={`border-r border-[var(--border)] px-2 py-2 text-center ${cellColor(status)}`}
                          >
                            {renderCell(status)}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Halaman Rekap Kegiatan ───────────────────────────────────────────────────

export default function RekapKegiatanPage() {
  const { profile, isAdmin } = useAuth()

  const [activeTab, setActiveTab] = useState<'SD' | 'SMP' | 'SMA'>('SD')
  const [selectedKamar, setSelectedKamar] = useState<string>('all')
  const [tanggalDari, setTanggalDari] = useState<Date>(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [tanggalSampai, setTanggalSampai] = useState<Date>(new Date())
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [detailTarget, setDetailTarget] = useState<SiswaDetailTarget | null>(null)

  const tabInitialized = useRef(false)

  // ── Query Kamar ──
  const { data: kamarList = [], isLoading: loadingKamar } = useQuery({
    queryKey: ['kamar-rekap', profile?.id, isAdmin],
    queryFn: () => {
      if (!profile) return []
      if (isAdmin) return getKamar()
      return getKamarByMusyrif(profile.id)
    },
    enabled: !!profile,
  })

  // ── Query Kegiatan ──
  const { data: kegiatanList = [] } = useQuery({
    queryKey: ['kegiatan-with-sub-rekap'],
    queryFn: getKegiatanWithSub,
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
    if (selectedKamar !== 'all') {
      const exists = filteredKamarList.some((k) => k.nama_kamar === selectedKamar)
      if (!exists) setSelectedKamar('all')
    }
  }, [filteredKamarList, selectedKamar])

  // ── Query Rekap ──
  const tanggalDariStr = format(tanggalDari, 'yyyy-MM-dd')
  const tanggalSampaiStr = format(tanggalSampai, 'yyyy-MM-dd')

  const { data: rekapList = [], isLoading: loadingRekap } = useQuery({
    queryKey: ['mutabaah-rekap', selectedKamar, activeTab, tanggalDariStr, tanggalSampaiStr],
    queryFn: () =>
      getMutabaahRekap({
        kamarNama: selectedKamar === 'all' ? undefined : selectedKamar,
        unit: selectedKamar === 'all' ? activeTab : undefined,
        tanggalDari: tanggalDariStr,
        tanggalSampai: tanggalSampaiStr,
      }),
    enabled: !!tanggalDariStr && !!tanggalSampaiStr,
  })

  // ── Group per siswa, ambil kamar dari filter ──
  const siswaGrouped = useMemo(() => {
    const map = new Map<string, { siswaId: string; nama: string; kelas: string; kamar: string; records: MutabaahRekapItem[] }>()
    for (const item of rekapList) {
      if (debouncedSearch && !item.nama.toLowerCase().includes(debouncedSearch.toLowerCase())) continue
      const existing = map.get(item.siswa_id) ?? {
        siswaId: item.siswa_id,
        nama: item.nama,
        kelas: item.kelas,
        kamar: selectedKamar !== 'all' ? selectedKamar : '',
        records: [],
      }
      existing.records.push(item)
      map.set(item.siswa_id, existing)
    }
    return Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama))
  }, [rekapList, debouncedSearch, selectedKamar])

  // ── Kolom kegiatan unik ──
  const kegiatanCols = useMemo(() => {
    const seen = new Map<string, { kegiatanId: string; namaKegiatan: string; subId: string | null; namaSub: string | null }>()
    for (const item of rekapList) {
      const k = `${item.kegiatan_id}__${item.sub_kegiatan_id ?? 'null'}`
      if (!seen.has(k)) {
        seen.set(k, {
          kegiatanId: item.kegiatan_id,
          namaKegiatan: item.nama_kegiatan,
          subId: item.sub_kegiatan_id,
          namaSub: item.nama_sub,
        })
      }
    }
    return Array.from(seen.values())
  }, [rekapList])

  // ── Paginate ──
  const totalRows = siswaGrouped.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const paginatedSiswa = useMemo(() => {
    const from = (page - 1) * pageSize
    return siswaGrouped.slice(from, from + pageSize)
  }, [siswaGrouped, page, pageSize])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Kegiatan Mutabaah"
        description="Ringkasan kehadiran siswa per kegiatan — kegiatan (baris) × siswa (kolom)"
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
          <label className="text-xs font-medium text-[var(--text-secondary)]">Kamar</label>
          <Select value={selectedKamar} onValueChange={(v) => { setSelectedKamar(v); setPage(1) }}>
            <SelectTrigger id="select-kamar-rekap" className="w-48">
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
          <label className="text-xs font-medium text-[var(--text-secondary)]">Dari Tanggal</label>
          <DatePicker value={tanggalDari} onChange={(d) => { if (d) { setTanggalDari(d); setPage(1) } }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Sampai Tanggal</label>
          <DatePicker value={tanggalSampai} onChange={(d) => { if (d) { setTanggalSampai(d); setPage(1) } }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Cari Siswa</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              id="search-siswa-rekap"
              placeholder="Nama siswa..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-48 pl-9"
            />
          </div>
        </div>
      </div>

      {/* ── Info periode ── */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <SlidersHorizontal className="h-4 w-4" />
        <span>
          Periode:{' '}
          <strong>{format(tanggalDari, 'dd MMMM yyyy', { locale: idLocale })}</strong>
          {' — '}
          <strong>{format(tanggalSampai, 'dd MMMM yyyy', { locale: idLocale })}</strong>
        </span>
        {selectedKamar !== 'all' && (
          <Badge variant="secondary" className="ml-2">{selectedKamar}</Badge>
        )}
      </div>

      {/* ── PIVOT TABEL: baris=Kegiatan, kolom=Siswa ── */}
      {loadingRekap ? (
        <Skeleton className="h-64 w-full" />
      ) : paginatedSiswa.length === 0 ? (
        <EmptyState
          title="Tidak ada data"
          description="Belum ada data mutabaah untuk filter yang dipilih"
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
                {paginatedSiswa.map(({ siswaId, nama, kelas, kamar }, colIdx) => (
                  <th
                    key={`${siswaId}-${colIdx}`}
                    className="min-w-[160px] border-r border-[var(--border)] px-2 py-1.5 text-center text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="leading-tight">{nama}</span>
                      <span className="text-[10px] font-normal text-[var(--text-tertiary)]">{kelas}</span>
                      {/* Aksi Lihat Detail */}
                      <button
                        type="button"
                        id={`btn-detail-rekap-${siswaId}`}
                        onClick={() => setDetailTarget({ siswaId, nama, kelas, kamar })}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20"
                        title={`Lihat detail rekap ${nama}`}
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
                    {/* Sel per Siswa */}
                    {paginatedSiswa.map(({ siswaId, records }, colIdx) => {
                      const key = `${col.kegiatanId}__${col.subId ?? 'null'}`
                      const rec = records.find(
                        (r) => `${r.kegiatan_id}__${r.sub_kegiatan_id ?? 'null'}` === key
                      )
                      return (
                        <td
                          key={`${siswaId}-${col.kegiatanId}-${col.subId ?? 'main'}-${colIdx}`}
                          className="border-r border-[var(--border)] px-2 py-2 text-center"
                        >
                          {rec ? (
                            <div className="flex flex-col gap-0.5 items-center">
                              <StatusBadge label="Hadir" count={rec.total_hadir} />
                              <StatusBadge label="Izin" count={rec.total_izin} />
                              <StatusBadge label="Sakit" count={rec.total_sakit} />
                              <StatusBadge label="Alpha" count={rec.total_alpha} />
                              <StatusBadge label="Terlambat" count={rec.total_terlambat} />
                              <StatusBadge label="Libur" count={rec.total_libur} />
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--text-tertiary)]">—</span>
                          )}
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

      {/* ── Legend Keterangan ── */}
      {!loadingRekap && <KeteranganLegend />}

      {/* ── Pagination ── */}
      {!loadingRekap && totalRows > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <span>Tampilkan</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}
            >
              <SelectTrigger id="select-page-size-rekap" className="h-8 w-20">
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
            <span className="text-sm text-[var(--text-secondary)]">
              {page} / {totalPages}
            </span>
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

      {/* ── Dialog Detail Rekap ── */}
      <RekapDetailDialog
        target={detailTarget}
        tanggalDari={tanggalDariStr}
        tanggalSampai={tanggalSampaiStr}
        kegiatanList={kegiatanList}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  )
}
