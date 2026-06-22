'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { AlertTriangle, CheckCheck, Save, Squircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { DatePicker } from '@/components/shared/date-picker'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
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
  ALL_STATUS_OPTIONS,
  STATUS_DISPLAY_CODE,
  type KegiatanItem,
  type MutabaahStatus,
} from '@/lib/queries/mutabaah'
import { getMissingMutabaahDates } from '@/lib/queries/kepesantrenan'
import { getActiveSemester } from '@/lib/queries/semester'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

// ─── Konstanta Tampilan ───────────────────────────────────────────────────────

const STATUS_LABEL: Record<MutabaahStatus, string> = {
  Hadir: '✅ Hadir',
  '-': '- Tidak Ada Program',
  L: 'L  Libur',
  Sakit: 'S  Sakit',
  Izin: 'I  Izin',
  Alpha: 'A  Alpha',
  Terlambat: 'T  Terlambat',
  'Terlambat Sekali': 'TS Terlambat Sekali',
  Istihadhah: 'ISH Istihadhah',
  Haid: 'H  Haid',
}

const STATUS_CELL_CLASS: Record<MutabaahStatus, string> = {
  Hadir: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  '-': 'bg-[var(--surface-2)] text-[var(--text-tertiary)]',
  L: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  Sakit: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300',
  Izin: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-300',
  Alpha: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',
  Terlambat: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300',
  'Terlambat Sekali': 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-400',
  Istihadhah: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300',
  Haid: 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-300',
}

// ─── Tipe lokal ───────────────────────────────────────────────────────────────

interface SiswaRow {
  id: string
  nama: string
  kelas: string
  kamar?: string | null
}

// Key = `${siswa_id}__${kegiatan_id}__${sub_kegiatan_id ?? 'null'}`
type MutabaahMap = Map<string, MutabaahStatus>

function buildKey(siswaId: string, kegiatanId: string, subId: string | null): string {
  return `${siswaId}__${kegiatanId}__${subId ?? 'null'}`
}

// ─── Baris tabel: kegiatan atau sub kegiatan ──────────────────────────────────

interface RowDef {
  kegiatanId: string
  namaKegiatan: string
  subId: string | null
  namaSub: string | null
  isGroupHeader: boolean
  isSub: boolean
}

// ─── Halaman Input Harian ─────────────────────────────────────────────────────

export default function InputHarianPage() {
  const { profile, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [filterKategori, setFilterKategori] = useState<string>('all')
  const [selectedKamar, setSelectedKamar] = useState<string>('')
  const [mutabaahData, setMutabaahData] = useState<MutabaahMap>(new Map())
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<'SD' | 'SMP' | 'SMA'>('SD')
  const [isLiburDialogOpen, setIsLiburDialogOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  const [missingDates, setMissingDates] = useState<Date[]>([])
  const [isMissingDatesDialogOpen, setIsMissingDatesDialogOpen] = useState(false)
  const [isSuccessTimer, setIsSuccessTimer] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Reset success feedback and timestamp when date or room changes
  useEffect(() => {
    setLastSaved(null)
    setIsSuccessTimer(false)
  }, [selectedDate, selectedKamar])

  // Flag agar tab default SD tidak dioverride oleh useEffect kamar
  const tabInitialized = useRef(false)

  const tanggalStr = format(selectedDate, 'yyyy-MM-dd')

  // ── Query Semester Aktif ──
  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester'],
    queryFn: getActiveSemester,
  })

  const semesterId = activeSemester?.id
  const musyrifId = profile?.id
  const tanggalMulai = activeSemester?.tanggal_mulai
  const tanggalSelesai = activeSemester?.tanggal_selesai

  // ── Query Tanggal Mutabaah Belum Diisi ──
  const { data: fetchedMissingDates } = useQuery({
    queryKey: ['missing-mutabaah-dates', semesterId, musyrifId, tanggalMulai, tanggalSelesai],
    queryFn: async () => {
      if (!semesterId || !musyrifId || !tanggalMulai || !tanggalSelesai) return []
      
      const startStr = typeof tanggalMulai === 'string'
        ? tanggalMulai.split('T')[0]
        : format(new Date(tanggalMulai), 'yyyy-MM-dd')
        
      const endStr = typeof tanggalSelesai === 'string'
        ? tanggalSelesai.split('T')[0]
        : format(new Date(tanggalSelesai), 'yyyy-MM-dd')

      return getMissingMutabaahDates(semesterId, musyrifId, startStr, endStr)
    },
    enabled: !!semesterId && !!musyrifId && !!tanggalMulai && !!tanggalSelesai,
  })

  useEffect(() => {
    if (fetchedMissingDates) {
      setMissingDates(fetchedMissingDates)
    } else {
      setMissingDates([])
    }
  }, [fetchedMissingDates])

  // ── Query Kamar ──
  const { data: rawKamarList, isLoading: loadingKamar } = useQuery({
    queryKey: ['kamar-input', profile?.id, isAdmin],
    queryFn: async () => {
      if (!profile) return []
      if (isAdmin) return getKamar()
      const musyrifKamar = await getKamarByMusyrif(profile.id)
      if (musyrifKamar.length > 0) return musyrifKamar
      return getKamar()
    },
    enabled: !!profile,
  })
  const kamarList = useMemo(() => rawKamarList ?? [], [rawKamarList])

  // Auto-set activeTab HANYA SEKALI: jika tidak ada kamar SD, fallback ke unit pertama
  useEffect(() => {
    if (!tabInitialized.current && kamarList.length > 0) {
      const hasSD = kamarList.some((k) => k.unit === 'SD')
      if (!hasSD) {
        setActiveTab(kamarList[0].unit as 'SD' | 'SMP' | 'SMA')
      }
      tabInitialized.current = true
    }
  }, [kamarList])

  // Filter Kamar berdasarkan tab unit & kategori
  const filteredKamarList = useMemo(() => {
    let result = kamarList.filter((k) => k.unit === activeTab)
    if (filterKategori !== 'all') {
      result = result.filter((k) => k.jenis_kelamin === filterKategori)
    }
    return result
  }, [kamarList, activeTab, filterKategori])

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
  const kegiatanList = useMemo(() => rawKegiatanList ?? [], [rawKegiatanList])

  // ── Query Siswa ──
  const { data: rawSiswaList, isLoading: loadingSiswa } = useQuery({
    queryKey: ['siswa-by-kamar', selectedKamar],
    queryFn: () => (selectedKamar ? getSiswaByKamar(selectedKamar) : Promise.resolve([])),
    enabled: !!selectedKamar,
  })
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
  const existingData = useMemo(() => rawExistingData ?? [], [rawExistingData])

  // Bangun mutabaahData dari existing + default '-' (atau 'L' jika libur)
  useEffect(() => {
    const newMap: MutabaahMap = new Map()
    const defaultStatus: MutabaahStatus = hariLiburInfo.isLibur ? 'L' : '-'

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

    // Gabungkan dengan data existing dari database
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

  // ── Hadir Semua per SISWA (klik di bawah nama siswa) ──
  const hadirSemuaSiswa = useCallback(
    (siswaId: string) => {
      setMutabaahData((prev) => {
        const next = new Map(prev)
        for (const kegiatan of kegiatanList) {
          const subs = kegiatan.sub_kegiatan ?? []
          if (subs.length > 0) {
            for (const sub of subs) {
              next.set(buildKey(siswaId, kegiatan.id, sub.id), 'Hadir')
            }
          } else {
            next.set(buildKey(siswaId, kegiatan.id, null), 'Hadir')
          }
        }
        return next
      })
    },
    [kegiatanList]
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

  // ── Bangun definisi baris (kegiatan/sub kegiatan) ──
  const rows = useMemo<RowDef[]>(() => {
    const result: RowDef[] = []
    for (const kegiatan of kegiatanList) {
      const subs = kegiatan.sub_kegiatan ?? []
      if (subs.length === 0) {
        result.push({
          kegiatanId: kegiatan.id,
          namaKegiatan: kegiatan.nama_kegiatan,
          subId: null,
          namaSub: null,
          isGroupHeader: false,
          isSub: false,
        })
      } else {
        // Baris header grup (tidak memiliki cell input)
        result.push({
          kegiatanId: kegiatan.id,
          namaKegiatan: kegiatan.nama_kegiatan,
          subId: null,
          namaSub: null,
          isGroupHeader: true,
          isSub: false,
        })
        // Baris sub kegiatan
        for (const sub of subs) {
          result.push({
            kegiatanId: kegiatan.id,
            namaKegiatan: kegiatan.nama_kegiatan,
            subId: sub.id,
            namaSub: sub.nama_sub,
            isGroupHeader: false,
            isSub: true,
          })
        }
      }
    }
    return result
  }, [kegiatanList])

  // ── Date Missing Check ──
  const isDateMissing = useMemo(() => {
    return missingDates.some(
      (missingDate) =>
        missingDate.getFullYear() === selectedDate.getFullYear() &&
        missingDate.getMonth() === selectedDate.getMonth() &&
        missingDate.getDate() === selectedDate.getDate()
    )
  }, [missingDates, selectedDate])

  // ── Delete Presensi Mutation ──
  const deletePresensiMutation = useMutation({
    mutationFn: async () => {
      if (!musyrifId) return
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { error } = await supabase
        .from('mutabaah')
        .delete()
        .eq('tanggal', tanggalStr)
        .eq('dicatat_oleh', musyrifId)

      if (error) throw new Error(error.message)

      await logAudit(musyrifId, 'DELETE', 'mutabaah', tanggalStr, null, {
        tanggal: tanggalStr,
        action: 'delete_presensi_harian',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutabaah-harian', tanggalStr, selectedKamar] })
      queryClient.invalidateQueries({ queryKey: ['missing-mutabaah-dates'] })
      // Reset local map
      setMutabaahData((prev) => {
        const next = new Map(prev)
        const defaultStatus = hariLiburInfo.isLibur ? 'L' : '-'
        next.forEach((_, key) => {
          next.set(key, defaultStatus)
        })
        return next
      })
      setLastSaved(null)
      setIsDeleteConfirmOpen(false)
      toast({
        title: 'Berhasil menghapus',
        description: `Presensi tanggal ${format(selectedDate, 'dd MMMM yyyy', { locale: idLocale })} berhasil dihapus`,
      })
    },
    onError: (err) => {
      toast({
        title: 'Gagal menghapus',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    },
  })

  const handleHapusPresensi = () => {
    setIsDeleteConfirmOpen(true)
  }

  // ── Simpan ──
  const handleSimpan = async () => {
    if (!profile || !selectedKamar || !musyrifId) return
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
          dicatat_oleh: musyrifId,
        })
      })

      // Filter out 'Tidak Ada Program' ('-') status entries to avoid check constraint violation in DB
      const payloadSiapSimpan = entries.filter(
        (item) => item.status && item.status !== '-' && !item.status.includes('Tidak Ada Program')
      )

      if (payloadSiapSimpan.length === 0) {
        toast({
          title: 'Disimpan',
          description: 'Tidak ada kegiatan yang perlu dicatat',
        })
        setIsSaving(false)
        return
      }

      // 1. Fetch existing data for these students on this date
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: existingRecords, error: fetchError } = await supabase
        .from('mutabaah')
        .select('id, siswa_id, kegiatan_id, sub_kegiatan_id')
        .eq('tanggal', tanggalStr)
        .in('siswa_id', siswaList.map((s) => s.id))

      if (fetchError) throw new Error(fetchError.message)

      // 2. Inject ID into payload entries that match existing records to trigger updates
      const finalPayload = payloadSiapSimpan.map((item) => {
        const match = existingRecords?.find(
          (ex) =>
            ex.siswa_id === item.siswa_id &&
            ex.kegiatan_id === item.kegiatan_id &&
            (ex.sub_kegiatan_id === item.sub_kegiatan_id ||
              (!ex.sub_kegiatan_id && !item.sub_kegiatan_id))
        )
        return match ? { ...item, id: match.id } : item
      })

      // 3. Upsert
      await upsertMutabaah(finalPayload)

      await logAudit(musyrifId, 'CREATE', 'mutabaah', tanggalStr, null, {
        tanggal: tanggalStr,
        kamar: selectedKamar,
        total_entries: payloadSiapSimpan.length,
      })

      queryClient.invalidateQueries({ queryKey: ['mutabaah-harian', tanggalStr, selectedKamar] })
      queryClient.invalidateQueries({ queryKey: ['missing-mutabaah-dates'] })

      setLastSaved(new Date())
      setIsSuccessTimer(true)
      setShowSuccessDialog(true)
      setTimeout(() => {
        setIsSuccessTimer(false)
      }, 2000)
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
        description="Catat kehadiran kegiatan pesantren per tanggal — kegiatan (baris) × siswa (kolom)"
        actions={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {lastSaved && (
              <span className="text-xs text-muted-foreground mr-2">
                🕒 Terakhir disimpan pada {format(lastSaved, 'HH:mm')} WIB
              </span>
            )}
            {!isDateMissing && selectedKamar && siswaList.length > 0 && (
              <Button
                id="btn-hapus-presensi"
                variant="destructive"
                onClick={handleHapusPresensi}
                isLoading={deletePresensiMutation.isPending}
                disabled={deletePresensiMutation.isPending}
                className="shrink-0 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900/50"
              >
                Hapus Presensi Tanggal Ini
              </Button>
            )}
            <Button
              id="btn-libur-massal"
              variant="outline"
              onClick={() => setIsLiburDialogOpen(true)}
              disabled={!selectedKamar || siswaList.length === 0}
              className="shrink-0 text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-950/50"
            >
              Set Libur Massal
            </Button>
            <Button
              id="btn-simpan-checklist"
              onClick={handleSimpan}
              isLoading={isSaving}
              disabled={isSaving || !selectedKamar || siswaList.length === 0}
              className={cn(
                'shrink-0',
                isSuccessTimer && 'bg-green-600 hover:bg-green-700 text-white border-transparent'
              )}
            >
              {isSaving ? (
                'Menyimpan...'
              ) : isSuccessTimer ? (
                <>
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Berhasil Disimpan!
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {!isDateMissing ? 'Perbarui Checklist' : 'Simpan Checklist'}
                </>
              )}
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

      {/* ── Alert Tanggal Belum Diisi ── */}
      {missingDates.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span>Terdapat beberapa tanggal yang belum diinput pada semester ini.</span>
            <button
              type="button"
              onClick={() => setIsMissingDatesDialogOpen(true)}
              className="ml-2 font-semibold underline hover:text-red-800 dark:hover:text-red-300 focus:outline-none"
            >
              [Lihat Daftar Tanggal]
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Tanggal</label>
          <DatePicker
            value={selectedDate}
            onChange={(d) => {
              if (d) setSelectedDate(d)
            }}
            modifiers={{
              missing: (date: Date) =>
                missingDates.some(
                  (missingDate) =>
                    missingDate.getFullYear() === date.getFullYear() &&
                    missingDate.getMonth() === date.getMonth() &&
                    missingDate.getDate() === date.getDate()
                ),
            }}
            modifiersClassNames={{
              missing:
                'relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-red-500',
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Kategori</label>
          <Select
            value={filterKategori}
            onValueChange={(v) => {
              setFilterKategori(v)
              setSelectedKamar('')
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

      {/* ── Empty States ── */}
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
            Belum ada kegiatan. Tambahkan di menu{' '}
            <a href="/mutabaah/kegiatan" className="text-primary underline">
              Kegiatan Mutabaah
            </a>
            .
          </p>
        </div>
      )}

      {/* ── PIVOT TABEL: baris=Kegiatan, kolom=Siswa ── */}
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
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  {/* Kolom No — sticky */}
                  <th
                    className="sticky left-0 z-20 w-10 border-r border-[var(--border)] bg-white dark:bg-background px-2 py-2 text-center text-xs font-semibold text-[var(--text-secondary)] shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                  >
                    No
                  </th>
                  {/* Kolom Nama Kegiatan — sticky */}
                  <th
                    className="sticky left-10 z-20 min-w-[180px] border-r border-[var(--border)] bg-white dark:bg-background px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)] shadow-[inset_-1px_0_0_0_theme(colors.border)]"
                  >
                    Nama Kegiatan
                  </th>
                  {/* Satu kolom per siswa */}
                  {(siswaList as SiswaRow[]).map((siswa) => (
                    <th
                      key={siswa.id}
                      className="min-w-[140px] border-r border-[var(--border)] px-2 py-1.5 text-center text-xs font-semibold text-[var(--text-primary)]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="leading-tight">{siswa.nama}</span>
                        <span className="text-[10px] font-normal text-[var(--text-tertiary)]">{siswa.kelas}</span>
                        {/* Tombol Hadir Semua per siswa */}
                        <button
                          type="button"
                          id={`btn-hadir-semua-${siswa.id}`}
                          onClick={() => hadirSemuaSiswa(siswa.id)}
                          className="mt-0.5 flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900"
                          title={`Hadir Semua untuk ${siswa.nama}`}
                        >
                          <CheckCheck className="h-2.5 w-2.5" />
                          Hadir Semua
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => {
                  const isEven = rowIdx % 2 === 0
                  const rowBg = row.isGroupHeader
                    ? 'bg-[var(--surface-2)]'
                    : isEven
                      ? 'bg-[var(--surface)]'
                      : 'bg-[var(--surface-2)]/60'

                  return (
                    <tr key={`${row.kegiatanId}-${row.subId ?? 'main'}-${rowIdx}`} className={`border-b border-[var(--border)] ${rowBg}`}>
                      {/* Kolom No */}
                      <td className="sticky left-0 z-10 border-r border-[var(--border)] px-2 py-2 text-center text-xs text-[var(--text-tertiary)] bg-white dark:bg-background shadow-[inset_-1px_0_0_0_theme(colors.border)]">
                        {row.isGroupHeader ? '' : (
                          // Hitung nomor urut baris kegiatan (excludes group headers)
                          rows.slice(0, rowIdx + 1).filter((r) => !r.isGroupHeader).length
                        )}
                      </td>

                      {/* Kolom Nama Kegiatan */}
                      <td className="sticky left-10 z-10 border-r border-[var(--border)] px-3 py-2 bg-white dark:bg-background shadow-[inset_-1px_0_0_0_theme(colors.border)]">
                        {row.isGroupHeader ? (
                          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
                            {row.namaKegiatan}
                          </span>
                        ) : row.isSub ? (
                          <span className="ml-3 text-xs text-[var(--text-secondary)]">
                            ↳ {row.namaSub}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-[var(--text-primary)]">
                            {row.namaKegiatan}
                          </span>
                        )}
                      </td>

                      {/* Sel per siswa */}
                      {(siswaList as SiswaRow[]).map((siswa) => {
                        if (row.isGroupHeader) {
                          return (
                            <td
                              key={`${siswa.id}-group-${row.kegiatanId}`}
                              className="border-r border-[var(--border)] px-2 py-1"
                            />
                          )
                        }

                        const key = buildKey(siswa.id, row.kegiatanId, row.subId)
                        const currentStatus = mutabaahData.get(key) ?? '-'

                        return (
                          <td
                            key={`${siswa.id}-${row.kegiatanId}-${row.subId ?? 'main'}`}
                            className={`border-r border-[var(--border)] p-1 ${STATUS_CELL_CLASS[currentStatus]}`}
                          >
                            <Select
                              value={currentStatus}
                              onValueChange={(val) =>
                                setStatus(siswa.id, row.kegiatanId, row.subId, val as MutabaahStatus)
                              }
                            >
                              <SelectTrigger
                                id={`sel-${siswa.id}-${row.kegiatanId}-${row.subId ?? 'main'}`}
                                className="h-7 min-w-[110px] border-none bg-transparent text-xs font-medium focus:ring-0"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ALL_STATUS_OPTIONS.map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs">
                                    {STATUS_LABEL[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
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
        onConfirm={() => {
          tandaiSemuaLibur()
          setIsLiburDialogOpen(false)
        }}
        isLoading={false}
      />

      {/* ── Dialog Sukses Simpan ── */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md bg-[var(--surface)] border border-[var(--border)] shadow-lg backdrop-blur-md text-center">
          <DialogHeader className="flex flex-col items-center pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 mb-4 animate-bounce">
              <CheckCheck className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-[var(--text-primary)]">
              Berhasil Disimpan!
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-[var(--text-secondary)] mt-2 px-4 leading-relaxed">
              Data presensi berhasil disimpan. Apa yang ingin Anda lakukan selanjutnya?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3 mt-6 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSuccessDialog(false)}
              className="px-5"
            >
              Tutup
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowSuccessDialog(false)
                router.push(`/mutabaah/rekap?unit=${activeTab}&kamar=${selectedKamar}`)
              }}
              className="bg-primary hover:bg-primary-hover text-white font-semibold px-5"
            >
              Cek / Review Rekap
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Konfirmasi Hapus Presensi ── */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-[var(--surface)] border border-[var(--border)] shadow-lg backdrop-blur-md">
          <DialogHeader className="flex flex-col items-center text-center pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 mb-4 animate-bounce">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-[var(--text-primary)]">
              Hapus Presensi Tanggal Ini
            </DialogTitle>
            <div className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed px-4">
              Apakah Anda yakin ingin menghapus seluruh data presensi di kamar <strong className="text-[var(--text-primary)]">"{selectedKamar}"</strong> pada tanggal <strong className="text-[var(--text-primary)]">{format(selectedDate, 'dd MMMM yyyy', { locale: idLocale })}</strong>?
              <p className="mt-2 text-xs text-red-500 font-semibold">⚠️ Tindakan ini bersifat permanen dan tidak dapat dibatalkan.</p>
            </div>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3 mt-6 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={deletePresensiMutation.isPending}
              className="px-5"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                deletePresensiMutation.mutate()
              }}
              isLoading={deletePresensiMutation.isPending}
              disabled={deletePresensiMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5"
            >
              Ya, Hapus Semua
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Daftar Tanggal Belum Diisi ── */}
      <Dialog open={isMissingDatesDialogOpen} onOpenChange={setIsMissingDatesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tanggal Belum Diinput</DialogTitle>
          </DialogHeader>
          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Pilih salah satu tanggal di bawah ini untuk langsung mengisi data kehadiran:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {missingDates.map((date, index) => {
                const dateStr = format(date, 'EEEE, dd MMMM yyyy', { locale: idLocale })
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setSelectedDate(date)
                      setIsMissingDatesDialogOpen(false)
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors text-center cursor-pointer"
                  >
                    {dateStr}
                  </button>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
