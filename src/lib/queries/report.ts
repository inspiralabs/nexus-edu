// src/lib/queries/report.ts
// Service untuk generate Laporan Hasil Belajar Bulanan & Semesteran

import { createClient } from '@/lib/supabase/client'
import type { Unit } from '@/lib/supabase/types'

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
    const y = period.year
    const m = period.month
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { dateFrom: from, dateTo: to }
  }
  // For semester, we'll fetch globally and filter by semester_id separately
  return { dateFrom: '2000-01-01', dateTo: '2099-12-31' }
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
    // Ambil nilai_harian yang ada dalam rentang
    let nilaiQ = supabase
      .from('nilai_harian')
      .select('siswa_id, mata_pelajaran_id')
      .in('siswa_id', siswaIds)
      .in('mata_pelajaran_id', mapelIds)

    if (period.type === 'month') {
      nilaiQ = nilaiQ.gte('tanggal', dateFrom).lte('tanggal', dateTo)
    } else {
      nilaiQ = nilaiQ.eq('semester_id', period.semesterId)
    }

    const { data: nilaiData } = await nilaiQ

    // Ambil nilai_uas yang ada
    let uasQ = supabase
      .from('nilai_uas')
      .select('siswa_id, mata_pelajaran_id')
      .in('siswa_id', siswaIds)
      .in('mata_pelajaran_id', mapelIds)

    if (period.type === 'semester') {
      uasQ = uasQ.eq('semester_id', period.semesterId)
    }

    const { data: uasData } = await uasQ

    // Build per-student, per-mapel coverage
    const coverage = new Map<string, Set<string>>() // siswaId -> Set<mapelId>
    for (const s of students) {
      coverage.set(s.id, new Set())
    }
    for (const n of nilaiData ?? []) {
      coverage.get(n.siswa_id)?.add(n.mata_pelajaran_id)
    }
    for (const u of uasData ?? []) {
      coverage.get(u.siswa_id)?.add(u.mata_pelajaran_id)
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

  const { dateFrom, dateTo } = getPeriodDateRange(period)

  // 3. Nilai harian (Formatif + Sumatif)
  let nilaiHarianQ = supabase
    .from('nilai_harian')
    .select('mata_pelajaran_id, tipe_nilai, nilai_final, tanggal, bank_soal_id, bank_soal(tujuan_pembelajaran, created_at), tipe_nilai_rel:tipe_nilai(jenis_nilai)')
    .eq('siswa_id', siswaId)
    .in('mata_pelajaran_id', mapelItems.map((m: { id: string }) => m.id))
    .order('tanggal', { ascending: false })

  if (period.type === 'month') {
    nilaiHarianQ = nilaiHarianQ.gte('tanggal', dateFrom).lte('tanggal', dateTo)
  } else {
    nilaiHarianQ = nilaiHarianQ.eq('semester_id', period.semesterId)
  }

  const { data: nilaiHarianData, error: nhError } = await nilaiHarianQ
  if (nhError) throw new Error(nhError.message)

  // 4. Nilai UAS
  let nilaiUASQ = supabase
    .from('nilai_uas')
    .select('mata_pelajaran_id, nilai_final, bank_soal_id, bank_soal(tujuan_pembelajaran, created_at), created_at')
    .eq('siswa_id', siswaId)
    .in('mata_pelajaran_id', mapelItems.map((m: { id: string }) => m.id))
    .order('created_at', { ascending: false })

  if (period.type === 'semester') {
    nilaiUASQ = nilaiUASQ.eq('semester_id', period.semesterId)
  }

  const { data: nilaiUASData, error: nuError } = await nilaiUASQ
  if (nuError) throw new Error(nuError.message)

  // 5. Hitung nilai per mapel
  const nilaiPerMapel: MapelNilai[] = mapelItems.map((mapel: { id: string; nama_mapel: string }) => {
    const harianMapel = (nilaiHarianData ?? []).filter(
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

    // UAS - ambil entry terakhir per mapel
    const uasEntry = (nilaiUASData ?? []).find((u: any) => u.mata_pelajaran_id === mapel.id)
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

  // 6. Presensi
  let presensiQ = supabase
    .from('presensi')
    .select('status, tanggal')
    .eq('siswa_id', siswaId)

  if (period.type === 'month') {
    presensiQ = presensiQ.gte('tanggal', dateFrom).lte('tanggal', dateTo)
  } else {
    presensiQ = presensiQ.eq('semester_id', period.semesterId)
  }

  const { data: presensiData } = await presensiQ

  const absensi: AbsensiRekap = { sakit: 0, izin: 0, alpha: 0, hadir: 0, total: 0 }
  for (const p of presensiData ?? []) {
    absensi.total++
    if (p.status === 'Sakit') absensi.sakit++
    else if (p.status === 'Izin') absensi.izin++
    else if (p.status === 'Alpha') absensi.alpha++
    else absensi.hadir++
  }

  // 7. Kedisiplinan
  let kedisiplinanQ = supabase
    .from('kedisiplinan')
    .select('tanggal, status, kategori_disiplin(nama_kategori), pasal(nama_pasal, poin)')
    .eq('siswa_id', siswaId)
    .eq('status', 'Sudah Diproses')

  if (period.type === 'month') {
    kedisiplinanQ = kedisiplinanQ.gte('tanggal', dateFrom).lte('tanggal', dateTo)
  }

  const { data: kedisiplinanData } = await kedisiplinanQ

  const kedisiplinan: KedisiplinanItem[] = (kedisiplinanData ?? []).map((k: any) => {
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

  // 8. Prestasi
  let prestasiQ = supabase
    .from('prestasi')
    .select('waktu, event(nama_event), juara(nama_juara), tingkat_kejuaraan')
    .eq('siswa_id', siswaId)
    .eq('tipe', 'siswa')

  if (period.type === 'month') {
    prestasiQ = prestasiQ.gte('waktu', dateFrom).lte('waktu', dateTo)
  }

  const { data: prestasiData } = await prestasiQ

  const prestasi: PrestasiItem[] = (prestasiData ?? []).map((p: any) => {
    const ev = Array.isArray(p.event) ? p.event[0] : p.event
    const jr = Array.isArray(p.juara) ? p.juara[0] : p.juara
    return {
      waktu: p.waktu,
      namaEvent: ev?.nama_event ?? '-',
      juara: jr?.nama_juara ?? '-',
      tingkat: p.tingkat_kejuaraan ?? '-',
    }
  })

  // 9. Status kelengkapan
  const coveredMapelIds = new Set([
    ...(nilaiHarianData ?? []).map((n: any) => n.mata_pelajaran_id),
    ...(nilaiUASData ?? []).map((u: any) => u.mata_pelajaran_id),
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
