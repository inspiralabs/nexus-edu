'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Printer, Search } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { DatePicker } from '@/components/shared/date-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { Combobox } from '@/components/shared/combobox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import {
  getKamar,
  getKamarByMusyrif,
  getMutabaahCetakSiswa,
  getKegiatanWithSub,
  type MutabaahStatus,
  type KegiatanItem,
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
  const [filterKategori, setFilterKategori] = useState<string>('all')
  const [selectedKamar, setSelectedKamar] = useState<string>('')
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>('')
  const [tanggalDari, setTanggalDari] = useState<Date>(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [tanggalSampai, setTanggalSampai] = useState<Date>(new Date())
  const [searchSiswa, setSearchSiswa] = useState('')

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
    queryFn: async () => {
      if (!profile) return []
      if (isAdmin) return getKamar()
      const musyrifKamar = await getKamarByMusyrif(profile.id)
      if (musyrifKamar.length > 0) return musyrifKamar
      return getKamar()
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

  // Filter Kamar berdasarkan unit tab aktif & kategori
  const filteredKamarList = useMemo(() => {
    let result = kamarList.filter((k) => k.unit === activeTab)
    if (filterKategori !== 'all') {
      result = result.filter((k) => k.jenis_kelamin === filterKategori)
    }
    return result
  }, [kamarList, activeTab, filterKategori])

  // Auto-reset atau filter select kamar berdasarkan unit tab aktif
  useEffect(() => {
    if (selectedKamar !== '') {
      const exists = filteredKamarList.some((k) => k.nama_kamar === selectedKamar)
      if (!exists) {
        setSelectedKamar('')
        setSelectedSiswaId('')
        setSearchSiswa('')
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
    if (!searchSiswa) return siswaKamarList
    return siswaKamarList.filter((s) =>
      s.nama.toLowerCase().includes(searchSiswa.toLowerCase())
    )
  }, [siswaKamarList, searchSiswa])

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
  // Sumbu Horizontal = Tanggal (berdasarkan range filter dari tanggalDari ke tanggalSampai)
  const tanggalList = useMemo<string[]>(() => {
    const list: string[] = []
    const start = new Date(tanggalDariStr)
    const end = new Date(tanggalSampaiStr)
    const current = new Date(start)
    
    while (current <= end) {
      list.push(format(current, 'yyyy-MM-dd'))
      current.setDate(current.getDate() + 1)
    }
    return list
  }, [tanggalDariStr, tanggalSampaiStr])

  // Map lookup: tanggal → (kegiatan__sub → status)
  const cetakMap = useMemo<Map<string, Map<string, MutabaahStatus>>>(() => {
    const m = new Map<string, Map<string, MutabaahStatus>>()
    for (const row of cetakData) {
      const colKey = `${row.kegiatan_id}__${row.sub_kegiatan_id ?? 'null'}`
      const existing = m.get(row.tanggal) ?? new Map<string, MutabaahStatus>()
      existing.set(colKey, row.status)
      m.set(row.tanggal, existing)
    }
    return m
  }, [cetakData])

  // Hitung status kehadiran untuk baris kegiatan utama (parent) pada tanggal tertentu
  const getParentStatusOnDate = (kegiatan: KegiatanItem, date: string): string => {
    const subs = kegiatan.sub_kegiatan ?? []
    if (subs.length === 0) {
      const colKey = `${kegiatan.id}__null`
      const status = cetakMap.get(date)?.get(colKey)
      return status ? STATUS_ABBR[status] : '—'
    }

    let hadirCount = 0
    let statusCount = 0
    const statuses = new Set<MutabaahStatus>()
    
    for (const sub of subs) {
      const colKey = `${kegiatan.id}__${sub.id}`
      const status = cetakMap.get(date)?.get(colKey)
      if (status) {
        statusCount++
        statuses.add(status)
        if (status === 'Hadir') {
          hadirCount++
        }
      }
    }

    if (statusCount === 0) return '—'
    
    // Jika semua sub-kegiatan terisi dengan status non-Hadir yang sama, tampilkan status itu langsung
    if (statusCount === subs.length && statuses.size === 1) {
      const singleStatus = Array.from(statuses)[0]
      if (singleStatus !== 'Hadir') {
        return STATUS_ABBR[singleStatus] ?? '—'
      }
    }
    
    return `${hadirCount}/${subs.length}`
  }

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
            <label className="text-xs font-medium text-[var(--text-secondary)]">Kategori</label>
            <Select
              value={filterKategori}
              onValueChange={(v) => {
                setFilterKategori(v)
                setSelectedKamar('')
                setSelectedSiswaId('')
                setSearchSiswa('')
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
            <Select
              value={selectedKamar}
              onValueChange={(v) => {
                setSelectedKamar(v)
                setSelectedSiswaId('')
                setSearchSiswa('')
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
              <div className="w-56">
                <Combobox
                  options={filteredSiswaList.map((s) => ({
                    value: s.id,
                    label: `${s.nama} (${s.kelas})`,
                  }))}
                  value={selectedSiswaId}
                  onSelect={(val) => {
                    setSelectedSiswaId(val)
                    // Reset pencarian setelah siswa dipilih agar saat popover dibuka lagi, list menampilkan semua siswa
                    setSearchSiswa('')
                  }}
                  onSearch={setSearchSiswa}
                  placeholder="Cari nama santri..."
                  emptyMessage="Nama santri tidak ditemukan."
                  isLoading={loadingSiswa}
                />
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
      <div className="hidden print:block mb-6">
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase text-black">MUTABAAH PESERTA DIDIK SEKOLAH QURAN ASY SYAHID</h1>
          <p className="text-sm font-semibold text-black">
            TAHUN PELAJARAN {activeTahunPelajaran?.nama ?? '——'}
          </p>
        </div>
        <hr className="my-3 border-gray-400" />
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
          {/* Blok Informasi Profil Siswa & Rentang Tanggal Filter */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 print:bg-transparent print:border-0 print:p-0 print:mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm print:grid-cols-4 print:gap-2">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-tertiary)] print:text-gray-500 block">Nama Siswa</span>
                <span className="font-semibold text-[var(--text-primary)] print:text-black block">{selectedSiswa?.nama ?? '——'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-tertiary)] print:text-gray-500 block">Kelas</span>
                <span className="font-semibold text-[var(--text-primary)] print:text-black block">{selectedSiswa?.kelas ?? '——'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-tertiary)] print:text-gray-500 block">Nama Kamar</span>
                <span className="font-semibold text-[var(--text-primary)] print:text-black block">{(selectedSiswa?.kamar ?? selectedKamar) || '——'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-tertiary)] print:text-gray-500 block">Periode Laporan</span>
                <span className="font-semibold text-[var(--text-primary)] print:text-black block">
                  {format(tanggalDari, 'dd MMMM yyyy', { locale: idLocale })} s.d {format(tanggalSampai, 'dd MMMM yyyy', { locale: idLocale })}
                </span>
              </div>
            </div>
          </div>

          {/* Tabel cetak - Transpose layout */}
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] print:overflow-visible print:border-0">
            <table className="w-full border-collapse text-sm print:w-full print:text-[10px] print:leading-tight">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] print:bg-transparent">
                  <th className="w-12 px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-secondary)] print:border print:border-gray-400 print:text-black">
                    No
                  </th>
                  <th className="min-w-[180px] border-r border-[var(--border)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] print:border print:border-gray-400 print:text-black print:w-[150px] print:min-w-[150px]">
                    Kegiatan & Sub-Kegiatan
                  </th>
                  {tanggalList.map((tgl) => {
                    const dateObj = new Date(tgl)
                    const formattedDay = format(dateObj, 'dd/MM')
                    return (
                      <th
                        key={`header-date-${tgl}`}
                        className="border-r border-[var(--border)] px-2 py-2 text-center text-xs font-semibold text-[var(--text-primary)] print:border print:border-gray-400 print:text-black min-w-[35px]"
                      >
                        {formattedDay}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {kegiatanList.map((kegiatan, parentIdx) => {
                  const parentNo = `${parentIdx + 1}`
                  const hasSub = (kegiatan.sub_kegiatan ?? []).length > 0
                  
                  return (
                    <Fragment key={`kegiatan-${kegiatan.id}`}>
                      {/* Baris Kegiatan Utama */}
                      <tr className="border-b border-[var(--border)] font-semibold bg-[var(--surface-2)]/45 print:border-gray-400 print:bg-gray-50">
                        <td className="px-3 py-2 text-xs font-medium text-center text-[var(--text-primary)] print:border print:border-gray-400 print:text-black">
                          {parentNo}
                        </td>
                        <td className="border-r border-[var(--border)] px-3 py-2 text-xs text-[var(--text-primary)] font-bold print:border print:border-gray-400 print:text-black">
                          {kegiatan.nama_kegiatan}
                        </td>
                        {tanggalList.map((tgl) => {
                          const val = getParentStatusOnDate(kegiatan, tgl)
                          return (
                            <td 
                              key={`parent-cell-${kegiatan.id}-${tgl}`} 
                              className="border-r border-[var(--border)] px-2 py-1.5 text-center text-xs font-bold print:border print:border-gray-400 print:text-black"
                            >
                              {val}
                            </td>
                          )
                        })}
                      </tr>

                      {/* Baris Sub-Kegiatan */}
                      {hasSub && kegiatan.sub_kegiatan?.map((sub, subIdx) => {
                        const childNo = `${parentNo}.${subIdx + 1}`
                        return (
                          <tr 
                            key={`sub-row-${kegiatan.id}-${sub.id}`} 
                            className="border-b border-[var(--border)] print:border-gray-400 hover:bg-[var(--surface-2)]/20 print:bg-transparent"
                          >
                            <td className="px-3 py-2 text-xs text-center text-[var(--text-tertiary)] print:border print:border-gray-400 print:text-black">
                              {childNo}
                            </td>
                            <td className="border-r border-[var(--border)] px-3 py-2 pl-6 text-xs text-[var(--text-secondary)] font-normal print:border print:border-gray-400 print:text-black print:pl-4">
                              <span className="text-[var(--text-tertiary)] mr-1">↳</span> {sub.nama_sub}
                            </td>
                            {tanggalList.map((tgl) => {
                              const colKey = `${kegiatan.id}__${sub.id}`
                              const status = cetakMap.get(tgl)?.get(colKey)
                              return (
                                <td 
                                  key={`sub-cell-${kegiatan.id}-${sub.id}-${tgl}`} 
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
                    </Fragment>
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
                <span key={`abbr-${status}`} className="text-xs text-[var(--text-secondary)] print:text-black">
                  <strong>{abbr}</strong> = {status}
                </span>
              ))}
            </div>
          </div>

          {/* Footer cetak */}
          <div className="hidden print:block mt-6 text-xs text-gray-700">
            <p>Dicetak oleh: {profile?.nama_lengkap ?? '——'}</p>
            <p>Tanggal cetak: {format(new Date(), 'dd MMMM yyyy', { locale: idLocale })}</p>
          </div>
        </>
      )}
    </div>
  )
}
