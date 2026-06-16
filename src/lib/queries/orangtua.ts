import { createClient } from '@/lib/supabase/client'
import type {
  CatatanKelakuan,
  Kedisiplinan,
  MataPelajaran,
  NilaiHarian,
  NilaiUAS,
  Presensi,
  Prestasi,
  Student,
} from '@/lib/supabase/types'

// Helper: Relation unwrapping
type Relation<T> = T | T[] | null | undefined

function unwrapRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
}

/**
 * Ambil data anak-anak yang dihubungkan ke akun orangtua.
 */
export async function getAnakSaya(profileId: string): Promise<Student[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orangtua_siswa')
    .select('students(*), orangtua!inner(profile_id)')
    .eq('orangtua.profile_id', profileId)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row: any) => row.students)
    .filter((s): s is Student => s !== null && s !== undefined)
}

/**
 * Ambil data ringkasan/rekap untuk Dashboard Orang Tua.
 */
export async function getDashboardOrangTua(siswaId: string): Promise<{
  kehadiranBulanIni: number
  rataNilai: number
  totalPrestasi: number
  totalPoinPelanggaran: number
  skorMutabaah: number
}> {
  const supabase = createClient()
  
  // Format Tanggal Awal Bulan Ini
  const now = new Date()
  const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // 1. Kehadiran Bulan Ini
  const { data: presensiData, error: pError } = await supabase
    .from('presensi')
    .select('status')
    .eq('siswa_id', siswaId)
    .gte('tanggal', startStr)

  if (pError) throw new Error(pError.message)
  
  const totalPresensi = presensiData?.length ?? 0
  const hadirPresensi = presensiData?.filter((p) => p.status === 'Hadir').length ?? 0
  const kehadiranBulanIni = totalPresensi > 0 ? Math.round((hadirPresensi / totalPresensi) * 100) : 0

  // 2. Rata-rata Nilai (Approved Only)
  const { data: nilaiHarian, error: nhError } = await supabase
    .from('nilai_harian')
    .select('nilai_final')
    .eq('siswa_id', siswaId)
    .eq('is_approved', true)

  if (nhError) throw new Error(nhError.message)

  const { data: nilaiUAS, error: nuError } = await supabase
    .from('nilai_uas')
    .select('nilai_final')
    .eq('siswa_id', siswaId)
    .eq('is_approved', true)

  if (nuError) throw new Error(nuError.message)

  const allGrades = [
    ...(nilaiHarian ?? []).map((n) => Number(n.nilai_final)),
    ...(nilaiUAS ?? []).map((n) => Number(n.nilai_final)),
  ].filter((v) => !isNaN(v))

  const rataNilai = allGrades.length > 0 ? Math.round(allGrades.reduce((sum, v) => sum + v, 0) / allGrades.length) : 0

  // 3. Total Prestasi
  const { count: totalPrestasi, error: prError } = await supabase
    .from('prestasi')
    .select('*', { count: 'exact', head: true })
    .eq('siswa_id', siswaId)

  if (prError) throw new Error(prError.message)

  // 4. Total Poin Pelanggaran (status = 'Sudah Diproses')
  const { data: kedisiplinan, error: kdError } = await supabase
    .from('kedisiplinan')
    .select('pasal(poin)')
    .eq('siswa_id', siswaId)
    .eq('status', 'Sudah Diproses')

  if (kdError) throw new Error(kdError.message)

  const totalPoinPelanggaran = (kedisiplinan ?? []).reduce((sum, row: any) => {
    const p = unwrapRelation(row.pasal)
    return sum + (p?.poin ?? 0)
  }, 0)

  // 5. Skor Mutabaah Bulan Ini
  const { data: mutabaahData, error: mutError } = await supabase
    .from('mutabaah')
    .select('status')
    .eq('siswa_id', siswaId)
    .gte('tanggal', startStr)

  if (mutError) throw new Error(mutError.message)

  const totalMutabaah = mutabaahData?.length ?? 0
  const hadirMutabaah = mutabaahData?.filter((m) => m.status === 'Hadir').length ?? 0
  const skorMutabaah = totalMutabaah > 0 ? Math.round((hadirMutabaah / totalMutabaah) * 100) : 0

  return {
    kehadiranBulanIni,
    rataNilai,
    totalPrestasi: totalPrestasi ?? 0,
    totalPoinPelanggaran,
    skorMutabaah,
  }
}

/**
 * Ambil data presensi anak.
 */
export async function getPresensiAnak(
  siswaId: string,
  filters?: {
    semesterId?: string
    mapelId?: string
    tanggalDari?: string
    tanggalSampai?: string
  }
): Promise<any[]> {
  const supabase = createClient()
  let query = supabase
    .from('presensi')
    .select('*, mata_pelajaran(nama_mapel, unit)')
    .eq('siswa_id', siswaId)
    .order('tanggal', { ascending: false })

  if (filters?.semesterId) query = query.eq('semester_id', filters.semesterId)
  if (filters?.mapelId) query = query.eq('mata_pelajaran_id', filters.mapelId)
  if (filters?.tanggalDari) query = query.gte('tanggal', filters.tanggalDari)
  if (filters?.tanggalSampai) query = query.lte('tanggal', filters.tanggalSampai)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Ambil data nilai harian anak (approved only).
 */
export async function getNilaiHarianAnak(
  siswaId: string,
  filters?: {
    semesterId?: string
    mapelId?: string
  }
): Promise<any[]> {
  const supabase = createClient()
  let query = supabase
    .from('nilai_harian')
    .select('*, mata_pelajaran(nama_mapel)')
    .eq('siswa_id', siswaId)
    .eq('is_approved', true)
    .order('tanggal', { ascending: false })

  if (filters?.semesterId) query = query.eq('semester_id', filters.semesterId)
  if (filters?.mapelId) query = query.eq('mata_pelajaran_id', filters.mapelId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Ambil data nilai UAS anak (approved only).
 */
export async function getNilaiUASAnak(
  siswaId: string,
  filters?: {
    semesterId?: string
    mapelId?: string
  }
): Promise<any[]> {
  const supabase = createClient()
  let query = supabase
    .from('nilai_uas')
    .select('*, mata_pelajaran(nama_mapel)')
    .eq('siswa_id', siswaId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })

  if (filters?.semesterId) query = query.eq('semester_id', filters.semesterId)
  if (filters?.mapelId) query = query.eq('mata_pelajaran_id', filters.mapelId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Rekap/Laporan Rapor Anak.
 */
export async function getRaportAnak(
  siswaId: string,
  semesterId: string
): Promise<any[]> {
  const supabase = createClient()

  // Ambil data unit siswa
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('unit')
    .eq('id', siswaId)
    .single()

  if (studentError || !student) return []

  // Ambil semua mapel sesuai unit siswa
  const { data: mapels, error: mapelError } = await supabase
    .from('mata_pelajaran')
    .select('*')
    .eq('unit', student.unit)

  if (mapelError || !mapels) return []

  // Ambil semua nilai harian approved
  const { data: harian, error: hError } = await supabase
    .from('nilai_harian')
    .select('mata_pelajaran_id, tipe_nilai, nilai_final')
    .eq('siswa_id', siswaId)
    .eq('semester_id', semesterId)
    .eq('is_approved', true)

  if (hError) throw new Error(hError.message)

  // Ambil nilai UAS approved
  const { data: uas, error: uError } = await supabase
    .from('nilai_uas')
    .select('mata_pelajaran_id, nilai_final')
    .eq('siswa_id', siswaId)
    .eq('semester_id', semesterId)
    .eq('is_approved', true)

  if (uError) throw new Error(uError.message)

  return mapels.map((mapel) => {
    const mapelHarian = (harian ?? []).filter((h) => h.mata_pelajaran_id === mapel.id)
    const formatif = mapelHarian.filter((h) => h.tipe_nilai === 'Formatif').map((h) => Number(h.nilai_final))
    const sumatif = mapelHarian.filter((h) => h.tipe_nilai === 'Sumatif').map((h) => Number(h.nilai_final))

    const mapelUas = (uas ?? []).find((u) => u.mata_pelajaran_id === mapel.id)
    const uasVal = mapelUas ? Number(mapelUas.nilai_final) : null

    const avg_formatif = formatif.length > 0 ? formatif.reduce((sum, v) => sum + v, 0) / formatif.length : 0
    const avg_sumatif = sumatif.length > 0 ? sumatif.reduce((sum, v) => sum + v, 0) / sumatif.length : 0

    const components = []
    if (formatif.length > 0) components.push(avg_formatif)
    if (sumatif.length > 0) components.push(avg_sumatif)
    if (uasVal !== null) components.push(uasVal)

    const nilai_rapor = components.length > 0 ? components.reduce((sum, v) => sum + v, 0) / components.length : 0

    return {
      id: mapel.id,
      nama_mapel: mapel.nama_mapel,
      kategori: mapel.kategori,
      avg_formatif: Math.round(avg_formatif * 100) / 100,
      avg_sumatif: Math.round(avg_sumatif * 100) / 100,
      nilai_uas: uasVal,
      nilai_rapor: Math.round(nilai_rapor * 100) / 100,
    }
  })
}

/**
 * Ambil catatan kelakuan anak.
 */
export async function getCatatanKelakuanAnak(
  siswaId: string,
  filters?: {
    semesterId?: string
  }
): Promise<CatatanKelakuan[]> {
  const supabase = createClient()
  let query = supabase
    .from('catatan_kelakuan')
    .select('*')
    .eq('siswa_id', siswaId)
    .order('tanggal', { ascending: false })

  if (filters?.semesterId) query = query.eq('semester_id', filters.semesterId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as CatatanKelakuan[]
}

/**
 * Ambil riwayat kedisiplinan anak.
 */
export async function getKedisiplinanAnak(
  siswaId: string,
  filters?: {
    tanggalDari?: string
    tanggalSampai?: string
  }
): Promise<any[]> {
  const supabase = createClient()
  let query = supabase
    .from('kedisiplinan')
    .select('*, kategori_disiplin(nama_kategori), pasal(nama_pasal, poin), tindakan(nama_tindakan)')
    .eq('siswa_id', siswaId)
    .order('tanggal', { ascending: false })

  if (filters?.tanggalDari) query = query.gte('tanggal', filters.tanggalDari)
  if (filters?.tanggalSampai) query = query.lte('tanggal', filters.tanggalSampai)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Ambil riwayat prestasi anak.
 */
export async function getPrestasiAnak(
  siswaId: string,
  filters?: {
    tanggalDari?: string
    tanggalSampai?: string
  }
): Promise<any[]> {
  const supabase = createClient()
  let query = supabase
    .from('prestasi')
    .select('*, event(nama_event), juara(nama_juara), bidang(nama_bidang), kategori_prestasi(nama_kategori)')
    .eq('siswa_id', siswaId)
    .order('waktu', { ascending: false })

  if (filters?.tanggalDari) query = query.gte('waktu', filters.tanggalDari)
  if (filters?.tanggalSampai) query = query.lte('waktu', filters.tanggalSampai)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Ambil riwayat mutabaah harian anak.
 */
export async function getMutabaahAnak(
  siswaId: string,
  filters?: {
    tanggalDari?: string
    tanggalSampai?: string
    kegiatanId?: string
  }
): Promise<any[]> {
  const supabase = createClient()
  let query = supabase
    .from('mutabaah')
    .select('*, kegiatan(nama_kegiatan), sub_kegiatan(nama_sub)')
    .eq('siswa_id', siswaId)
    .order('tanggal', { ascending: false })

  if (filters?.tanggalDari) query = query.gte('tanggal', filters.tanggalDari)
  if (filters?.tanggalSampai) query = query.lte('tanggal', filters.tanggalSampai)
  if (filters?.kegiatanId) query = query.eq('kegiatan_id', filters.kegiatanId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Ambil daftar semua kegiatan mutabaah.
 */
export async function getKegiatanList(): Promise<any[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kegiatan')
    .select('*')
    .order('urutan', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}
