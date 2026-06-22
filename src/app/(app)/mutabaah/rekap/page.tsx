'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Eye, Search, SlidersHorizontal, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
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
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { useSearchParams } from 'next/navigation'
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

  // State expanded
  const [expandedKegiatan, setExpandedKegiatan] = useState<Record<string, boolean>>({})

  const toggleKegiatan = (id: string) => {
    setExpandedKegiatan((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

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

  const getSubStatusOnDate = (tgl: string, kegiatanId: string, subId: string | null) => {
    const k = `${tgl}__${kegiatanId}__${subId ?? 'null'}`
    return dataMap.get(k)
  }

  const getParentStatusOnDate = (tgl: string, kegiatan: KegiatanItem) => {
    const subs = kegiatan.sub_kegiatan ?? []
    if (subs.length === 0) {
      return getSubStatusOnDate(tgl, kegiatan.id, null)
    }
    
    const statusHadir = ['Hadir', 'Terlambat', 'Terlambat Sekali']
    let hadirCount = 0
    let hasRecord = false
    for (const sub of subs) {
      const status = getSubStatusOnDate(tgl, kegiatan.id, sub.id)
      if (status) {
        hasRecord = true
        if (status && statusHadir.includes(status)) hadirCount++
      }
    }
    if (!hasRecord) return undefined
    return { hadirCount, total: subs.length }
  }

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
                <tr className="bg-[var(--surface-2)]" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                  <th
                    className="sticky w-[40px] min-w-[40px] border-b border-r border-[var(--border)] bg-white dark:bg-background z-20 px-2 py-2.5 text-center font-semibold text-[var(--text-secondary)] shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                    style={{ position: 'sticky', left: 0, zIndex: 20 }}
                  >
                    No
                  </th>
                  <th
                    className="sticky w-[208px] min-w-[208px] border-b border-r border-[var(--border)] bg-white dark:bg-background z-20 px-3 py-2.5 text-left font-semibold text-[var(--text-secondary)] shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                    style={{ position: 'sticky', left: 40, zIndex: 20 }}
                  >
                    Nama Kegiatan / Sub
                  </th>
                  <th
                    className="sticky w-[96px] min-w-[96px] border-b border-r border-[var(--border)] bg-white dark:bg-background z-20 px-3 py-2.5 text-center font-semibold text-[var(--text-secondary)] shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                    style={{ position: 'sticky', left: 248, zIndex: 20 }}
                  >
                    Total Hadir
                  </th>
                  {tanggalList.map((tgl) => {
                    const item = detailData.find((d) => d.tanggal === tgl)
                    return (
                      <th
                        key={tgl}
                        className="border-b border-r border-[var(--border)] bg-[var(--surface-2)] px-2 py-2.5 text-center font-semibold text-[var(--text-primary)] min-w-[96px]"
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-medium">{format(new Date(tgl), 'dd MMM', { locale: idLocale })}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            Oleh: {item?.profiles?.nama_lengkap || 'Sistem'}
                          </span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {kegiatanList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={tanggalList.length + 3}
                      className="px-4 py-8 text-center text-[var(--text-tertiary)]"
                    >
                      Tidak ada kegiatan yang terkonfigurasi.
                    </td>
                  </tr>
                ) : (
                  kegiatanList.map((kegiatan, idx) => {
                    const parentNo = String(idx + 1)
                    const hasSubs = kegiatan.sub_kegiatan && kegiatan.sub_kegiatan.length > 0
                    const isExpanded = !!expandedKegiatan[kegiatan.id]
                    const statusHadir = ['Hadir', 'Terlambat', 'Terlambat Sekali']
                    
                    let totalHadir = 0
                    if (!hasSubs) {
                      for (const tgl of tanggalList) {
                        const status = getSubStatusOnDate(tgl, kegiatan.id, null)
                        if (status && statusHadir.includes(status)) {
                          totalHadir++
                        }
                      }
                    } else {
                      for (const sub of kegiatan.sub_kegiatan!) {
                        for (const tgl of tanggalList) {
                          const status = getSubStatusOnDate(tgl, kegiatan.id, sub.id)
                          if (status && statusHadir.includes(status)) {
                            totalHadir++
                          }
                        }
                      }
                    }

                    const isEven = idx % 2 === 0
                    const parentBg = isEven ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]/60'

                    return (
                      <Fragment key={kegiatan.id}>
                        {/* Parent Row */}
                        <tr
                          className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)]/40 transition-colors ${parentBg}`}
                        >
                          <td
                            className="sticky border-r border-[var(--border)] px-2 py-2.5 text-center font-mono text-xs w-[40px] min-w-[40px] text-[var(--text-secondary)] bg-white dark:bg-background z-10 shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                            style={{ position: 'sticky', left: 0, zIndex: 10 }}
                          >
                            {parentNo}
                          </td>
                          <td
                            className="sticky border-r border-[var(--border)] px-3 py-2.5 font-semibold text-[var(--text-primary)] w-[208px] min-w-[208px] bg-white dark:bg-background z-10 shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                            style={{ position: 'sticky', left: 40, zIndex: 10 }}
                          >
                            <div 
                              className={cn(
                                "flex items-center gap-1.5",
                                hasSubs && "cursor-pointer select-none"
                              )}
                              onClick={() => hasSubs && toggleKegiatan(kegiatan.id)}
                            >
                              {hasSubs && (
                                <span className="text-[var(--text-secondary)]">
                                  {isExpanded ? (
                                    <ChevronDown className="h-3 w-3 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 shrink-0" />
                                  )}
                                </span>
                              )}
                              <span className="text-xs truncate" title={kegiatan.nama_kegiatan}>
                                {kegiatan.nama_kegiatan}
                              </span>
                            </div>
                          </td>
                          <td
                            className="sticky border-r border-[var(--border)] px-3 py-2 text-center font-mono font-bold text-primary w-[96px] min-w-[96px] bg-white dark:bg-background z-10 shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                            style={{ position: 'sticky', left: 248, zIndex: 10 }}
                          >
                            {totalHadir}
                          </td>
                          {tanggalList.map((tgl) => {
                            const val = getParentStatusOnDate(tgl, kegiatan)
                            if (val === undefined) {
                              return (
                                <td
                                  key={`${tgl}-${kegiatan.id}-parent`}
                                  className="border-r border-[var(--border)] px-2 py-2 text-center text-[var(--text-tertiary)]"
                                >
                                  —
                                </td>
                              )
                            }
                            if (typeof val === 'string') {
                              return (
                                <td
                                  key={`${tgl}-${kegiatan.id}-parent`}
                                  className={`border-r border-[var(--border)] px-2 py-2 text-center ${cellColor(val)}`}
                                >
                                  {renderCell(val)}
                                </td>
                              )
                            }
                            const isAllHadir = val.hadirCount === val.total
                            return (
                              <td
                                key={`${tgl}-${kegiatan.id}-parent`}
                                className={cn(
                                  "border-r border-[var(--border)] px-2 py-2 text-center font-mono text-xs",
                                  isAllHadir ? "text-emerald-600 font-bold" : "text-[var(--text-secondary)]"
                                )}
                              >
                                {val.hadirCount}/{val.total}
                              </td>
                            )
                          })}
                        </tr>

                        {/* Child Rows if Expanded */}
                        {hasSubs && isExpanded && kegiatan.sub_kegiatan!.map((sub, subIdx) => {
                          const childNo = `${parentNo}.${subIdx + 1}`
                          const childBg = 'bg-[var(--surface-2)]/30'
                          const statusHadir = ['Hadir', 'Terlambat', 'Terlambat Sekali']
                          
                          let subTotalHadir = 0
                          for (const tgl of tanggalList) {
                            const status = getSubStatusOnDate(tgl, kegiatan.id, sub.id)
                            if (status && statusHadir.includes(status)) {
                              subTotalHadir++
                            }
                          }

                          return (
                            <tr
                              key={`${kegiatan.id}-${sub.id}`}
                              className="border-b border-[var(--border)] bg-[var(--surface-2)]/20 hover:bg-[var(--surface-2)]/40 transition-colors"
                            >
                              <td
                                className="sticky border-r border-[var(--border)] px-2 py-2 text-center font-mono text-xs w-[40px] min-w-[40px] text-[var(--text-tertiary)] bg-white dark:bg-background z-10 shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                                style={{ position: 'sticky', left: 0, zIndex: 10 }}
                              >
                                {childNo}
                              </td>
                              <td
                                className="sticky border-r border-[var(--border)] px-3 py-2 w-[208px] min-w-[208px] bg-white dark:bg-background z-10 shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                                style={{ position: 'sticky', left: 40, zIndex: 10 }}
                              >
                                <div className="pl-6 flex items-center gap-1.5">
                                  <span className="text-xs text-[var(--text-secondary)] font-medium truncate" title={sub.nama_sub}>
                                    ↳ {sub.nama_sub}
                                  </span>
                                </div>
                              </td>
                              <td
                                className="sticky border-r border-[var(--border)] px-3 py-2 text-center font-mono font-medium text-[var(--text-secondary)] w-[96px] min-w-[96px] bg-white dark:bg-background z-10 shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                                style={{ position: 'sticky', left: 248, zIndex: 10 }}
                              >
                                {subTotalHadir}
                              </td>
                              {tanggalList.map((tgl) => {
                                const status = getSubStatusOnDate(tgl, kegiatan.id, sub.id)
                                return (
                                  <td
                                    key={`${tgl}-${kegiatan.id}-${sub.id}`}
                                    className={`border-r border-[var(--border)] px-2 py-2 text-center ${cellColor(status)}`}
                                  >
                                    {renderCell(status)}
                                  </td>
                                )
                              })}
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

// ─── Halaman Rekap Kegiatan ───────────────────────────────────────────────────

export default function RekapKegiatanPage() {
  const { profile, isAdmin } = useAuth()
  const searchParams = useSearchParams()
  const queryUnit = searchParams.get('unit')
  const queryKamar = searchParams.get('kamar')

  const [activeTab, setActiveTab] = useState<'SD' | 'SMP' | 'SMA'>(() => {
    if (queryUnit === 'SD' || queryUnit === 'SMP' || queryUnit === 'SMA') {
      return queryUnit
    }
    return 'SD'
  })
  const [filterKategori, setFilterKategori] = useState<string>('all')
  const [selectedKamar, setSelectedKamar] = useState<string>(() => {
    return queryKamar ?? 'all'
  })
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

  // Sync state if query params change
  useEffect(() => {
    if (queryUnit === 'SD' || queryUnit === 'SMP' || queryUnit === 'SMA') {
      setActiveTab(queryUnit)
    }
    if (queryKamar) {
      setSelectedKamar(queryKamar)
    }
  }, [queryUnit, queryKamar])

  // ── Query Kamar ──
  const { data: kamarList = [], isLoading: loadingKamar } = useQuery({
    queryKey: ['kamar-rekap', profile?.id, isAdmin],
    queryFn: async () => {
      if (!profile) return []
      if (isAdmin) return getKamar()
      const musyrifKamar = await getKamarByMusyrif(profile.id)
      if (musyrifKamar.length > 0) return musyrifKamar
      return getKamar()
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
    if (queryUnit) {
      tabInitialized.current = true
      return
    }
    if (!tabInitialized.current && kamarList.length > 0) {
      const hasSD = kamarList.some((k) => k.unit === 'SD')
      if (!hasSD) {
        setActiveTab(kamarList[0].unit as 'SD' | 'SMP' | 'SMA')
      }
      tabInitialized.current = true
    }
  }, [kamarList, queryUnit])

  const filteredKamarList = useMemo(() => {
    let result = kamarList.filter((k) => k.unit === activeTab)
    if (filterKategori !== 'all') {
      result = result.filter((k) => k.jenis_kelamin === filterKategori)
    }
    return result
  }, [kamarList, activeTab, filterKategori])

  useEffect(() => {
    if (!loadingKamar && selectedKamar !== 'all') {
      const exists = filteredKamarList.some((k) => k.nama_kamar === selectedKamar)
      if (!exists) {
        setSelectedKamar('all')
        setPage(1)
      }
    }
  }, [filteredKamarList, selectedKamar, loadingKamar])

  // ── Query Rekap ──
  const tanggalDariStr = format(tanggalDari, 'yyyy-MM-dd')
  const tanggalSampaiStr = format(tanggalSampai, 'yyyy-MM-dd')

  const { data: rekapList = [], isLoading: loadingRekap } = useQuery({
    queryKey: ['mutabaah-rekap', selectedKamar, activeTab, tanggalDariStr, tanggalSampaiStr, filterKategori],
    queryFn: () =>
      getMutabaahRekap({
        kamarNama: selectedKamar === 'all' ? undefined : selectedKamar,
        unit: selectedKamar === 'all' ? activeTab : undefined,
        kategori: filterKategori !== 'all' ? filterKategori : undefined,
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

  // ── State expanded kegiatan di tabel utama ──
  const [expandedKegiatan, setExpandedKegiatan] = useState<Record<string, boolean>>({})

  const toggleKegiatan = (id: string) => {
    setExpandedKegiatan((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Filter kegiatan yang mempunyai record di rekapList untuk rentang tanggal terpilih
  const activeKegiatanList = useMemo(() => {
    const rekapKegiatanIds = new Set(rekapList.map((r) => r.kegiatan_id))
    const rekapSubIds = new Set(rekapList.map((r) => r.sub_kegiatan_id).filter(Boolean))

    return kegiatanList
      .filter((k) => rekapKegiatanIds.has(k.id))
      .map((k) => ({
        ...k,
        sub_kegiatan: (k.sub_kegiatan ?? [])
          .filter((s) => rekapSubIds.has(s.id))
          .sort((a, b) => a.urutan - b.urutan),
      }))
      .sort((a, b) => a.urutan - b.urutan)
  }, [kegiatanList, rekapList])

  const getSiswaParentRecord = (siswaRecords: MutabaahRekapItem[], kegiatan: KegiatanItem, siswaId: string) => {
    const studentRecords = siswaRecords.filter(
      (r) => r.siswa_id === siswaId && r.kegiatan_id === kegiatan.id
    )
    const subs = kegiatan.sub_kegiatan ?? []
    if (subs.length === 0) {
      return studentRecords.find(
        (r) => r.sub_kegiatan_id === null
      )
    }

    const subKeys = new Set(subs.map(s => `${kegiatan.id}__${s.id}`))
    const relevantRecords = studentRecords.filter(
      r => r.sub_kegiatan_id && subKeys.has(`${kegiatan.id}__${r.sub_kegiatan_id}`)
    )

    if (relevantRecords.length === 0) return null

    return {
      siswa_id: siswaId,
      nama: relevantRecords[0].nama,
      kelas: relevantRecords[0].kelas,
      kegiatan_id: kegiatan.id,
      nama_kegiatan: kegiatan.nama_kegiatan,
      sub_kegiatan_id: null,
      nama_sub: null,
      total_hadir: relevantRecords.reduce((sum, r) => sum + r.total_hadir, 0),
      total_izin: relevantRecords.reduce((sum, r) => sum + r.total_izin, 0),
      total_sakit: relevantRecords.reduce((sum, r) => sum + r.total_sakit, 0),
      total_alpha: relevantRecords.reduce((sum, r) => sum + r.total_alpha, 0),
      total_terlambat: relevantRecords.reduce((sum, r) => sum + r.total_terlambat, 0),
      total_libur: relevantRecords.reduce((sum, r) => sum + r.total_libur, 0),
      total_hari: relevantRecords.reduce((sum, r) => sum + r.total_hari, 0),
    }
  }

  // ── Paginate Kegiatan Utama ──
  const totalRows = activeKegiatanList.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  // ── Penanganan Out-Of-Bounds Page ──
  useEffect(() => {
    if (page > totalPages) {
      setPage(1)
    }
  }, [totalPages, page])

  const paginatedKegiatan = useMemo(() => {
    const from = (page - 1) * pageSize
    return activeKegiatanList.slice(from, from + pageSize)
  }, [activeKegiatanList, page, pageSize])

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
          <label className="text-xs font-medium text-[var(--text-secondary)]">Kategori</label>
          <Select
            value={filterKategori}
            onValueChange={(v) => {
              setFilterKategori(v)
              setSelectedKamar('all')
              setPage(1)
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
      ) : siswaGrouped.length === 0 ? (
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
                <th className="sticky left-0 z-20 w-10 border-r border-[var(--border)] bg-white dark:bg-background px-2 py-2.5 text-center text-xs font-semibold text-[var(--text-secondary)] shadow-[inset_-1px_0_0_0_theme(colors.border)]">
                  No
                </th>
                {/* Kolom Nama Kegiatan */}
                <th className="sticky left-10 z-20 min-w-[180px] border-r border-[var(--border)] bg-white dark:bg-background px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] shadow-[inset_-1px_0_0_0_theme(colors.border)]">
                  Nama Kegiatan
                </th>
                {/* Kolom per Siswa */}
                {siswaGrouped.map(({ siswaId, nama, kelas, kamar }, colIdx) => (
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
              {paginatedKegiatan.map((kegiatan, idx) => {
                const parentNo = String((page - 1) * pageSize + idx + 1)
                const hasSubs = kegiatan.sub_kegiatan && kegiatan.sub_kegiatan.length > 0
                const isExpanded = !!expandedKegiatan[kegiatan.id]
                
                const isEven = idx % 2 === 0
                const parentBg = isEven ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]/60'

                return (
                  <Fragment key={kegiatan.id}>
                    {/* Parent Row */}
                    <tr
                      className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)]/40 transition-colors ${parentBg}`}
                    >
                      {/* No */}
                      <td className="sticky left-0 z-10 border-r border-[var(--border)] px-2 py-2 text-center text-xs text-[var(--text-tertiary)] bg-white dark:bg-background shadow-[inset_-1px_0_0_0_theme(colors.border)]">
                        {parentNo}
                      </td>
                      {/* Nama Kegiatan */}
                      <td className="sticky left-10 z-10 border-r border-[var(--border)] px-3 py-2 bg-white dark:bg-background shadow-[inset_-1px_0_0_0_theme(colors.border)]">
                        <div 
                          className={cn(
                            "flex items-center gap-1.5",
                            hasSubs && "cursor-pointer select-none"
                          )}
                          onClick={() => hasSubs && toggleKegiatan(kegiatan.id)}
                        >
                          {hasSubs && (
                            <span className="text-[var(--text-secondary)]">
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0" />
                              )}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-[var(--text-primary)] truncate" title={kegiatan.nama_kegiatan}>
                            {kegiatan.nama_kegiatan}
                          </span>
                        </div>
                      </td>
                      {/* Sel per Siswa */}
                      {siswaGrouped.map(({ siswaId, records }, colIdx) => {
                        const rec = getSiswaParentRecord(records, kegiatan, siswaId)
                        return (
                          <td
                            key={`${siswaId}-${kegiatan.id}-parent-${colIdx}`}
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

                    {/* Child Rows if Expanded */}
                    {hasSubs && isExpanded && kegiatan.sub_kegiatan!.map((sub, subIdx) => {
                      const childNo = `${parentNo}.${subIdx + 1}`
                      const childBg = 'bg-[var(--surface-2)]/30'

                      return (
                        <tr
                          key={`${kegiatan.id}-${sub.id}`}
                          className="border-b border-[var(--border)] bg-[var(--surface-2)]/20 hover:bg-[var(--surface-2)]/40 transition-colors"
                        >
                          {/* No */}
                          <td className="sticky left-0 z-10 border-r border-[var(--border)] px-2 py-2 text-center text-xs text-[var(--text-tertiary)] bg-white dark:bg-background shadow-[inset_-1px_0_0_0_theme(colors.border)]">
                            {childNo}
                          </td>
                          {/* Nama Sub */}
                          <td className="sticky left-10 z-10 border-r border-[var(--border)] px-3 py-2 bg-white dark:bg-background shadow-[inset_-1px_0_0_0_theme(colors.border)]">
                            <div className="pl-6 flex items-center gap-1">
                              <span className="text-xs text-[var(--text-secondary)] font-medium truncate" title={sub.nama_sub}>
                                ↳ {sub.nama_sub}
                              </span>
                            </div>
                          </td>
                          {/* Sel per Siswa */}
                          {siswaGrouped.map(({ siswaId, records }, colIdx) => {
                            const rec = records.find(
                              (r) => r.siswa_id === siswaId && r.kegiatan_id === kegiatan.id && r.sub_kegiatan_id === sub.id
                            )
                            return (
                              <td
                                key={`${siswaId}-${kegiatan.id}-${sub.id}-${colIdx}`}
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
                  </Fragment>
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
            <span>dari {totalRows} kegiatan</span>
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
