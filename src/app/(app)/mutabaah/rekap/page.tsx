'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { DatePicker } from '@/components/shared/date-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import {
  getKamar,
  getKamarByMusyrif,
  getMutabaahRekap,
  type MutabaahRekapItem,
} from '@/lib/queries/mutabaah'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30] as const

function StatusBadge({ label, count }: { label: string; count: number }) {
  if (count === 0) return null
  const variantMap: Record<string, string> = {
    Hadir: 'bg-[var(--status-green-bg)] text-[var(--status-green)]',
    Izin: 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)]',
    Sakit: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    Alpha: 'bg-[var(--status-red-bg)] text-[var(--status-red)]',
    Terlambat: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    Libur: 'bg-[var(--surface-2)] text-[var(--text-tertiary)]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantMap[label] ?? 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}`}
    >
      {label}: {count}
    </span>
  )
}

// ─── Halaman Rekap Kegiatan ───────────────────────────────────────────────────

export default function RekapKegiatanPage() {
  const { profile, isAdmin } = useAuth()

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

  // ── Query Rekap ──
  const tanggalDariStr = format(tanggalDari, 'yyyy-MM-dd')
  const tanggalSampaiStr = format(tanggalSampai, 'yyyy-MM-dd')

  const { data: rekapList = [], isLoading: loadingRekap } = useQuery({
    queryKey: ['mutabaah-rekap', selectedKamar, tanggalDariStr, tanggalSampaiStr],
    queryFn: () =>
      getMutabaahRekap({
        kamarNama: selectedKamar === 'all' ? undefined : selectedKamar,
        tanggalDari: tanggalDariStr,
        tanggalSampai: tanggalSampaiStr,
      }),
    enabled: !!tanggalDariStr && !!tanggalSampaiStr,
  })

  // ── Filter + group per siswa ──
  const siswaGrouped = useMemo(() => {
    // Group per siswa: Map<siswaId, { nama, kelas, kegiatan_records }>
    const map = new Map<string, { nama: string; kelas: string; records: MutabaahRekapItem[] }>()
    for (const item of rekapList) {
      if (debouncedSearch && !item.nama.toLowerCase().includes(debouncedSearch.toLowerCase())) {
        continue
      }
      const existing = map.get(item.siswa_id) ?? { nama: item.nama, kelas: item.kelas, records: [] }
      existing.records.push(item)
      map.set(item.siswa_id, existing)
    }
    return Array.from(map.values()).sort((a, b) => a.nama.localeCompare(b.nama))
  }, [rekapList, debouncedSearch])

  // ── Paginate ──
  const totalRows = siswaGrouped.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const paginatedSiswa = useMemo(() => {
    const from = (page - 1) * pageSize
    return siswaGrouped.slice(from, from + pageSize)
  }, [siswaGrouped, page, pageSize])

  // Kolom kegiatan unik dari rekapList
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Kegiatan Mutabaah"
        description="Ringkasan kehadiran siswa per kegiatan dalam rentang tanggal tertentu"
      />

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
              {kamarList.map((k) => (
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

      {/* ── Tabel ── */}
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
                <th className="sticky left-0 z-10 bg-[var(--surface-2)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)]">
                  No
                </th>
                <th className="sticky left-8 z-10 min-w-[160px] border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)]">
                  Nama Siswa
                </th>
                {kegiatanCols.map((col) => (
                  <th
                    key={`${col.kegiatanId}-${col.subId ?? 'main'}`}
                    className="border-r border-[var(--border)] px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-primary)]"
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
              {paginatedSiswa.map(({ nama, kelas, records }, rowIdx) => {
                const recordMap = new Map(
                  records.map((r) => [`${r.kegiatan_id}__${r.sub_kegiatan_id ?? 'null'}`, r])
                )
                return (
                  <tr
                    key={`${nama}-${rowIdx}`}
                    className={`border-b border-[var(--border)] ${rowIdx % 2 === 0 ? '' : 'bg-[var(--surface-2)]'}`}
                  >
                    <td className="sticky left-0 bg-inherit px-3 py-2 text-xs text-[var(--text-tertiary)]">
                      {(page - 1) * pageSize + rowIdx + 1}
                    </td>
                    <td className="sticky left-8 border-r border-[var(--border)] bg-inherit px-3 py-2">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{nama}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{kelas}</p>
                      </div>
                    </td>
                    {kegiatanCols.map((col) => {
                      const key = `${col.kegiatanId}__${col.subId ?? 'null'}`
                      const rec = recordMap.get(key)
                      return (
                        <td
                          key={key}
                          className="border-r border-[var(--border)] px-3 py-2 text-center"
                        >
                          {rec ? (
                            <div className="flex flex-col gap-1 items-center">
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
    </div>
  )
}
