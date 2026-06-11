'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { AlertTriangle, CheckCheck, Save, Squircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { DatePicker } from '@/components/shared/date-picker'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useAuth } from '@/hooks/use-auth'
import { logAudit } from '@/lib/audit/log'
import {
  getKamar,
  getKamarByMusyrif,
  getKegiatanWithSub,
  getSiswaByKamar,
  getHariLiburInfo,
  getMutabaahByTanggalKamar,
  upsertMutabaah,
  setAllLiburOnDate,
  type KegiatanItem,
  type MutabaahStatus,
} from '@/lib/queries/mutabaah'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: MutabaahStatus[] = [
  'Hadir',
  'Izin',
  'Sakit',
  'Terlambat',
  'Terlambat Sekali',
  'Istihadhah',
  'Haid',
  'Alpha',
  'L',
]

const STATUS_CELL_CLASS: Record<MutabaahStatus, string> = {
  Hadir: 'bg-[var(--status-green-bg)] text-[var(--status-green)]',
  Izin: 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)]',
  Sakit: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300',
  Terlambat: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300',
  'Terlambat Sekali': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-400',
  Istihadhah: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300',
  Haid: 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-300',
  Alpha: 'bg-[var(--status-red-bg)] text-[var(--status-red)]',
  L: 'bg-[var(--surface-2)] text-[var(--text-tertiary)]',
}

// ─── Tipe lokal ───────────────────────────────────────────────────────────────

interface SiswaRow {
  id: string
  nama: string
  kelas: string
}

// Key = `${siswa_id}__${kegiatan_id}__${sub_kegiatan_id ?? 'null'}`
type MutabaahMap = Map<string, MutabaahStatus>

function buildKey(siswaId: string, kegiatanId: string, subId: string | null): string {
  return `${siswaId}__${kegiatanId}__${subId ?? 'null'}`
}

// ─── Halaman Input Harian ─────────────────────────────────────────────────────

export default function InputHarianPage() {
  const { profile, isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedKamar, setSelectedKamar] = useState<string>('')
  const [mutabaahData, setMutabaahData] = useState<MutabaahMap>(new Map())
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'SD' | 'SMP' | 'SMA'>('SD')
  const [isLiburDialogOpen, setIsLiburDialogOpen] = useState(false)

  const tanggalStr = format(selectedDate, 'yyyy-MM-dd')

  // ── Query Kamar ──
  const { data: rawKamarList, isLoading: loadingKamar } = useQuery({
    queryKey: ['kamar-input', profile?.id, isAdmin],
    queryFn: () => {
      if (!profile) return []
      if (isAdmin) return getKamar()
      return getKamarByMusyrif(profile.id)
    },
    enabled: !!profile,
  })
  // Menstabilkan referensi kamarList agar tidak memicu re-render / useEffect berlebih saat loading
  const kamarList = useMemo(() => rawKamarList ?? [], [rawKamarList])

  // Auto-set activeTab berdasarkan kamar pertama yang dimiliki
  useEffect(() => {
    if (kamarList.length > 0) {
      const firstKamarUnit = kamarList[0].unit as 'SD' | 'SMP' | 'SMA'
      if (firstKamarUnit) {
        setActiveTab(firstKamarUnit)
      }
    }
  }, [kamarList])

  // Filter Kamar berdasarkan tab unit
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

  // ── Query Hari Libur ──
  const { data: hariLiburInfo = { isLibur: false, keterangan: null } } = useQuery({
    queryKey: ['hari-libur-info', tanggalStr],
    queryFn: () => getHariLiburInfo(tanggalStr),
  })

  // ── Query Kegiatan ──
  const { data: rawKegiatanList, isLoading: loadingKegiatan } = useQuery({
    queryKey: ['kegiatan-with-sub'],
    queryFn: getKegiatanWithSub,
  })
  // Menstabilkan referensi kegiatanList agar memiliki referensi konstan selama data belum termuat/berubah
  const kegiatanList = useMemo(() => rawKegiatanList ?? [], [rawKegiatanList])

  // ── Query Siswa ──
  const { data: rawSiswaList, isLoading: loadingSiswa } = useQuery({
    queryKey: ['siswa-by-kamar', selectedKamar],
    queryFn: () => (selectedKamar ? getSiswaByKamar(selectedKamar) : Promise.resolve([])),
    enabled: !!selectedKamar,
  })
  // Menstabilkan referensi siswaList
  const siswaList = useMemo(() => rawSiswaList ?? [], [rawSiswaList])

  // ── Query Data Mutabaah yang sudah ada ──
  const { data: rawExistingData, isLoading: loadingMutabaah } = useQuery({
    queryKey: ['mutabaah-harian', tanggalStr, selectedKamar],
    queryFn: () =>
      tanggalStr && selectedKamar
        ? getMutabaahByTanggalKamar(tanggalStr, selectedKamar)
        : Promise.resolve([]),
    enabled: !!tanggalStr && !!selectedKamar,
  })
  // Menstabilkan referensi existingData agar tidak memicu loop rendering di dalam useEffect
  const existingData = useMemo(() => rawExistingData ?? [], [rawExistingData])

  // Bangun mutabaahData dari existing + default Hadir/L
  useEffect(() => {
    const newMap: MutabaahMap = new Map()
    const defaultStatus: MutabaahStatus = hariLiburInfo.isLibur ? 'L' : 'Hadir'

    for (const siswa of siswaList as SiswaRow[]) {
      for (const kegiatan of kegiatanList) {
        const subs = kegiatan.sub_kegiatan ?? []
        if (subs.length > 0) {
          for (const sub of subs) {
            const key = buildKey(siswa.id, kegiatan.id, sub.id)
            newMap.set(key, defaultStatus)
          }
        } else {
          const key = buildKey(siswa.id, kegiatan.id, null)
          newMap.set(key, defaultStatus)
        }
      }
    }

    // Gabungkan dengan data existing yang didapatkan dari database
    for (const entry of existingData) {
      const key = buildKey(entry.siswa_id, entry.kegiatan_id, entry.sub_kegiatan_id)
      newMap.set(key, entry.status)
    }

    setMutabaahData(newMap)
  }, [existingData, siswaList, kegiatanList, hariLiburInfo.isLibur])

  // ── Update status satu cell ──
  const setStatus = useCallback(
    (siswaId: string, kegiatanId: string, subId: string | null, status: MutabaahStatus) => {
      setMutabaahData((prev) => {
        const next = new Map(prev)
        next.set(buildKey(siswaId, kegiatanId, subId), status)
        return next
      })
    },
    []
  )

  // ── Hadir Semua per kegiatan ──
  const hadirSemua = useCallback(
    (kegiatanId: string, subId: string | null) => {
      setMutabaahData((prev) => {
        const next = new Map(prev)
        for (const siswa of siswaList as SiswaRow[]) {
          next.set(buildKey(siswa.id, kegiatanId, subId), 'Hadir')
        }
        return next
      })
    },
    [siswaList]
  )

  // ── Tandai Semua Libur ──
  const tandaiSemuaLibur = useCallback(() => {
    setMutabaahData((prev) => {
      const next = new Map(prev)
      next.forEach((_, key) => {
        next.set(key, 'L')
      })
      return next
    })
  }, [])

  // ── Flatten columns dari kegiatanList ──
  interface ColHeader {
    kegiatanId: string
    namaKegiatan: string
    subId: string | null
    namaSub: string | null
    colSpan: number
    isFirst: boolean
  }

  const columns = useMemo<ColHeader[]>(() => {
    const cols: ColHeader[] = []
    for (const kegiatan of kegiatanList) {
      const subs = kegiatan.sub_kegiatan ?? []
      if (subs.length === 0) {
        cols.push({
          kegiatanId: kegiatan.id,
          namaKegiatan: kegiatan.nama_kegiatan,
          subId: null,
          namaSub: null,
          colSpan: 1,
          isFirst: true,
        })
      } else {
        subs.forEach((sub, i) => {
          cols.push({
            kegiatanId: kegiatan.id,
            namaKegiatan: kegiatan.nama_kegiatan,
            subId: sub.id,
            namaSub: sub.nama_sub,
            colSpan: subs.length,
            isFirst: i === 0,
          })
        })
      }
    }
    return cols
  }, [kegiatanList])

  // ── Libur Massal Mutation ──
  const setLiburMassalMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !selectedKamar) return
      const siswaIds = siswaList.map((s) => s.id)
      const kegiatanIds = kegiatanList.map((k) => k.id)
      await setAllLiburOnDate(tanggalStr, siswaIds, kegiatanIds, profile.id)

      await logAudit(profile.id, 'CREATE', 'mutabaah', tanggalStr, null, {
        tanggal: tanggalStr,
        kamar: selectedKamar,
        action: 'set_libur_massal',
        total_students: siswaIds.length,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutabaah-harian', tanggalStr, selectedKamar] })
      toast({
        title: 'Berhasil',
        description: `Seluruh kegiatan di kamar "${selectedKamar}" pada tanggal ${format(selectedDate, 'dd MMMM yyyy', { locale: idLocale })} berhasil diset Libur (L)`,
      })
    },
    onError: (err) => {
      toast({
        title: 'Gagal',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    },
  })

  // ── Simpan ──
  const handleSimpan = async () => {
    if (!profile || !selectedKamar) return
    setIsSaving(true)

    try {
      const entries: Parameters<typeof upsertMutabaah>[0] = []

      mutabaahData.forEach((status, key) => {
        const [siswaId, kegiatanId, rawSubId] = key.split('__')
        const subKegiatanId = rawSubId === 'null' ? null : rawSubId
        entries.push({
          siswa_id: siswaId,
          kegiatan_id: kegiatanId,
          sub_kegiatan_id: subKegiatanId,
          tanggal: tanggalStr,
          status,
          is_libur: status === 'L',
          dicatat_oleh: profile.id,
        })
      })

      await upsertMutabaah(entries)

      await logAudit(profile.id, 'CREATE', 'mutabaah', tanggalStr, null, {
        tanggal: tanggalStr,
        kamar: selectedKamar,
        total_entries: entries.length,
      })

      queryClient.invalidateQueries({ queryKey: ['mutabaah-harian', tanggalStr, selectedKamar] })

      toast({
        title: 'Berhasil',
        description: `Checklist mutabaah ${format(selectedDate, 'dd MMMM yyyy', { locale: idLocale })} berhasil disimpan`,
      })
    } catch (err) {
      toast({
        title: 'Gagal menyimpan',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const isLoading = loadingKamar || loadingKegiatan || loadingSiswa || loadingMutabaah

  // ── Skeleton Loading ──
  if (loadingKamar || loadingKegiatan) {
    return (
      <div className="space-y-6">
        <PageHeader title="Input Harian Mutabaah" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Input Harian Mutabaah"
        description="Catat kehadiran kegiatan pesantren per siswa per tanggal"
        actions={
          <div className="flex items-center gap-2">
            <Button
              id="btn-libur-massal"
              variant="outline"
              onClick={() => setIsLiburDialogOpen(true)}
              disabled={!selectedKamar || siswaList.length === 0 || setLiburMassalMutation.isPending}
              className="shrink-0 text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/50"
            >
              Set Libur Massal
            </Button>
            <Button
              id="btn-simpan-checklist"
              onClick={handleSimpan}
              isLoading={isSaving}
              disabled={isSaving || !selectedKamar || siswaList.length === 0}
              className="shrink-0"
            >
              <Save className="mr-2 h-4 w-4" />
              Simpan Checklist
            </Button>
          </div>
        }
      />

      {/* ── Unit Tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'SD' | 'SMP' | 'SMA')}
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
          <label className="text-xs font-medium text-[var(--text-secondary)]">Tanggal</label>
          <DatePicker
            value={selectedDate}
            onChange={(d) => {
              if (d) setSelectedDate(d)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Kamar</label>
          <Select value={selectedKamar} onValueChange={setSelectedKamar}>
            <SelectTrigger id="select-kamar-input" className="w-48">
              <SelectValue placeholder="Pilih kamar..." />
            </SelectTrigger>
            <SelectContent>
              {filteredKamarList.map((k) => (
                <SelectItem key={k.id} value={k.nama_kamar}>
                  {k.nama_kamar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Banner Libur ── */}
      {hariLiburInfo.isLibur && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">
              Hari Libur
              {hariLiburInfo.keterangan ? `: ${hariLiburInfo.keterangan}` : ''}
              {' — Semua kegiatan akan otomatis tercatat L'}
            </span>
          </div>
          <Button
            id="btn-tandai-semua-libur"
            variant="outline"
            size="sm"
            onClick={tandaiSemuaLibur}
            className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
          >
            Tandai Semua Libur
          </Button>
        </div>
      )}

      {/* ── Empty State ── */}
      {!selectedKamar && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] py-16 text-center">
          <Squircle className="mb-3 h-10 w-10 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">Pilih kamar terlebih dahulu</p>
        </div>
      )}

      {selectedKamar && loadingSiswa && (
        <Skeleton className="h-48 w-full" />
      )}

      {selectedKamar && !loadingSiswa && siswaList.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] py-16 text-center">
          <Squircle className="mb-3 h-10 w-10 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Tidak ada siswa aktif di kamar <strong>{selectedKamar}</strong>
          </p>
        </div>
      )}

      {selectedKamar && siswaList.length > 0 && kegiatanList.length === 0 && !loadingKegiatan && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] py-16 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Belum ada kegiatan. Tambahkan kegiatan di menu{' '}
            <a href="/mutabaah/kegiatan" className="text-primary underline">
              Kegiatan Mutabaah
            </a>
            .
          </p>
        </div>
      )}

      {/* ── Grid Checklist ── */}
      {selectedKamar && siswaList.length > 0 && kegiatanList.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {isLoading && (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          {!isLoading && (
            <table className="min-w-max border-collapse text-sm">
              <thead>
                {/* Baris 1: Nama kegiatan (group header untuk yang punya sub) */}
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  {/* Kolom sticky: nama siswa */}
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 min-w-[160px] border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    Nama Siswa
                  </th>
                  {/* Kegiatan unik sebagai group header */}
                  {kegiatanList.map((kegiatan) => {
                    const subs = kegiatan.sub_kegiatan ?? []
                    const colSpan = subs.length > 0 ? subs.length : 1
                    return (
                      <th
                        key={kegiatan.id}
                        colSpan={colSpan}
                        className="border-r border-[var(--border)] px-2 py-2 text-center text-xs font-semibold text-[var(--text-primary)]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span>{kegiatan.nama_kegiatan}</span>
                          {subs.length === 0 && (
                            <button
                              type="button"
                              onClick={() => hadirSemua(kegiatan.id, null)}
                              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-normal text-primary hover:bg-primary-light"
                              title="Hadir Semua"
                            >
                              <CheckCheck className="h-3 w-3" />
                              Hadir Semua
                            </button>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
                {/* Baris 2: Sub kegiatan header */}
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  {columns.map((col, i) => {
                    if (!col.namaSub) return null
                    return (
                      <th
                        key={`sub-${col.kegiatanId}-${col.subId ?? i}`}
                        className="border-r border-[var(--border)] px-2 py-1 text-center text-[10px] font-medium text-[var(--text-secondary)]"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{col.namaSub}</span>
                          <button
                            type="button"
                            onClick={() => hadirSemua(col.kegiatanId, col.subId)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-primary hover:bg-primary-light"
                            title="Hadir Semua"
                          >
                            <CheckCheck className="h-2.5 w-2.5" />
                            Semua
                          </button>
                        </div>
                      </th>
                    )
                  })}
                  {/* Placeholder untuk kolom kegiatan tanpa sub */}
                  {columns
                    .filter((c) => !c.namaSub)
                    .map((_, i) => (
                      <th key={`nosub-${i}`} />
                    ))}
                </tr>
              </thead>
              <tbody>
                {(siswaList as SiswaRow[]).map((siswa, rowIdx) => (
                  <tr
                    key={siswa.id}
                    className={rowIdx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'}
                  >
                    {/* Nama siswa sticky */}
                    <td className={`sticky left-0 z-10 border-b border-r border-[var(--border)] px-3 py-2 ${
                      rowIdx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'
                    }`}>
                      <div className="min-w-[140px]">
                        <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                          {siswa.nama}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">{siswa.kelas}</p>
                      </div>
                    </td>
                    {/* Sel kegiatan/sub */}
                    {columns.map((col, ci) => {
                      const key = buildKey(siswa.id, col.kegiatanId, col.subId)
                      const currentStatus = mutabaahData.get(key) ?? 'Hadir'
                      return (
                        <td
                           key={`${siswa.id}-${col.kegiatanId}-${col.subId ?? ci}`}
                          className={`border-b border-r border-[var(--border)] p-1 ${STATUS_CELL_CLASS[currentStatus]}`}
                        >
                          <Select
                            value={currentStatus}
                            onValueChange={(val) =>
                              setStatus(siswa.id, col.kegiatanId, col.subId, val as MutabaahStatus)
                            }
                          >
                            <SelectTrigger
                              id={`sel-${siswa.id}-${col.kegiatanId}-${col.subId ?? 'main'}`}
                              className="h-7 min-w-[100px] border-none bg-transparent text-xs font-medium focus:ring-0"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Dialog Konfirmasi Libur Massal ── */}
      <ConfirmDialog
        open={isLiburDialogOpen}
        onOpenChange={setIsLiburDialogOpen}
        title="Set Libur Massal"
        description={`Apakah Anda yakin ingin menandai semua kegiatan untuk seluruh siswa di kamar "${selectedKamar}" pada tanggal ${format(selectedDate, 'dd MMMM yyyy', { locale: idLocale })} sebagai Libur (L)? Tindakan ini akan menimpa data yang belum disimpan.`}
        onConfirm={async () => {
          await setLiburMassalMutation.mutateAsync()
          setIsLiburDialogOpen(false)
        }}
        isLoading={setLiburMassalMutation.isPending}
      />
    </div>
  )
}
