import { createClient } from '@/lib/supabase/client'

// ─── TypeScript Types ─────────────────────────────────────────────────────────

export type MutabaahStatus =
  | 'Hadir'
  | 'Izin'
  | 'Sakit'
  | 'Terlambat'
  | 'Terlambat Sekali'
  | 'Istihadhah'
  | 'Haid'
  | 'Alpha'
  | 'L'

export type NilaiMutabaah = 'A' | 'B' | 'C' | 'D' | 'E'

export interface MutabaahEntry {
  id: string
  siswa_id: string
  kegiatan_id: string
  sub_kegiatan_id: string | null
  tanggal: string
  status: MutabaahStatus
  is_libur: boolean
  dicatat_oleh: string | null
  students?: { nama: string; kelas: string }
  kegiatan?: { nama_kegiatan: string }
  sub_kegiatan?: { nama_sub: string }
}

export interface KegiatanItem {
  id: string
  nama_kegiatan: string
  urutan: number
  poin_target: number
  sub_kegiatan?: SubKegiatanItem[]
}

export interface SubKegiatanItem {
  id: string
  kegiatan_id: string
  nama_sub: string
  urutan: number
  poin_target: number
}

export interface KamarItem {
  id: string
  nama_kamar: string
  unit: string | null
  musyrif_id: string | null
}

export interface TargetMutabaah {
  id: string
  kamar_id: string
  kegiatan_id: string
  sub_kegiatan_id: string | null
  semester_id: string | null
  target_jumlah: number
}

// ─── Kegiatan ─────────────────────────────────────────────────────────────────

/** Ambil semua kegiatan diurutkan by urutan ASC, mendukung pencarian */
export async function getKegiatan(search?: string): Promise<KegiatanItem[]> {
  const supabase = createClient()

  let query = supabase
    .from('kegiatan')
    .select('*')

  if (search) {
    query = query.ilike('nama_kegiatan', `%${search}%`)
  }

  const { data, error } = await query.order('urutan', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as KegiatanItem[]
}

/** Ambil semua kegiatan beserta sub_kegiatan-nya (nested join) */
export async function getKegiatanWithSub(): Promise<KegiatanItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kegiatan')
    .select('*, sub_kegiatan(*)')
    .order('urutan', { ascending: true })

  if (error) throw new Error(error.message)

  const result = (data ?? []) as Array<KegiatanItem & { sub_kegiatan: SubKegiatanItem[] }>

  // Urutkan sub_kegiatan berdasarkan urutan
  return result.map((k) => ({
    ...k,
    sub_kegiatan: (k.sub_kegiatan ?? []).sort((a, b) => a.urutan - b.urutan),
  }))
}

/** Ambil sub_kegiatan, bisa difilter untuk kegiatan tertentu */
export async function getSubKegiatan(kegiatanId?: string): Promise<SubKegiatanItem[]> {
  const supabase = createClient()

  let query = supabase
    .from('sub_kegiatan')
    .select('*')

  if (kegiatanId && kegiatanId !== 'all') {
    query = query.eq('kegiatan_id', kegiatanId)
  }

  const { data, error } = await query.order('urutan', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as SubKegiatanItem[]
}

/** Tambah kegiatan baru */
export async function createKegiatan(input: {
  nama_kegiatan: string
  poin_target: number
}): Promise<KegiatanItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kegiatan')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as KegiatanItem
}

/** Update kegiatan */
export async function updateKegiatan(
  id: string,
  input: Partial<{ nama_kegiatan: string; poin_target: number; urutan: number }>
): Promise<KegiatanItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kegiatan')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as KegiatanItem
}

/** Hapus kegiatan */
export async function deleteKegiatan(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('kegiatan').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Sub Kegiatan ─────────────────────────────────────────────────────────────

/** Tambah sub kegiatan baru */
export async function createSubKegiatan(input: {
  kegiatan_id: string
  nama_sub: string
  poin_target: number
}): Promise<SubKegiatanItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('sub_kegiatan')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as SubKegiatanItem
}

/** Update sub kegiatan */
export async function updateSubKegiatan(
  id: string,
  input: Partial<{ nama_sub: string; kegiatan_id: string; poin_target: number; urutan: number }>
): Promise<SubKegiatanItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('sub_kegiatan')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as SubKegiatanItem
}

/** Hapus sub kegiatan */
export async function deleteSubKegiatan(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('sub_kegiatan').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Kamar ────────────────────────────────────────────────────────────────────

/** Ambil semua kamar diurutkan by nama_kamar */
export async function getKamar(): Promise<KamarItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kamar')
    .select('id, nama_kamar, unit, musyrif_id')
    .order('nama_kamar', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as KamarItem[]
}

/** Ambil kamar yang diasuh musyrif tertentu */
export async function getKamarByMusyrif(musyrifId: string): Promise<KamarItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kamar')
    .select('id, nama_kamar, unit, musyrif_id')
    .eq('musyrif_id', musyrifId)
    .order('nama_kamar', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as KamarItem[]
}

/** Tambah kamar baru */
export async function createKamar(input: {
  nama_kamar: string
  unit: string | null
  musyrif_id?: string | null
}): Promise<KamarItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kamar')
    .insert(input)
    .select('id, nama_kamar, unit, musyrif_id')
    .single()

  if (error) throw new Error(error.message)

  return data as KamarItem
}

/** Update kamar */
export async function updateKamar(
  id: string,
  input: Partial<{ nama_kamar: string; unit: string | null; musyrif_id: string | null }>
): Promise<KamarItem> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kamar')
    .update(input)
    .eq('id', id)
    .select('id, nama_kamar, unit, musyrif_id')
    .single()

  if (error) throw new Error(error.message)

  return data as KamarItem
}

/** Hapus kamar */
export async function deleteKamar(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('kamar').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Siswa per Kamar ──────────────────────────────────────────────────────────

interface SiswaKamarRow {
  id: string
  nama: string
  kelas: string
  kamar: string | null
  unit: string | null
  is_alumni: boolean
}

/** Ambil siswa aktif berdasarkan nama kamar (disimpan sebagai text di students.kamar) */
export async function getSiswaByKamar(
  kamarNama: string,
  unit?: string
): Promise<SiswaKamarRow[]> {
  const supabase = createClient()

  let query = supabase
    .from('students')
    .select('id, nama, kelas, kamar, unit, is_alumni')
    .eq('kamar', kamarNama)
    .eq('is_alumni', false)
    .order('nama', { ascending: true })

  if (unit) {
    query = query.eq('unit', unit)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []) as SiswaKamarRow[]
}

// ─── Hari Libur ───────────────────────────────────────────────────────────────

/** Cek apakah tanggal tertentu adalah hari libur, dan kembalikan keterangan jika ada */
export async function isHariLibur(tanggal: string): Promise<boolean> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('hari_libur')
    .select('*', { count: 'exact', head: true })
    .eq('tanggal', tanggal)

  if (error) throw new Error(error.message)

  return (count ?? 0) > 0
}

/** Ambil info hari libur (isLibur + keterangan) untuk tanggal tertentu */
export async function getHariLiburInfo(tanggal: string): Promise<{ isLibur: boolean; keterangan: string | null }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('hari_libur')
    .select('keterangan')
    .eq('tanggal', tanggal)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return {
    isLibur: data !== null,
    keterangan: (data as { keterangan: string | null } | null)?.keterangan ?? null,
  }
}

/** Tandai tanggal sebagai hari libur */
export async function setHariLibur(tanggal: string, keterangan?: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('hari_libur')
    .upsert({ tanggal, keterangan: keterangan ?? null }, { onConflict: 'tanggal', ignoreDuplicates: true })

  if (error) throw new Error(error.message)
}

// ─── Mutabaah ─────────────────────────────────────────────────────────────────

/** Ambil data mutabaah berdasarkan tanggal dan nama kamar */
export async function getMutabaahByTanggalKamar(
  tanggal: string,
  kamarNama: string
): Promise<MutabaahEntry[]> {
  const supabase = createClient()

  // Ambil dulu siswa_ids di kamar tersebut
  const { data: siswaData, error: siswaError } = await supabase
    .from('students')
    .select('id')
    .eq('kamar', kamarNama)
    .eq('is_alumni', false)

  if (siswaError) throw new Error(siswaError.message)

  const siswaIds = (siswaData ?? []).map((s: { id: string }) => s.id)

  if (siswaIds.length === 0) return []

  const { data, error } = await supabase
    .from('mutabaah')
    .select(
      `
      *,
      students(nama, kelas),
      kegiatan(nama_kegiatan),
      sub_kegiatan(nama_sub)
      `
    )
    .in('siswa_id', siswaIds)
    .eq('tanggal', tanggal)

  if (error) throw new Error(error.message)

  return (data ?? []) as MutabaahEntry[]
}

/** Upsert data mutabaah (insert atau update jika sudah ada) */
export async function upsertMutabaah(
  entries: Omit<MutabaahEntry, 'id' | 'students' | 'kegiatan' | 'sub_kegiatan'>[]
): Promise<void> {
  if (entries.length === 0) return

  const supabase = createClient()

  const { error } = await supabase
    .from('mutabaah')
    .upsert(entries, {
      onConflict: 'siswa_id,kegiatan_id,sub_kegiatan_id,tanggal',
    })

  if (error) throw new Error(error.message)
}

/** Tandai semua kegiatan pada tanggal tertentu sebagai libur untuk semua siswa */
export async function setAllLiburOnDate(
  tanggal: string,
  siswaIds: string[],
  kegiatanIds: string[],
  musyrifId: string
): Promise<void> {
  if (siswaIds.length === 0 || kegiatanIds.length === 0) return

  const supabase = createClient()

  // Ambil sub_kegiatan untuk setiap kegiatan
  const { data: subKegiatanData, error: subError } = await supabase
    .from('sub_kegiatan')
    .select('id, kegiatan_id')
    .in('kegiatan_id', kegiatanIds)
    .order('urutan', { ascending: true })

  if (subError) throw new Error(subError.message)

  const subKegiatanRows = (subKegiatanData ?? []) as { id: string; kegiatan_id: string }[]

  const entries: Omit<MutabaahEntry, 'id' | 'students' | 'kegiatan' | 'sub_kegiatan'>[] = []

  for (const siswaId of siswaIds) {
    for (const kegiatanId of kegiatanIds) {
      // Ambil sub_kegiatan untuk kegiatan ini
      const subList = subKegiatanRows.filter((s) => s.kegiatan_id === kegiatanId)

      if (subList.length > 0) {
        // Jika ada sub_kegiatan, buat entry per sub
        for (const sub of subList) {
          entries.push({
            siswa_id: siswaId,
            kegiatan_id: kegiatanId,
            sub_kegiatan_id: sub.id,
            tanggal,
            status: 'L',
            is_libur: true,
            dicatat_oleh: musyrifId,
          })
        }
      } else {
        // Jika tidak ada sub_kegiatan, buat entry untuk kegiatan utama
        entries.push({
          siswa_id: siswaId,
          kegiatan_id: kegiatanId,
          sub_kegiatan_id: null,
          tanggal,
          status: 'L',
          is_libur: true,
          dicatat_oleh: musyrifId,
        })
      }
    }
  }

  await upsertMutabaah(entries)
}

// ─── Rekap Mutabaah ───────────────────────────────────────────────────────────

export interface MutabaahRekapItem {
  siswa_id: string
  nama: string
  kelas: string
  kegiatan_id: string
  nama_kegiatan: string
  sub_kegiatan_id: string | null
  nama_sub: string | null
  total_hadir: number
  total_izin: number
  total_sakit: number
  total_alpha: number
  total_terlambat: number
  total_libur: number
  total_hari: number
}

export interface MutabaahRekapOptions {
  siswaId?: string
  kamarNama?: string
  tanggalDari: string
  tanggalSampai: string
}

/** Ambil rekap mutabaah dalam range tanggal, dikelompokkan per siswa per kegiatan/sub */
export async function getMutabaahRekap(
  options: MutabaahRekapOptions
): Promise<MutabaahRekapItem[]> {
  const supabase = createClient()
  const { siswaId, kamarNama, tanggalDari, tanggalSampai } = options

  // Resolusi siswa_ids berdasarkan filter
  let siswaIds: string[] | null = null

  if (siswaId) {
    siswaIds = [siswaId]
  } else if (kamarNama) {
    const { data: siswaData, error: siswaError } = await supabase
      .from('students')
      .select('id')
      .eq('kamar', kamarNama)
      .eq('is_alumni', false)

    if (siswaError) throw new Error(siswaError.message)
    siswaIds = (siswaData ?? []).map((s: { id: string }) => s.id)
    if (siswaIds.length === 0) return []
  }

  let query = supabase
    .from('mutabaah')
    .select(
      `
      siswa_id,
      kegiatan_id,
      sub_kegiatan_id,
      status,
      is_libur,
      students(nama, kelas),
      kegiatan(nama_kegiatan),
      sub_kegiatan(nama_sub)
      `
    )
    .gte('tanggal', tanggalDari)
    .lte('tanggal', tanggalSampai)

  if (siswaIds) {
    query = query.in('siswa_id', siswaIds)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  // Group per siswa × kegiatan × sub_kegiatan
  const rekapMap = new Map<string, MutabaahRekapItem>()

  for (const row of data ?? []) {
    // Gunakan unknown untuk menghindari TypeScript overlap error pada relasi
    const rawRow = row as unknown as {
      siswa_id: string
      kegiatan_id: string
      sub_kegiatan_id: string | null
      status: MutabaahStatus
      is_libur: boolean
      students: { nama: string; kelas: string } | { nama: string; kelas: string }[] | null
      kegiatan: { nama_kegiatan: string } | { nama_kegiatan: string }[] | null
      sub_kegiatan: { nama_sub: string } | { nama_sub: string }[] | null
    }
    // Unwrap relasi (bisa berupa object tunggal atau array tergantung Supabase SDK)
    const studentsRaw = Array.isArray(rawRow.students) ? rawRow.students[0] ?? null : rawRow.students
    const kegiatanRaw = Array.isArray(rawRow.kegiatan) ? rawRow.kegiatan[0] ?? null : rawRow.kegiatan
    const subKegiatanRaw = Array.isArray(rawRow.sub_kegiatan) ? rawRow.sub_kegiatan[0] ?? null : rawRow.sub_kegiatan
    const r = {
      siswa_id: rawRow.siswa_id,
      kegiatan_id: rawRow.kegiatan_id,
      sub_kegiatan_id: rawRow.sub_kegiatan_id,
      status: rawRow.status,
      is_libur: rawRow.is_libur,
      students: studentsRaw as { nama: string; kelas: string } | null,
      kegiatan: kegiatanRaw as { nama_kegiatan: string } | null,
      sub_kegiatan: subKegiatanRaw as { nama_sub: string } | null,
    }

    const key = `${r.siswa_id}__${r.kegiatan_id}__${r.sub_kegiatan_id ?? 'null'}`

    if (!rekapMap.has(key)) {
      rekapMap.set(key, {
        siswa_id: r.siswa_id,
        nama: r.students?.nama ?? '',
        kelas: r.students?.kelas ?? '',
        kegiatan_id: r.kegiatan_id,
        nama_kegiatan: r.kegiatan?.nama_kegiatan ?? '',
        sub_kegiatan_id: r.sub_kegiatan_id,
        nama_sub: r.sub_kegiatan?.nama_sub ?? null,
        total_hadir: 0,
        total_izin: 0,
        total_sakit: 0,
        total_alpha: 0,
        total_terlambat: 0,
        total_libur: 0,
        total_hari: 0,
      })
    }

    const item = rekapMap.get(key)!
    item.total_hari++

    if (r.is_libur || r.status === 'L') {
      item.total_libur++
    } else if (r.status === 'Hadir') {
      item.total_hadir++
    } else if (r.status === 'Izin') {
      item.total_izin++
    } else if (r.status === 'Sakit') {
      item.total_sakit++
    } else if (r.status === 'Alpha') {
      item.total_alpha++
    } else if (r.status === 'Terlambat' || r.status === 'Terlambat Sekali') {
      item.total_terlambat++
    }
  }

  return Array.from(rekapMap.values()).sort((a, b) =>
    a.nama.localeCompare(b.nama)
  )
}

// ─── Target Mutabaah ─────────────────────────────────────────────────────────

/** Ambil target mutabaah berdasarkan kamar dan/atau semester */
export async function getTargetMutabaah(
  kamarId?: string,
  semesterId?: string
): Promise<TargetMutabaah[]> {
  const supabase = createClient()

  let query = supabase.from('target_mutabaah').select('*')

  if (kamarId) {
    query = query.eq('kamar_id', kamarId)
  }

  if (semesterId) {
    query = query.eq('semester_id', semesterId)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []) as TargetMutabaah[]
}

/** Insert atau update target mutabaah */
export async function upsertTargetMutabaah(
  input: Omit<TargetMutabaah, 'id'>
): Promise<TargetMutabaah> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('target_mutabaah')
    .upsert(input, {
      onConflict: 'kamar_id,kegiatan_id,sub_kegiatan_id,semester_id',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as TargetMutabaah
}

// ─── Progress & Nilai A-E ─────────────────────────────────────────────────────

export interface MutabaahProgressItem {
  kegiatan_id: string
  sub_kegiatan_id: string | null
  total_hadir: number
  target: number
  persentase: number
  nilai: NilaiMutabaah
}

/** Hitung nilai A-E berdasarkan persentase capaian */
function hitungNilai(persentase: number): NilaiMutabaah {
  if (persentase >= 90) return 'A'
  if (persentase >= 75) return 'B'
  if (persentase >= 60) return 'C'
  if (persentase >= 40) return 'D'
  return 'E'
}

/** Hitung progress mutabaah siswa dalam satu semester */
export async function getMutabaahProgress(
  siswaId: string,
  semesterId: string
): Promise<MutabaahProgressItem[]> {
  const supabase = createClient()

  // Ambil semester untuk mendapatkan tanggal_mulai dan tanggal_selesai
  const { data: semesterData, error: semesterError } = await supabase
    .from('semester')
    .select('tanggal_mulai, tanggal_selesai')
    .eq('id', semesterId)
    .single()

  if (semesterError) throw new Error(semesterError.message)

  const semester = semesterData as { tanggal_mulai: string; tanggal_selesai: string }

  // Ambil semua mutabaah siswa dalam semester ini
  const { data: mutabaahData, error: mutabaahError } = await supabase
    .from('mutabaah')
    .select('kegiatan_id, sub_kegiatan_id, status, is_libur')
    .eq('siswa_id', siswaId)
    .gte('tanggal', semester.tanggal_mulai)
    .lte('tanggal', semester.tanggal_selesai)

  if (mutabaahError) throw new Error(mutabaahError.message)

  // Ambil target mutabaah untuk siswa ini (berdasarkan kamar → semester)
  // Kita ambil semua target di semester ini, matching by kegiatan/sub
  const { data: targetData, error: targetError } = await supabase
    .from('target_mutabaah')
    .select('kegiatan_id, sub_kegiatan_id, target_jumlah')
    .eq('semester_id', semesterId)

  if (targetError) throw new Error(targetError.message)

  // Group total hadir per kegiatan × sub_kegiatan
  const hadirMap = new Map<string, number>()

  for (const row of mutabaahData ?? []) {
    const r = row as {
      kegiatan_id: string
      sub_kegiatan_id: string | null
      status: MutabaahStatus
      is_libur: boolean
    }

    // Hanya hitung Hadir (libur tidak dihitung)
    if (!r.is_libur && r.status === 'Hadir') {
      const key = `${r.kegiatan_id}__${r.sub_kegiatan_id ?? 'null'}`
      hadirMap.set(key, (hadirMap.get(key) ?? 0) + 1)
    }
  }

  // Hitung progress per kegiatan × sub_kegiatan
  const result: MutabaahProgressItem[] = []

  for (const target of targetData ?? []) {
    const t = target as {
      kegiatan_id: string
      sub_kegiatan_id: string | null
      target_jumlah: number
    }

    const key = `${t.kegiatan_id}__${t.sub_kegiatan_id ?? 'null'}`
    const totalHadir = hadirMap.get(key) ?? 0
    const persentase =
      t.target_jumlah > 0
        ? Math.min(100, Math.round((totalHadir / t.target_jumlah) * 100))
        : 0

    result.push({
      kegiatan_id: t.kegiatan_id,
      sub_kegiatan_id: t.sub_kegiatan_id,
      total_hadir: totalHadir,
      target: t.target_jumlah,
      persentase,
      nilai: hitungNilai(persentase),
    })
  }

  return result
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardMutabaahStats {
  totalSiswaAktif: number
  rataRataKehadiran: number
  totalHariDicatat: number
  hariLiburBulanIni: number
}

export interface KehadiranPerKegiatanItem {
  kegiatan_id: string
  nama_kegiatan: string
  total_hadir: number
  total_tercatat: number
  persentase: number
}

export interface TrendHarianItem {
  tanggal: string
  persentase_hadir: number
  total_siswa: number
  total_hadir: number
}

/**
 * Hitung statistik dashboard mutabaah untuk satu bulan tertentu.
 * bulan: format 'yyyy-MM'
 */
export async function getMutabaahDashboardStats(
  kamarNama?: string,
  bulan?: string
): Promise<DashboardMutabaahStats> {
  const supabase = createClient()

  const now = new Date()
  const targetBulan = bulan ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [yr, mo] = targetBulan.split('-').map(Number)
  const tglMulai = `${targetBulan}-01`
  const lastDay = new Date(yr, mo, 0).getDate()
  const tglSelesai = `${targetBulan}-${String(lastDay).padStart(2, '0')}`

  let siswaIds: string[]
  if (kamarNama) {
    const { data: siswaData, error: siswaErr } = await supabase
      .from('students')
      .select('id')
      .eq('kamar', kamarNama)
      .eq('is_alumni', false)

    if (siswaErr) throw new Error(siswaErr.message)
    siswaIds = (siswaData ?? []).map((s: { id: string }) => s.id)
  } else {
    const { data: allSiswa, error: allErr } = await supabase
      .from('students')
      .select('id')
      .eq('is_alumni', false)

    if (allErr) throw new Error(allErr.message)
    siswaIds = (allSiswa ?? []).map((s: { id: string }) => s.id)
  }

  const totalSiswaAktif = siswaIds.length

  const { count: hariLiburCount, error: liburErr } = await supabase
    .from('hari_libur')
    .select('*', { count: 'exact', head: true })
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglSelesai)

  if (liburErr) throw new Error(liburErr.message)
  const hariLiburBulanIni = hariLiburCount ?? 0

  if (siswaIds.length === 0) {
    return { totalSiswaAktif: 0, rataRataKehadiran: 0, totalHariDicatat: 0, hariLiburBulanIni }
  }

  let q = supabase
    .from('mutabaah')
    .select('tanggal, status, is_libur')
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglSelesai)
    .in('siswa_id', siswaIds)

  const { data: mutData, error: mutErr } = await q

  if (mutErr) throw new Error(mutErr.message)

  const rows = (mutData ?? []) as { tanggal: string; status: MutabaahStatus; is_libur: boolean }[]

  const hariSet = new Set(rows.map((r) => r.tanggal))
  const totalHariDicatat = hariSet.size

  const nonLibur = rows.filter((r) => !r.is_libur && r.status !== 'L')
  const totalHadir = nonLibur.filter((r) => r.status === 'Hadir').length
  const rataRataKehadiran = nonLibur.length > 0 ? Math.round((totalHadir / nonLibur.length) * 100) : 0

  return { totalSiswaAktif, rataRataKehadiran, totalHariDicatat, hariLiburBulanIni }
}

/**
 * Ambil total kehadiran per kegiatan dalam satu bulan (untuk BarChart top-N kegiatan).
 */
export async function getKehadiranPerKegiatan(
  kamarNama?: string,
  bulan?: string,
  topN = 5
): Promise<KehadiranPerKegiatanItem[]> {
  const supabase = createClient()

  const now = new Date()
  const targetBulan = bulan ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [yr, mo] = targetBulan.split('-').map(Number)
  const tglMulai = `${targetBulan}-01`
  const lastDay = new Date(yr, mo, 0).getDate()
  const tglSelesai = `${targetBulan}-${String(lastDay).padStart(2, '0')}`

  let siswaIds: string[] | null = null
  if (kamarNama) {
    const { data: siswaData, error: siswaErr } = await supabase
      .from('students')
      .select('id')
      .eq('kamar', kamarNama)
      .eq('is_alumni', false)

    if (siswaErr) throw new Error(siswaErr.message)
    siswaIds = (siswaData ?? []).map((s: { id: string }) => s.id)
    if (siswaIds.length === 0) return []
  }

  let q = supabase
    .from('mutabaah')
    .select('kegiatan_id, status, is_libur, kegiatan(nama_kegiatan)')
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglSelesai)

  if (siswaIds) q = q.in('siswa_id', siswaIds)

  const { data, error } = await q

  if (error) throw new Error(error.message)

  const map = new Map<string, { nama: string; hadir: number; total: number }>()

  for (const row of data ?? []) {
    const r = row as {
      kegiatan_id: string
      status: MutabaahStatus
      is_libur: boolean
      kegiatan: { nama_kegiatan: string } | { nama_kegiatan: string }[] | null
    }
    const kegiatanRaw = Array.isArray(r.kegiatan) ? r.kegiatan[0] ?? null : r.kegiatan
    const nama = (kegiatanRaw as { nama_kegiatan: string } | null)?.nama_kegiatan ?? ''
    const existing = map.get(r.kegiatan_id) ?? { nama, hadir: 0, total: 0 }
    if (!r.is_libur && r.status !== 'L') {
      existing.total++
      if (r.status === 'Hadir') existing.hadir++
    }
    map.set(r.kegiatan_id, existing)
  }

  return Array.from(map.entries())
    .map(([kegiatan_id, v]) => ({
      kegiatan_id,
      nama_kegiatan: v.nama,
      total_hadir: v.hadir,
      total_tercatat: v.total,
      persentase: v.total > 0 ? Math.round((v.hadir / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total_hadir - a.total_hadir)
    .slice(0, topN)
}

/**
 * Ambil tren kehadiran per hari dalam satu bulan (untuk LineChart).
 */
export async function getTrendKehadiranHarian(
  kamarNama?: string,
  bulan?: string
): Promise<TrendHarianItem[]> {
  const supabase = createClient()

  const now = new Date()
  const targetBulan = bulan ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [yr, mo] = targetBulan.split('-').map(Number)
  const tglMulai = `${targetBulan}-01`
  const lastDay = new Date(yr, mo, 0).getDate()
  const tglSelesai = `${targetBulan}-${String(lastDay).padStart(2, '0')}`

  let siswaIds: string[] | null = null
  if (kamarNama) {
    const { data: siswaData, error: siswaErr } = await supabase
      .from('students')
      .select('id')
      .eq('kamar', kamarNama)
      .eq('is_alumni', false)

    if (siswaErr) throw new Error(siswaErr.message)
    siswaIds = (siswaData ?? []).map((s: { id: string }) => s.id)
    if (siswaIds.length === 0) return []
  }

  let q = supabase
    .from('mutabaah')
    .select('tanggal, siswa_id, status, is_libur')
    .gte('tanggal', tglMulai)
    .lte('tanggal', tglSelesai)

  if (siswaIds) q = q.in('siswa_id', siswaIds)

  const { data, error } = await q

  if (error) throw new Error(error.message)

  const dayMap = new Map<string, { hadirSet: Set<string>; siswaSet: Set<string> }>()

  for (const row of data ?? []) {
    const r = row as { tanggal: string; siswa_id: string; status: MutabaahStatus; is_libur: boolean }
    const existing = dayMap.get(r.tanggal) ?? { hadirSet: new Set<string>(), siswaSet: new Set<string>() }
    if (!r.is_libur && r.status !== 'L') {
      existing.siswaSet.add(r.siswa_id)
      if (r.status === 'Hadir') existing.hadirSet.add(r.siswa_id)
    }
    dayMap.set(r.tanggal, existing)
  }

  return Array.from(dayMap.entries())
    .map(([tanggal, v]) => ({
      tanggal,
      total_siswa: v.siswaSet.size,
      total_hadir: v.hadirSet.size,
      persentase_hadir: v.siswaSet.size > 0 ? Math.round((v.hadirSet.size / v.siswaSet.size) * 100) : 0,
    }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
}

// ─── Rekap untuk Cetak ────────────────────────────────────────────────────────

export interface MutabaahCetakRow {
  tanggal: string
  kegiatan_id: string
  nama_kegiatan: string
  sub_kegiatan_id: string | null
  nama_sub: string | null
  status: MutabaahStatus
  is_libur: boolean
}

/**
 * Ambil data mutabaah satu siswa dalam range tanggal (untuk cetak laporan individual).
 */
export async function getMutabaahCetakSiswa(
  siswaId: string,
  tanggalDari: string,
  tanggalSampai: string
): Promise<MutabaahCetakRow[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('mutabaah')
    .select(`
      tanggal, kegiatan_id, sub_kegiatan_id, status, is_libur,
      kegiatan(nama_kegiatan),
      sub_kegiatan(nama_sub)
    `)
    .eq('siswa_id', siswaId)
    .gte('tanggal', tanggalDari)
    .lte('tanggal', tanggalSampai)
    .order('tanggal', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const r = row as {
      tanggal: string
      kegiatan_id: string
      sub_kegiatan_id: string | null
      status: MutabaahStatus
      is_libur: boolean
      kegiatan: { nama_kegiatan: string } | { nama_kegiatan: string }[] | null
      sub_kegiatan: { nama_sub: string } | { nama_sub: string }[] | null
    }
    const kegiatanRaw = Array.isArray(r.kegiatan) ? r.kegiatan[0] ?? null : r.kegiatan
    const subRaw = Array.isArray(r.sub_kegiatan) ? r.sub_kegiatan[0] ?? null : r.sub_kegiatan
    return {
      tanggal: r.tanggal,
      kegiatan_id: r.kegiatan_id,
      nama_kegiatan: (kegiatanRaw as { nama_kegiatan: string } | null)?.nama_kegiatan ?? '',
      sub_kegiatan_id: r.sub_kegiatan_id,
      nama_sub: (subRaw as { nama_sub: string } | null)?.nama_sub ?? null,
      status: r.status,
      is_libur: r.is_libur,
    }
  })
}
