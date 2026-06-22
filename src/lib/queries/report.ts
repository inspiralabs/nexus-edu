// src/lib/queries/report.ts
// Service untuk generate Laporan Hasil Belajar Bulanan & Semesteran

import { createClient } from '@/lib/supabase/client'
import type { Unit } from '@/lib/supabase/types'
import { startOfMonth, endOfMonth } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportPeriod =
  | { type: 'month'; year: number; month: number } // month: 1-12
  | { type: 'semester'; semesterId: string }

export interface ReportFilters {
  unit: Unit
  kelasId: string
  period: ReportPeriod
}

export interface MapelNilai {
  mapelId: string
  namaMapel: string
  avgFormatif: number | null
  avgSumatif: number | null
  nilaiUAS: number | null
  nilaiAkhir: number | null
  tujuanPembelajaran: string
}

export interface AbsensiRekap {
  sakit: number
  izin: number
  alpha: number
  hadir: number
  total: number
}

export interface KedisiplinanItem {
  tanggal: string
  kategori: string
  pasal: string
  poin: number
  status: string
}

export interface PrestasiItem {
  waktu: string | null
  namaEvent: string
  juara: string
  tingkat: string
}

export interface SiswaReport {
  siswaId: string
  nama: string
  nomorInduk: string | null
  kamar: string | null
  kelasNama: string
  unit: Unit
  completenessStatus: 'Lengkap' | 'Belum Lengkap' | 'Kosong'
  nilaiPerMapel: MapelNilai[]
  absensi: AbsensiRekap
  kedisiplinan: KedisiplinanItem[]
  prestasi: PrestasiItem[]
}

export interface KelasReportSummary {
  kelasId: string
  kelasNama: string
  unit: Unit
  totalSiswa: number
  students: {
    siswaId: string
    nama: string
    nomorInduk: string | null
    completenessStatus: 'Lengkap' | 'Belum Lengkap' | 'Kosong'
  }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && v !== undefined && !isNaN(v))
  if (valid.length === 0) return null
  return Math.round((valid.reduce((sum, v) => sum + v, 0) / valid.length) * 100) / 100
}

function calcNilaiAkhir(
  avgFormatif: number | null,
  avgSumatif: number | null,
  nilaiUAS: number | null
): number | null {
  const components: number[] = []
  if (avgFormatif !== null) components.push(avgFormatif)
  if (avgSumatif !== null) components.push(avgSumatif)
  if (nilaiUAS !== null) components.push(nilaiUAS)
  if (components.length === 0) return null
  return Math.round((components.reduce((s, v) => s + v, 0) / components.length) * 100) / 100
}

function getPeriodDateRange(period: ReportPeriod): { dateFrom: string; dateTo: string } {
  if (period.type === 'month') {
    const baseDate = new Date(period.year, period.month - 1, 1, 12, 0, 0)
    const startLocal = startOfMonth(baseDate)
    const endLocal = endOfMonth(baseDate)
    
    const startDate = new Date(Date.UTC(startLocal.getFullYear(), startLocal.getMonth(), startLocal.getDate(), 0, 0, 0))
    const endDate = new Date(Date.UTC(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate(), 23, 59, 59, 999))
    
    return {
      dateFrom: startDate.toISOString(),
      dateTo: endDate.toISOString(),
    }
  }
  return { dateFrom: '2000-01-01T00:00:00.000Z', dateTo: '2099-12-31T23:59:59.999Z' }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ambil daftar siswa di kelas tertentu beserta status kelengkapan data.
 * Digunakan untuk tabel utama halaman laporan-bulanan.
 */
export async function getKelasReportSummary(
  filters: ReportFilters
): Promise<KelasReportSummary> {
  const supabase = createClient()
  const { kelasId, period } = filters

  const isValidUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)

  if (!kelasId || kelasId === 'all' || !isValidUuid(kelasId)) {
    throw new Error('Kelas ID tidak valid')
  }

  // 1. Fetch info kelas
  const { data: kelasData, error: kelasError } = await supabase
    .from('kelas')
    .select('id, nama_kelas, unit')
    .eq('id', kelasId)
    .single()

  if (kelasError || !kelasData) {
    throw new Error(kelasError?.message ?? 'Kelas tidak ditemukan')
  }

  // 2. Fetch daftar siswa di kelas
  const { data: siswaList, error: siswaError } = await supabase
    .from('students')
    .select('id, nama, nomor_induk')
    .eq('kelas_id', kelasId)
    .eq('is_alumni', false)
    .order('nama', { ascending: true })

  if (siswaError) throw new Error(siswaError.message)
  const students = siswaList ?? []

  if (students.length === 0) {
    return {
      kelasId,
      kelasNama: kelasData.nama_kelas,
      unit: kelasData.unit as Unit,
      totalSiswa: 0,
      students: [],
    }
  }

  // 3. Fetch mapel yang terikat pada kelas ini
  const { data: mapelList, error: mapelError } = await supabase
    .from('mata_pelajaran')
    .select('id')
    .contains('kelas_ids', [kelasId])

  if (mapelError) throw new Error(mapelError.message)
  const mapelIds = (mapelList ?? []).map((m: { id: string }) => m.id)

  const siswaIds = students.map((s: { id: string }) => s.id)
  const { dateFrom, dateTo } = getPeriodDateRange(period)

  // 4. Cek kelengkapan nilai — apakah setiap siswa punya minimal 1 nilai per mapel
  let completenessMap = new Map<string, 'Lengkap' | 'Belum Lengkap' | 'Kosong'>()

  if (mapelIds.length === 0) {
    // Tidak ada mapel terikat → semua 'Kosong'
    for (const s of students) {
      completenessMap.set(s.id, 'Kosong')
    }
  } else {
    // Ambil semesterId
    let semesterId = ''
    if (period.type === 'semester') {
      semesterId = period.semesterId
    } else {
      const { data: activeSem } = await supabase
        .from('semester')
        .select('id')
        .eq('is_aktif', true)
        .single()
      semesterId = activeSem?.id ?? ''
    }

    if (!semesterId || semesterId === 'all' || !isValidUuid(semesterId)) {
      throw new Error('Semester ID tidak valid')
    }

    // Ambil nilai_harian yang ada dalam semester tersebut
    const { data: nilaiData } = await supabase
      .from('nilai_harian')
      .select('siswa_id, mata_pelajaran_id, tanggal')
      .in('siswa_id', siswaIds)
      .in('mata_pelajaran_id', mapelIds)
      .eq('semester_id', semesterId)

    // Ambil nilai_uas yang ada dalam semester tersebut
    const { data: uasData } = await supabase
      .from('nilai_uas')
      .select('siswa_id, mata_pelajaran_id')
      .in('siswa_id', siswaIds)
      .in('mata_pelajaran_id', mapelIds)
      .eq('semester_id', semesterId)

    // Logika post-processing filter tanggal di level JS
    let startDate: Date | null = null
    let endDate: Date | null = null
    if (period.type === 'month') {
      startDate = new Date(period.year, period.month - 1, 1, 0, 0, 0)
      endDate = new Date(period.year, period.month, 0, 23, 59, 59, 999)
    }

    const nilaiValid = (nilaiData ?? []).filter((n: any) => {
      if (period.type === 'month' && startDate && endDate) {
        const d = new Date(n.tanggal)
        return d >= startDate && d <= endDate
      }
      return true
    })

    // Build per-student, per-mapel coverage
    const coverage = new Map<string, Set<string>>() // siswaId -> Set<mapelId>
    for (const s of students) {
      coverage.set(s.id, new Set())
    }
    for (const n of nilaiValid) {
      coverage.get(n.siswa_id)?.add(n.mata_pelajaran_id)
    }
    if (period.type === 'semester') {
      for (const u of uasData ?? []) {
        coverage.get(u.siswa_id)?.add(u.mata_pelajaran_id)
      }
    }

    for (const s of students) {
      const covered = coverage.get(s.id) ?? new Set()
      if (covered.size === 0) {
        completenessMap.set(s.id, 'Kosong')
      } else if (mapelIds.every((m: string) => covered.has(m))) {
        completenessMap.set(s.id, 'Lengkap')
      } else {
        completenessMap.set(s.id, 'Belum Lengkap')
      }
    }
  }

  return {
    kelasId,
    kelasNama: kelasData.nama_kelas,
    unit: kelasData.unit as Unit,
    totalSiswa: students.length,
    students: students.map((s: { id: string; nama: string; nomor_induk: string | null }) => ({
      siswaId: s.id,
      nama: s.nama,
      nomorInduk: s.nomor_induk,
      completenessStatus: completenessMap.get(s.id) ?? 'Kosong',
    })),
  }
}

/**
 * Generate laporan lengkap untuk 1 siswa.
 * Digunakan saat tombol "Detail / Cetak" diklik.
 */
export async function getSiswaReport(
  siswaId: string,
  kelasId: string,
  period: ReportPeriod
): Promise<SiswaReport> {
  const supabase = createClient()

  const isValidUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)

  if (!siswaId || siswaId === 'all' || !isValidUuid(siswaId)) {
    throw new Error('Siswa ID tidak valid')
  }
  if (!kelasId || kelasId === 'all' || !isValidUuid(kelasId)) {
    throw new Error('Kelas ID tidak valid')
  }

  // 1. Data siswa dasar
  const { data: siswa, error: siswaError } = await supabase
    .from('students')
    .select('id, nama, nomor_induk, kamar, unit, kelas_id, kelas(nama_kelas)')
    .eq('id', siswaId)
    .single()

  if (siswaError || !siswa) throw new Error(siswaError?.message ?? 'Siswa tidak ditemukan')

  const kelasRaw = siswa.kelas
  const kelasNama = Array.isArray(kelasRaw)
    ? (kelasRaw[0] as { nama_kelas: string } | undefined)?.nama_kelas ?? '-'
    : (kelasRaw as { nama_kelas: string } | null)?.nama_kelas ?? '-'

  // 2. Mapel terikat pada kelas
  const { data: mapelList, error: mapelError } = await supabase
    .from('mata_pelajaran')
    .select('id, nama_mapel')
    .contains('kelas_ids', [kelasId])
    .order('nama_mapel', { ascending: true })

  if (mapelError) throw new Error(mapelError.message)
  const mapelItems = mapelList ?? []

  // Ambil semesterId
  let semesterId = ''
  if (period.type === 'semester') {
    semesterId = period.semesterId
  } else {
    const { data: activeSem } = await supabase
      .from('semester')
      .select('id')
      .eq('is_aktif', true)
      .single()
    semesterId = activeSem?.id ?? ''
  }

  if (!semesterId || semesterId === 'all' || !isValidUuid(semesterId)) {
    throw new Error('Semester ID tidak valid')
  }

  // Ambil date range dari semester untuk limitasi data non-semester seperti kedisiplinan dan prestasi
  let semStart: Date | null = null
  let semEnd: Date | null = null
  const { data: semData } = await supabase
    .from('semester')
    .select('tanggal_mulai, tanggal_selesai')
    .eq('id', semesterId)
    .single()

  if (semData?.tanggal_mulai && semData?.tanggal_selesai) {
    semStart = new Date(semData.tanggal_mulai)
    semStart.setHours(0, 0, 0, 0)
    semEnd = new Date(semData.tanggal_selesai)
    semEnd.setHours(23, 59, 59, 999)
  }

  // 3. Nilai harian (Formatif + Sumatif)
  const { data: nilaiHarianData, error: nhError } = await supabase
    .from('nilai_harian')
    .select('mata_pelajaran_id, tipe_nilai, nilai_final, tanggal, bank_soal_id, bank_soal(tujuan_pembelajaran, created_at), tipe_nilai_rel:tipe_nilai(jenis_nilai)')
    .eq('siswa_id', siswaId)
    .in('mata_pelajaran_id', mapelItems.map((m: { id: string }) => m.id))
    .eq('semester_id', semesterId)

  if (nhError) throw new Error(nhError.message)

  // 4. Nilai UAS
  const { data: nilaiUASData, error: nuError } = await supabase
    .from('nilai_uas')
    .select('mata_pelajaran_id, nilai_final, bank_soal_id, bank_soal(tujuan_pembelajaran, created_at), created_at')
    .eq('siswa_id', siswaId)
    .in('mata_pelajaran_id', mapelItems.map((m: { id: string }) => m.id))
    .eq('semester_id', semesterId)

  if (nuError) throw new Error(nuError.message)

  // 5. Presensi
  const { data: presensiData } = await supabase
    .from('presensi')
    .select('status, tanggal')
    .eq('siswa_id', siswaId)
    .eq('semester_id', semesterId)

  // 6. Kedisiplinan
  const { data: kedisiplinanData } = await supabase
    .from('kedisiplinan')
    .select('tanggal, status, kategori_disiplin(nama_kategori), pasal(nama_pasal, poin)')
    .eq('siswa_id', siswaId)
    .eq('status', 'Sudah Diproses')

  // 7. Prestasi
  const { data: prestasiData } = await supabase
    .from('prestasi')
    .select('waktu, event(nama_event), juara(nama_juara), tingkat_kejuaraan')
    .eq('siswa_id', siswaId)
    .eq('tipe', 'siswa')

  // Logika post-processing filter rentang tanggal di level JS
  let startDate: Date | null = null
  let endDate: Date | null = null
  if (period.type === 'month') {
    startDate = new Date(period.year, period.month - 1, 1, 0, 0, 0)
    endDate = new Date(period.year, period.month, 0, 23, 59, 59, 999)
  }

  // Filter nilai harian
  const harianValid = (nilaiHarianData ?? []).filter((n: any) => {
    if (period.type === 'month' && startDate && endDate) {
      const d = new Date(n.tanggal)
      return d >= startDate && d <= endDate
    }
    return true
  })

  // Filter presensi
  const presensiValid = (presensiData ?? []).filter((p: any) => {
    if (period.type === 'month' && startDate && endDate) {
      const d = new Date(p.tanggal)
      return d >= startDate && d <= endDate
    }
    return true
  })

  // Filter kedisiplinan
  const kedisiplinanValid = (kedisiplinanData ?? []).filter((k: any) => {
    if (period.type === 'month' && startDate && endDate) {
      const d = new Date(k.tanggal)
      return d >= startDate && d <= endDate
    }
    if (semStart && semEnd) {
      const d = new Date(k.tanggal)
      return d >= semStart && d <= semEnd
    }
    return true
  })

  // Filter prestasi
  const prestasiValid = (prestasiData ?? []).filter((p: any) => {
    if (period.type === 'month' && startDate && endDate) {
      if (!p.waktu) return false
      const d = new Date(p.waktu)
      return d >= startDate && d <= endDate
    }
    if (semStart && semEnd) {
      if (!p.waktu) return false
      const d = new Date(p.waktu)
      return d >= semStart && d <= semEnd
    }
    return true
  })

  // 8. Hitung nilai per mapel
  const nilaiPerMapel: MapelNilai[] = mapelItems.map((mapel: { id: string; nama_mapel: string }) => {
    const harianMapel = harianValid.filter(
      (n: any) => n.mata_pelajaran_id === mapel.id
    )
    const formatifValues = harianMapel
      .filter((n: any) => {
        const tipe = n.tipe_nilai_rel ? (n.tipe_nilai_rel.jenis_nilai === 'Harian' ? 'Formatif' : 'Sumatif') : n.tipe_nilai
        return tipe === 'Formatif'
      })
      .map((n: any) => n.nilai_final as number | null)
    const sumatifValues = harianMapel
      .filter((n: any) => {
        const tipe = n.tipe_nilai_rel ? (n.tipe_nilai_rel.jenis_nilai === 'Harian' ? 'Formatif' : 'Sumatif') : n.tipe_nilai
        return tipe === 'Sumatif'
      })
      .map((n: any) => n.nilai_final as number | null)

    const avgFormatif = avg(formatifValues)
    const avgSumatif = avg(sumatifValues)

    // UAS - ambil entry terakhir per mapel (Hanya di mode semester)
    const uasEntry = period.type === 'semester'
      ? (nilaiUASData ?? []).find((u: any) => u.mata_pelajaran_id === mapel.id)
      : null
    const nilaiUAS = uasEntry ? (uasEntry.nilai_final as number | null) : null

    const nilaiAkhir = calcNilaiAkhir(avgFormatif, avgSumatif, nilaiUAS)

    // Tujuan Pembelajaran — gabungkan dari bank_soal yang terkait
    const tpSet = new Set<string>()
    for (const n of harianMapel) {
      const bs = n.bank_soal
      const bsItem = Array.isArray(bs) ? bs[0] : bs
      if (bsItem?.tujuan_pembelajaran) tpSet.add(bsItem.tujuan_pembelajaran.trim())
    }
    if (uasEntry?.bank_soal) {
      const bs = uasEntry.bank_soal
      const bsItem = Array.isArray(bs) ? bs[0] : bs
      if (bsItem?.tujuan_pembelajaran) tpSet.add(bsItem.tujuan_pembelajaran.trim())
    }

    return {
      mapelId: mapel.id,
      namaMapel: mapel.nama_mapel,
      avgFormatif,
      avgSumatif,
      nilaiUAS,
      nilaiAkhir,
      tujuanPembelajaran: Array.from(tpSet).join('; ') || '-',
    }
  })

  // 9. Rekap Absensi
  const absensi: AbsensiRekap = { sakit: 0, izin: 0, alpha: 0, hadir: 0, total: 0 }
  for (const p of presensiValid) {
    absensi.total++
    if (p.status === 'Sakit') absensi.sakit++
    else if (p.status === 'Izin') absensi.izin++
    else if (p.status === 'Alpha') absensi.alpha++
    else absensi.hadir++
  }

  // 10. Kedisiplinan
  const kedisiplinan: KedisiplinanItem[] = kedisiplinanValid.map((k: any) => {
    const kat = Array.isArray(k.kategori_disiplin) ? k.kategori_disiplin[0] : k.kategori_disiplin
    const pasal = Array.isArray(k.pasal) ? k.pasal[0] : k.pasal
    return {
      tanggal: k.tanggal,
      kategori: kat?.nama_kategori ?? '-',
      pasal: pasal?.nama_pasal ?? '-',
      poin: pasal?.poin ?? 0,
      status: k.status,
    }
  })

  // 11. Prestasi
  const prestasi: PrestasiItem[] = prestasiValid.map((p: any) => {
    const ev = Array.isArray(p.event) ? p.event[0] : p.event
    const jr = Array.isArray(p.juara) ? p.juara[0] : p.juara
    return {
      waktu: p.waktu,
      namaEvent: ev?.nama_event ?? '-',
      juara: jr?.nama_juara ?? '-',
      tingkat: p.tingkat_kejuaraan ?? '-',
    }
  })

  // 12. Status kelengkapan
  const coveredMapelIds = new Set([
    ...harianValid.map((n: any) => n.mata_pelajaran_id),
    ...(period.type === 'semester' ? (nilaiUASData ?? []).map((u: any) => u.mata_pelajaran_id) : []),
  ])

  let completenessStatus: 'Lengkap' | 'Belum Lengkap' | 'Kosong' = 'Kosong'
  if (mapelItems.length === 0) {
    completenessStatus = 'Kosong'
  } else if (coveredMapelIds.size === 0) {
    completenessStatus = 'Kosong'
  } else if (mapelItems.every((m: { id: string }) => coveredMapelIds.has(m.id))) {
    completenessStatus = 'Lengkap'
  } else {
    completenessStatus = 'Belum Lengkap'
  }

  return {
    siswaId,
    nama: siswa.nama,
    nomorInduk: siswa.nomor_induk,
    kamar: siswa.kamar,
    kelasNama,
    unit: siswa.unit as Unit,
    completenessStatus,
    nilaiPerMapel,
    absensi,
    kedisiplinan,
    prestasi,
  }
}
