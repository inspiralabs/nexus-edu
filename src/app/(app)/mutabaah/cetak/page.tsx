'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Printer, Search } from 'lucide-react'
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
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import {
  getKamar,
  getKamarByMusyrif,
  getMutabaahCetakSiswa,
  getKegiatanWithSub,
  type MutabaahStatus,
} from '@/lib/queries/mutabaah'
import { getActiveTahunPelajaran } from '@/lib/queries/semester'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const STATUS_BADGE_CLASS: Record<MutabaahStatus, string> = {
  Hadir: 'bg-[var(--status-green-bg)] text-[var(--status-green)] print:bg-transparent print:text-black',
  Izin: 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)] print:bg-transparent print:text-black',
  Sakit: 'bg-blue-100 text-blue-700 print:bg-transparent print:text-black',
  Terlambat: 'bg-orange-100 text-orange-700 print:bg-transparent print:text-black',
  'Terlambat Sekali': 'bg-orange-100 text-orange-700 print:bg-transparent print:text-black',
  Istihadhah: 'bg-purple-100 text-purple-700 print:bg-transparent print:text-black',
  Haid: 'bg-pink-100 text-pink-700 print:bg-transparent print:text-black',
  Alpha: 'bg-[var(--status-red-bg)] text-[var(--status-red)] print:bg-transparent print:text-black',
  L: 'bg-[var(--surface-2)] text-[var(--text-tertiary)] print:bg-transparent print:text-black',
  '-': 'bg-[var(--surface-2)] text-[var(--text-tertiary)] print:bg-transparent print:text-black',
}

const STATUS_ABBR: Record<MutabaahStatus, string> = {
  Hadir: '✅',
  Izin: 'I',
  Sakit: 'S',
  Terlambat: 'T',
  'Terlambat Sekali': 'TS',
  Istihadhah: 'ISH',
  Haid: 'H',
  Alpha: 'A',
  L: 'L',
  '-': '-',
}

// ─── Tipe Lokal ───────────────────────────────────────────────────────────────

interface SimpleSiswa {
  id: string
  nama: string
  kelas: string
  kamar: string | null
}

// ─── Halaman Cetak Laporan Mutabaah ──────────────────────────────────────────

export default function CetakMutabaahPage() {
  const { profile, isAdmin } = useAuth()

  const [activeTab, setActiveTab] = useState<'SD' | 'SMP' | 'SMA'>('SD')
  const [selectedKamar, setSelectedKamar] = useState<string>('')
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>('')
  const [tanggalDari, setTanggalDari] = useState<Date>(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [tanggalSampai, setTanggalSampai] = useState<Date>(new Date())
  const [searchSiswa, setSearchSiswa] = useState('')
  const debouncedSearch = useDebounce(searchSiswa, 300)

  const tanggalDariStr = format(tanggalDari, 'yyyy-MM-dd')
  const tanggalSampaiStr = format(tanggalSampai, 'yyyy-MM-dd')

  // ── Query Tahun Pelajaran Aktif ──
  const { data: activeTahunPelajaran } = useQuery({
    queryKey: ['active-tahun-pelajaran-cetak'],
    queryFn: getActiveTahunPelajaran,
  })

  // ── Query Kamar ──
  const { data: kamarList = [], isLoading: loadingKamar } = useQuery({
    queryKey: ['kamar-cetak', profile?.id, isAdmin],
    queryFn: () => {
      if (!profile) return []
      if (isAdmin) return getKamar()
      return getKamarByMusyrif(profile.id)
    },
    enabled: !!profile,
  })

  // Auto-set activeTab HANYA SEKALI — default SD
  const cetakTabInitialized = useRef(false)
  useEffect(() => {
    if (!cetakTabInitialized.current && kamarList.length > 0) {
      const hasSD = kamarList.some((k) => k.unit === 'SD')
      if (!hasSD) {
        setActiveTab(kamarList[0].unit as 'SD' | 'SMP' | 'SMA')
      }
      cetakTabInitialized.current = true
    }
  }, [kamarList])

  // Filter Kamar berdasarkan unit tab aktif
  const filteredKamarList = useMemo(() => {
    return kamarList.filter((k) => k.unit === activeTab)
  }, [kamarList, activeTab])

  // Auto-reset atau filter select kamar berdasarkan unit tab aktif
  useEffect(() => {
    if (selectedKamar !== '') {
      const exists = filteredKamarList.some((k) => k.nama_kamar === selectedKamar)
      if (!exists) {
        setSelectedKamar('')
        setSelectedSiswaId('')
      }
    }
  }, [filteredKamarList, selectedKamar])

  // ── Query Siswa di kamar ──
  const { data: siswaKamarList = [], isLoading: loadingSiswa } = useQuery({
    queryKey: ['siswa-cetak-kamar', selectedKamar],
    queryFn: async (): Promise<SimpleSiswa[]> => {
      if (!selectedKamar) return []
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data, error } = await supabase
        .from('students')
        .select('id, nama, kelas, kamar')
        .eq('kamar', selectedKamar)
        .eq('is_alumni', false)
        .order('nama', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as SimpleSiswa[]
    },
    enabled: !!selectedKamar,
  })

  const filteredSiswaList = useMemo(() => {
    if (!debouncedSearch) return siswaKamarList
    return siswaKamarList.filter((s) =>
      s.nama.toLowerCase().includes(debouncedSearch.toLowerCase())
    )
  }, [siswaKamarList, debouncedSearch])

  // Siswa terpilih (individual)
  const selectedSiswa = useMemo(
    () => siswaKamarList.find((s) => s.id === selectedSiswaId) ?? null,
    [siswaKamarList, selectedSiswaId]
  )

  // ── Query Kegiatan ──
  const { data: kegiatanList = [], isLoading: loadingKegiatan } = useQuery({
    queryKey: ['kegiatan-with-sub-cetak'],
    queryFn: getKegiatanWithSub,
  })

  // ── Query Data Mutabaah ──
  const { data: cetakData = [], isLoading: loadingCetak } = useQuery({
    queryKey: ['mutabaah-cetak', selectedSiswaId, tanggalDariStr, tanggalSampaiStr],
    queryFn: () =>
      selectedSiswaId
        ? getMutabaahCetakSiswa(selectedSiswaId, tanggalDariStr, tanggalSampaiStr)
        : Promise.resolve([]),
    enabled: !!selectedSiswaId,
  })

  // ── Susun tabel cetak ──
  // Baris = tanggal, kolom = kegiatan/sub
  const tanggalList = useMemo(() => {
    const dates = new Set(cetakData.map((r) => r.tanggal))
    return Array.from(dates).sort()
  }, [cetakData])

  interface CetakCol {
    kegiatanId: string
    namaKegiatan: string
    subId: string | null
    namaSub: string | null
  }

  const cetakCols = useMemo<CetakCol[]>(() => {
    const cols: CetakCol[] = []
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

  // Map lookup: tanggal → (kegiatan__sub → status)
  const cetakMap = useMemo(() => {
    const m = new Map<string, Map<string, MutabaahStatus>>()
    for (const row of cetakData) {
      const colKey = `${row.kegiatan_id}__${row.sub_kegiatan_id ?? 'null'}`
      const existing = m.get(row.tanggal) ?? new Map<string, MutabaahStatus>()
      existing.set(colKey, row.status)
      m.set(row.tanggal, existing)
    }
    return m
  }, [cetakData])

  const handleCetak = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* ── Filter bar (sembunyikan saat print) ── */}
      <div className="no-print">
        <PageHeader
          title="Cetak Laporan Mutabaah"
          description="Cetak rekap mutabaah per siswa dalam rentang tanggal tertentu"
          actions={
            <Button
              id="btn-cetak-mutabaah"
              onClick={handleCetak}
              disabled={!selectedSiswaId || cetakData.length === 0}
            >
              <Printer className="mr-2 h-4 w-4" />
              Cetak
            </Button>
          }
        />

        {/* ── Unit Tabs ── */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as 'SD' | 'SMP' | 'SMA')
            setSelectedKamar('')
            setSelectedSiswaId('')
          }}
          className="w-full no-print mt-4"
        >
          <TabsList className="grid w-full grid-cols-3 max-w-[300px]">
            <TabsTrigger value="SD">SD</TabsTrigger>
            <TabsTrigger value="SMP">SMP</TabsTrigger>
            <TabsTrigger value="SMA">SMA</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filter */}
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Kamar</label>
            <Select
              value={selectedKamar}
              onValueChange={(v) => {
                setSelectedKamar(v)
                setSelectedSiswaId('')
              }}
            >
              <SelectTrigger id="select-kamar-cetak" className="w-48">
                <SelectValue placeholder="Pilih kamar..." />
              </SelectTrigger>
              <SelectContent>
                {filteredKamarList.map((k) => (
                  <SelectItem key={k.id} value={k.nama_kamar}>{k.nama_kamar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedKamar && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Siswa</label>
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                  <Input
                    id="search-siswa-cetak"
                    placeholder="Cari nama siswa..."
                    value={searchSiswa}
                    onChange={(e) => setSearchSiswa(e.target.value)}
                    className="w-56 pl-9"
                  />
                </div>
                <Select
                  value={selectedSiswaId}
                  onValueChange={setSelectedSiswaId}
                >
                  <SelectTrigger id="select-siswa-cetak" className="w-56">
                    <SelectValue placeholder="Pilih siswa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSiswaList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nama} ({s.kelas})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Dari Tanggal</label>
            <DatePicker value={tanggalDari} onChange={(d) => { if (d) setTanggalDari(d) }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Sampai Tanggal</label>
            <DatePicker value={tanggalSampai} onChange={(d) => { if (d) setTanggalSampai(d) }} />
          </div>
        </div>
      </div>

      {/* ── Header Formal (hanya muncul saat cetak) ── */}
      <div className="print-only hidden">
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase">MUTABAAH PESERTA DIDIK SEKOLAH QURAN ASY SYAHID</h1>
          <p className="text-sm font-semibold">
            TAHUN PELAJARAN {activeTahunPelajaran?.nama ?? '——'}
          </p>
          <div className="mt-2 text-sm">
            <p>
              <strong>Nama:</strong> {selectedSiswa?.nama ?? '——'}
              {' '}
              <strong className="ml-4">Kamar:</strong> {(selectedSiswa?.kamar ?? selectedKamar) || '——'}
            </p>
            <p>
              <strong>Kelas:</strong> {selectedSiswa?.kelas ?? '——'}
              {' '}
              <strong className="ml-4">Periode:</strong>{' '}
              {format(tanggalDari, 'dd MMMM yyyy', { locale: idLocale })} —{' '}
              {format(tanggalSampai, 'dd MMMM yyyy', { locale: idLocale })}
            </p>
          </div>
        </div>
        <hr className="my-3" />
      </div>

      {/* ── Konten Preview ── */}
      {!selectedSiswaId && !loadingSiswa && (
        <EmptyState
          title="Pilih siswa"
          description="Pilih kamar dan nama siswa untuk melihat preview laporan"
        />
      )}

      {selectedSiswaId && loadingCetak && <Skeleton className="h-64 w-full" />}

      {selectedSiswaId && !loadingCetak && cetakData.length === 0 && (
        <EmptyState
          title="Tidak ada data"
          description="Tidak ada data mutabaah untuk siswa dan periode yang dipilih"
        />
      )}

      {selectedSiswaId && !loadingCetak && cetakData.length > 0 && (
        <>
          {/* Info siswa (screen only) */}
          <div className="no-print flex flex-wrap items-center gap-3 rounded-lg bg-primary-light px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedSiswa?.nama}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {selectedSiswa?.kelas} · Kamar: {selectedKamar}
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {cetakData.length} entri
            </Badge>
          </div>

          {/* Tabel cetak */}
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] print:overflow-visible print:border-0">
            <table className="min-w-max border-collapse text-sm print:w-full print:text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] print:bg-transparent">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] print:border print:border-gray-400 print:text-black">
                    No
                  </th>
                  <th className="min-w-[120px] border-r border-[var(--border)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] print:border print:border-gray-400 print:text-black">
                    Tanggal
                  </th>
                  {cetakCols.map((col) => (
                    <th
                      key={`${col.kegiatanId}-${col.subId ?? 'main'}`}
                      className="border-r border-[var(--border)] px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-primary)] print:border print:border-gray-400 print:text-black"
                    >
                      {col.namaSub ? (
                        <div>
                          <div className="text-[var(--text-secondary)] print:text-black">{col.namaKegiatan}</div>
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
                {tanggalList.map((tgl, rowIdx) => {
                  const dayData = cetakMap.get(tgl)
                  const formattedTgl = format(new Date(tgl), 'EEE, dd MMM yyyy', { locale: idLocale })
                  return (
                    <tr
                      key={tgl}
                      className={`border-b border-[var(--border)] print:border-gray-400 ${rowIdx % 2 === 0 ? '' : 'bg-[var(--surface-2)]'} print:bg-transparent`}
                    >
                      <td className="px-3 py-2 text-xs text-[var(--text-tertiary)] print:border print:border-gray-400 print:text-black">
                        {rowIdx + 1}
                      </td>
                      <td className="border-r border-[var(--border)] px-3 py-2 text-xs text-[var(--text-primary)] print:border print:border-gray-400 print:text-black">
                        {formattedTgl}
                      </td>
                      {cetakCols.map((col) => {
                        const colKey = `${col.kegiatanId}__${col.subId ?? 'null'}`
                        const status = dayData?.get(colKey)
                        return (
                          <td
                            key={colKey}
                            className="border-r border-[var(--border)] px-2 py-1.5 text-center print:border print:border-gray-400"
                          >
                            {status ? (
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASS[status]}`}
                                title={status}
                              >
                                {STATUS_ABBR[status]}
                              </span>
                            ) : (
                              <span className="text-[var(--text-tertiary)] print:text-gray-400">—</span>
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

          {/* Keterangan Singkatan */}
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 print:border-gray-300">
            <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)] print:text-black">Keterangan:</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(Object.entries(STATUS_ABBR) as [MutabaahStatus, string][]).map(([status, abbr]) => (
                <span key={status} className="text-xs text-[var(--text-secondary)] print:text-black">
                  <strong>{abbr}</strong> = {status}
                </span>
              ))}
            </div>
          </div>

          {/* Footer cetak */}
          <div className="print-only hidden mt-6 text-xs text-gray-500">
            <p>Dicetak oleh: {profile?.nama_lengkap ?? '——'}</p>
            <p>Tanggal cetak: {format(new Date(), 'dd MMMM yyyy', { locale: idLocale })}</p>
          </div>
        </>
      )}
    </div>
  )
}
