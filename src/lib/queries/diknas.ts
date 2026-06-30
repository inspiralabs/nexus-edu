// src/lib/queries/diknas.ts
// Query functions untuk modul Akademik (DIKNAS) — Fase F

import { createClient } from '@/lib/supabase/client'
import type {
  BankSoal,
  CatatanKelakuan,
  MataPelajaran,
  NilaiHarian,
  NilaiUAS,
  Presensi,
  PresensiStatus,
  Role,
  Semester,
  TipeBankSoal,
  TipeCatatanKelakuan,
  TipeNilai,
  Unit,
} from '@/lib/supabase/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

/** @deprecated Gunakan MataPelajaran dari @/lib/supabase/types */
export type MataKuliah = MataPelajaran

export type SemesterOption = Semester

export interface PresensiEntry extends Presensi {
  students?: { nama: string; kelas: string; unit: string } | null
  mata_pelajaran?: { nama_mapel: string; unit: string } | null
  profiles?: { nama_lengkap: string } | null
}

export interface NilaiHarianEntry extends NilaiHarian {
  students?: { nama: string; kelas: string; unit: string } | null
  mata_pelajaran?: { nama_mapel: string } | null
  bank_soal?: { judul: string; tipe: string; tujuan_pembelajaran?: string | null } | null
  profiles?: { nama_lengkap: string } | null
  tipe_nilai_rel?: { nama_tipe: string; jenis_nilai: string } | null
}

export interface NilaiUASEntry extends NilaiUAS {
  students?: { nama: string; kelas: string; unit: string } | null
  mata_pelajaran?: { nama_mapel: string } | null
  bank_soal?: { judul: string; tipe: string; tujuan_pembelajaran?: string | null } | null
  profiles?: { nama_lengkap: string } | null
  tipe_nilai_rel?: { nama_tipe: string; jenis_nilai: string } | null
}

export interface BankSoalEntry extends BankSoal {
  mata_pelajaran?: { nama_mapel: string; unit: string } | null
  semester?: { nomor_semester: number; tahun_pelajaran?: { nama: string } } | null
  profiles?: { nama_lengkap: string } | null
  tipe_nilai?: { nama_tipe: string; jenis_nilai: string } | null
}

export interface CatatanKelakuanEntry extends CatatanKelakuan {
  students?: { nama: string; kelas: string; unit: string } | null
  profiles?: { nama_lengkap: string } | null
}

export interface RaportSiswa {
  id: string
  siswa_id: string
  nama: string
  kelas: string
  avg_formatif: number
  avg_sumatif: number
  nilai_uas: number | null
  nilai_rapor: number
}

export type DiknasDashboardFilters = {
  semesterId?: string
  unit?: string
  kelas?: string
  search?: string
  mapelId?: string
  siswaId?: string
  page?: number
  pageSize?: number
  isApproved?: boolean
  tipe?: string
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  tanggal?: string
}

// ─── Status Presensi ────────────────────────────────────────────────────────

export const PRESENSI_STATUS_OPTIONS = [
  'Hadir',
  'Izin',
  'Sakit',
  'Terlambat',
  'Terlambat Sekali',
  'Istihadhah',
  'Haid',
  'Alpha',
] as const satisfies readonly PresensiStatus[]

export type { PresensiStatus }

// ─── SELECT fragments (LEFT JOIN agar data orphan UUID tetap muncul) ───────────

const PRESENSI_SELECT =
  'id, siswa_id, mata_pelajaran_id, semester_id, tanggal, status, keterangan, dicatat_oleh, created_at, students!left(nama, kelas_id, unit, kelas(nama_kelas)), mata_pelajaran!left(nama_mapel, unit), profiles:dicatat_oleh!left(nama_lengkap)'

const NILAI_HARIAN_SELECT =
  'id, siswa_id, mata_pelajaran_id, semester_id, tipe_nilai, nama_tugas, materi, bab, nilai_asli, nilai_remedial, nilai_final, tipe_remedial, bank_soal_id, tipe_nilai_id, is_approved, approved_at, approved_by, dicatat_oleh, tanggal, created_at, students!left(nama, kelas_id, unit, kelas(nama_kelas)), mata_pelajaran!left(nama_mapel), bank_soal!left(judul, tipe, tujuan_pembelajaran), profiles:dicatat_oleh!left(nama_lengkap), tipe_nilai_rel:tipe_nilai!left(nama_tipe, jenis_nilai)'

const NILAI_UAS_SELECT =
  'id, siswa_id, mata_pelajaran_id, semester_id, nilai_asli, nilai_remedial, nilai_final, tipe_remedial, bank_soal_id, tipe_nilai_id, materi, bab, is_approved, approved_at, approved_by, dicatat_oleh, created_at, students!left(nama, kelas_id, unit, kelas(nama_kelas)), mata_pelajaran!left(nama_mapel), profiles:dicatat_oleh!left(nama_lengkap), bank_soal!left(judul, tipe, tujuan_pembelajaran), tipe_nilai_rel:tipe_nilai!left(nama_tipe, jenis_nilai)'

const BANK_SOAL_SELECT =
  'id, judul, tipe, mata_pelajaran_id, semester_id, konten, dibuat_oleh, tipe_nilai_id, materi, bab, tujuan_pembelajaran, created_at, mata_pelajaran!left(nama_mapel, unit), semester!left(nomor_semester, tahun_pelajaran(nama)), profiles:dibuat_oleh!left(nama_lengkap), tipe_nilai:tipe_nilai_id(nama_tipe, jenis_nilai)'

const CATATAN_KELAKUAN_SELECT =
  'id, siswa_id, semester_id, tipe, catatan, tanggal, dicatat_oleh, created_at, students!left(nama, kelas_id, unit, kelas(nama_kelas)), profiles:dicatat_oleh!left(nama_lengkap)'

// ─── Helpers: Relation unwrapping ─────────────────────────────────────────────

type Relation<T> = T | T[] | null | undefined

function unwrapRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
}

type StudentRelationRaw = { nama: string; kelas_id: string | null; unit: string; kelas?: any }

type PresensiRow = Presensi & {
  students?: Relation<StudentRelationRaw>
  mata_pelajaran?: Relation<{ nama_mapel: string; unit: string }>
  profiles?: Relation<{ nama_lengkap: string }>
}

type NilaiHarianRow = NilaiHarian & {
  students?: Relation<StudentRelationRaw>
  mata_pelajaran?: Relation<{ nama_mapel: string }>
  bank_soal?: Relation<{ judul: string; tipe: string; tujuan_pembelajaran?: string | null }>
  profiles?: Relation<{ nama_lengkap: string }>
  tipe_nilai_rel?: Relation<{ nama_tipe: string; jenis_nilai: string }>
}

type NilaiUASRow = NilaiUAS & {
  students?: Relation<StudentRelationRaw>
  mata_pelajaran?: Relation<{ nama_mapel: string }>
  profiles?: Relation<{ nama_lengkap: string }>
  bank_soal?: Relation<{ judul: string; tipe: string; tujuan_pembelajaran?: string | null }>
  tipe_nilai_rel?: Relation<{ nama_tipe: string; jenis_nilai: string }>
}

type BankSoalRow = BankSoal & {
  mata_pelajaran?: Relation<{ nama_mapel: string; unit: string }>
  semester?: Relation<{ nomor_semester: number; tahun_pelajaran?: { nama: string } }>
  profiles?: Relation<{ nama_lengkap: string }>
  tipe_nilai?: Relation<{ nama_tipe: string; jenis_nilai: string }>
}

type CatatanKelakuanRow = CatatanKelakuan & {
  students?: Relation<StudentRelationRaw>
  profiles?: Relation<{ nama_lengkap: string }>
}

function getNamaKelas(kelas: any): string {
  if (!kelas) return '-'
  if (Array.isArray(kelas)) {
    return kelas[0]?.nama_kelas || '-'
  }
  return kelas.nama_kelas || '-'
}

function mapPresensi(row: PresensiRow): PresensiEntry {
  const std = unwrapRelation(row.students)
  return {
    id: row.id,
    siswa_id: row.siswa_id,
    mata_pelajaran_id: row.mata_pelajaran_id,
    semester_id: row.semester_id,
    tanggal: row.tanggal,
    status: row.status,
    keterangan: row.keterangan,
    dicatat_oleh: row.dicatat_oleh,
    created_at: row.created_at,
    students: std
      ? {
          nama: std.nama,
          kelas: getNamaKelas(std.kelas),
          unit: std.unit,
        }
      : undefined,
    mata_pelajaran: unwrapRelation(row.mata_pelajaran) ?? undefined,
    profiles: unwrapRelation(row.profiles) ?? undefined,
  }
}

function mapNilaiHarian(row: NilaiHarianRow): NilaiHarianEntry {
  const std = unwrapRelation(row.students)
  return {
    id: row.id,
    siswa_id: row.siswa_id,
    mata_pelajaran_id: row.mata_pelajaran_id,
    semester_id: row.semester_id,
    tipe_nilai: row.tipe_nilai,
    nama_tugas: row.nama_tugas,
    materi: row.materi,
    bab: row.bab,
    nilai_asli: row.nilai_asli,
    nilai_remedial: row.nilai_remedial,
    nilai_final: row.nilai_final,
    tipe_remedial: row.tipe_remedial,
    bank_soal_id: row.bank_soal_id,
    tipe_nilai_id: row.tipe_nilai_id,
    is_approved: row.is_approved,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    dicatat_oleh: row.dicatat_oleh,
    tanggal: row.tanggal,
    created_at: row.created_at,
    students: std
      ? {
          nama: std.nama,
          kelas: getNamaKelas(std.kelas),
          unit: std.unit,
        }
      : undefined,
    mata_pelajaran: unwrapRelation(row.mata_pelajaran) ?? undefined,
    bank_soal: unwrapRelation(row.bank_soal) ?? undefined,
    profiles: unwrapRelation(row.profiles) ?? undefined,
    tipe_nilai_rel: unwrapRelation(row.tipe_nilai_rel) ?? undefined,
  }
}

function mapNilaiUAS(row: NilaiUASRow): NilaiUASEntry {
  const std = unwrapRelation(row.students)
  return {
    id: row.id,
    siswa_id: row.siswa_id,
    mata_pelajaran_id: row.mata_pelajaran_id,
    semester_id: row.semester_id,
    nilai_asli: row.nilai_asli,
    nilai_remedial: row.nilai_remedial,
    nilai_final: row.nilai_final,
    tipe_remedial: row.tipe_remedial,
    bank_soal_id: row.bank_soal_id,
    tipe_nilai_id: row.tipe_nilai_id,
    materi: row.materi,
    bab: row.bab,
    is_approved: row.is_approved,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    dicatat_oleh: row.dicatat_oleh,
    created_at: row.created_at,
    students: std
      ? {
          nama: std.nama,
          kelas: getNamaKelas(std.kelas),
          unit: std.unit,
        }
      : undefined,
    mata_pelajaran: unwrapRelation(row.mata_pelajaran) ?? undefined,
    bank_soal: unwrapRelation(row.bank_soal) ?? undefined,
    profiles: unwrapRelation(row.profiles) ?? undefined,
    tipe_nilai_rel: unwrapRelation(row.tipe_nilai_rel) ?? undefined,
  }
}

function mapBankSoal(row: unknown): BankSoalEntry {
  const r = row as BankSoalRow
  return {
    id: r.id,
    judul: r.judul,
    tipe: r.tipe,
    mata_pelajaran_id: r.mata_pelajaran_id,
    semester_id: r.semester_id,
    konten: r.konten,
    dibuat_oleh: r.dibuat_oleh,
    tipe_nilai_id: r.tipe_nilai_id,
    materi: r.materi,
    bab: r.bab,
    tujuan_pembelajaran: r.tujuan_pembelajaran,
    created_at: r.created_at,
    mata_pelajaran: unwrapRelation(r.mata_pelajaran) ?? undefined,
    semester: unwrapRelation(r.semester) ?? undefined,
    profiles: unwrapRelation(r.profiles) ?? undefined,
    tipe_nilai: unwrapRelation(r.tipe_nilai) ?? undefined,
  }
}

function mapCatatanKelakuan(row: CatatanKelakuanRow): CatatanKelakuanEntry {
  const std = unwrapRelation(row.students)
  return {
    id: row.id,
    siswa_id: row.siswa_id,
    semester_id: row.semester_id,
    tipe: row.tipe,
    catatan: row.catatan,
    tanggal: row.tanggal,
    dicatat_oleh: row.dicatat_oleh,
    created_at: row.created_at,
    students: std
      ? {
          nama: std.nama,
          kelas: getNamaKelas(std.kelas),
          unit: std.unit,
        }
      : undefined,
    profiles: unwrapRelation(row.profiles) ?? undefined,
  }
}

// ─── Helper Security: mapel access check ──────────────────────────────────────

export interface GuruMapelAccessStatus {
  role: Role | null
  isGuru: boolean
  isAdmin: boolean
  mapelIds: string[]
  /** true jika guru punya minimal 1 mapel valid di tabel mata_pelajaran */
  hasMapelConfigured: boolean
}

async function resolveMapelAccess(): Promise<GuruMapelAccessStatus> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const empty: GuruMapelAccessStatus = {
    role: null,
    isGuru: false,
    isAdmin: false,
    mapelIds: [],
    hasMapelConfigured: false,
  }

  if (!user) return empty

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, mapel_ids')
    .eq('user_id', user.id)
    .single()

  if (error || !profile) return empty

  const role = profile.role as Role

  if (role === 'admin' || role === 'superadmin') {
    const { data: allMapel, error: mapelError } = await supabase
      .from('mata_pelajaran')
      .select('id')

    if (mapelError) throw new Error(mapelError.message)

    const mapelIds = (allMapel ?? []).map((m: { id: string }) => m.id)
    return {
      role,
      isGuru: false,
      isAdmin: true,
      mapelIds,
      hasMapelConfigured: true,
    }
  }

  if (role !== 'user') {
    return { role, isGuru: false, isAdmin: false, mapelIds: [], hasMapelConfigured: false }
  }

  const rawIds = (profile.mapel_ids as string[] | null) ?? []
  if (rawIds.length === 0) {
    return {
      role,
      isGuru: true,
      isAdmin: false,
      mapelIds: [],
      hasMapelConfigured: false,
    }
  }

  const { data: validMapel, error: validError } = await supabase
    .from('mata_pelajaran')
    .select('id')
    .in('id', rawIds)

  if (validError) throw new Error(validError.message)

  const mapelIds = (validMapel ?? []).map((m: { id: string }) => m.id)
  return {
    role,
    isGuru: true,
    isAdmin: false,
    mapelIds,
    hasMapelConfigured: mapelIds.length > 0,
  }
}

/** Dipakai halaman DIKNAS untuk empty state guru tanpa mapel. */
export async function getGuruMapelAccessStatus(): Promise<GuruMapelAccessStatus> {
  return resolveMapelAccess()
}

function assertGuruMapelWriteAccess(
  access: GuruMapelAccessStatus,
  mataPelajaranId: string
): void {
  if (!access.isGuru) return

  if (!access.hasMapelConfigured) {
    throw new Error(
      'Mata pelajaran belum dikonfigurasi. Hubungi Admin untuk mengatur mata pelajaran Anda.'
    )
  }

  if (!access.mapelIds.includes(mataPelajaranId)) {
    throw new Error('Akses ditolak: Anda tidak memiliki akses ke mata pelajaran ini')
  }
}

// ─── Helper: ambil siswa sesuai filter ────────────────────────────────────────

async function getSiswaIds(
  unit?: string,
  kelas?: string,
  search?: string
): Promise<string[] | null> {
  const hasFilter = Boolean(unit || kelas || search)
  if (!hasFilter) return null

  const supabase = createClient()
  let q = supabase.from('students').select('id').eq('is_alumni', false)

  if (unit) q = q.eq('unit', unit)
  
  if (kelas) {
    let kelasIdFilter: string | null = null
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kelas)
    if (!isUuid) {
      let query = supabase.from('kelas').select('id').eq('nama_kelas', kelas)
      if (unit) {
        query = query.eq('unit', unit)
      }
      const { data: kelasRow } = await query.maybeSingle()
      if (kelasRow) {
        kelasIdFilter = kelasRow.id
      }
    } else {
      kelasIdFilter = kelas
    }
    if (kelasIdFilter) {
      q = q.eq('kelas_id', kelasIdFilter)
    } else {
      return []
    }
  }

  if (search) q = q.ilike('nama', `%${search}%`)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: { id: string }) => r.id)
}

// ─── Mata Pelajaran ────────────────────────────────────────────────────────────

export async function getMataKuliah(unit?: string): Promise<MataKuliah[]> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && !access.hasMapelConfigured) {
    return []
  }

  let query = supabase
    .from('mata_pelajaran')
    .select('*')
    .order('nama_mapel', { ascending: true })

  if (unit) {
    query = query.eq('unit', unit)
  }

  if (access.isGuru && access.mapelIds.length > 0) {
    query = query.in('id', access.mapelIds)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []) as MataKuliah[]
}

// ─── Semester ──────────────────────────────────────────────────────────────────

export async function getActiveSemesterDiknas(): Promise<SemesterOption | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('semester')
    .select('*, tahun_pelajaran(*)')
    .eq('is_aktif', true)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return data as SemesterOption | null
}

export async function getSemesterOptions(): Promise<SemesterOption[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('semester')
    .select('*, tahun_pelajaran(*)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []) as SemesterOption[]
}

// ─── Presensi ─────────────────────────────────────────────────────────────────

export async function getPresensi(
  filters: DiknasDashboardFilters
): Promise<{ data: PresensiEntry[]; total: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const access = await resolveMapelAccess()
  if (access.isGuru && !access.hasMapelConfigured) {
    return { data: [], total: 0 }
  }

  const siswaIds = filters.siswaId
    ? [filters.siswaId]
    : await getSiswaIds(filters.unit, filters.kelas, filters.search)

  if (siswaIds && siswaIds.length === 0) {
    return { data: [], total: 0 }
  }

  let countQ = supabase
    .from('presensi')
    .select('*', { count: 'exact', head: true })

  if (siswaIds) countQ = countQ.in('siswa_id', siswaIds)
  if (filters.semesterId) countQ = countQ.eq('semester_id', filters.semesterId)
  if (filters.mapelId) countQ = countQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.tanggal) countQ = countQ.eq('tanggal', filters.tanggal)
  
  if (access.isGuru && access.mapelIds.length > 0) {
    countQ = countQ.in('mata_pelajaran_id', access.mapelIds)
  }

  const { count, error: countError } = await countQ
  if (countError) throw new Error(countError.message)

  let dataQ = supabase
    .from('presensi')
    .select(PRESENSI_SELECT)

  if (siswaIds) dataQ = dataQ.in('siswa_id', siswaIds)
  if (filters.semesterId) dataQ = dataQ.eq('semester_id', filters.semesterId)
  if (filters.mapelId) dataQ = dataQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.tanggal) dataQ = dataQ.eq('tanggal', filters.tanggal)

  if (access.isGuru && access.mapelIds.length > 0) {
    dataQ = dataQ.in('mata_pelajaran_id', access.mapelIds)
  }

  const sortBy = filters.sortField || 'tanggal'
  const ascending = filters.sortDirection !== 'desc'

  if (['tanggal', 'status', 'keterangan'].includes(sortBy)) {
    dataQ = dataQ.order(sortBy, { ascending })
  } else if (sortBy === 'nama' || sortBy === 'kelas') {
    dataQ = dataQ.order('siswa_id', { ascending })
  } else if (sortBy === 'mapel') {
    dataQ = dataQ.order('mata_pelajaran_id', { ascending })
  } else {
    dataQ = dataQ.order('tanggal', { ascending: false })
  }

  dataQ = dataQ.range(from, to)

  const { data, error } = await dataQ
  if (error) throw new Error(error.message)

  return { data: (data ?? []).map(mapPresensi), total: count ?? 0 }
}

export async function createPresensi(data: {
  siswa_id: string
  mata_pelajaran_id: string
  semester_id: string | null
  tanggal: string
  status: string
  keterangan?: string | null
  dicatat_oleh?: string | null
}): Promise<PresensiEntry> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  assertGuruMapelWriteAccess(access, data.mata_pelajaran_id)

  const { data: result, error } = await supabase
    .from('presensi')
    .insert(data)
    .select(PRESENSI_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapPresensi(result)
}

export async function updatePresensi(
  id: string,
  data: Partial<{
    tanggal: string
    status: string
    keterangan: string | null
    mata_pelajaran_id: string
    semester_id: string | null
  }>
): Promise<PresensiEntry> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('presensi')
      .select('mata_pelajaran_id')
      .eq('id', id)
      .single()
    if (existing && !access.mapelIds.includes(existing.mata_pelajaran_id)) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke data presensi ini')
    }
    if (data.mata_pelajaran_id && !access.mapelIds.includes(data.mata_pelajaran_id)) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke mata pelajaran baru ini')
    }
  }

  const { data: result, error } = await supabase
    .from('presensi')
    .update(data)
    .eq('id', id)
    .select(PRESENSI_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapPresensi(result)
}

export async function deletePresensi(ids: string[]): Promise<void> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('presensi')
      .select('mata_pelajaran_id')
      .in('id', ids)
    if (existing) {
      for (const row of existing) {
        if (!access.mapelIds.includes(row.mata_pelajaran_id)) {
          throw new Error('Akses ditolak: Anda tidak memiliki akses untuk menghapus data presensi ini')
        }
      }
    }
  }

  const { error } = await supabase.from('presensi').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

export async function bulkCreatePresensi(
  data: {
    siswa_id: string
    mata_pelajaran_id: string
    semester_id: string | null
    tanggal: string
    status: string
    keterangan?: string | null
    dicatat_oleh?: string | null
  }[]
): Promise<PresensiEntry[]> {
  if (data.length === 0) return []

  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    for (const item of data) {
      if (!access.mapelIds.includes(item.mata_pelajaran_id)) {
        throw new Error('Akses ditolak: Anda tidak memiliki akses ke mata pelajaran ini')
      }
    }
  } else if (access.isGuru && !access.hasMapelConfigured) {
    throw new Error(
      'Mata pelajaran belum dikonfigurasi. Hubungi Admin untuk mengatur mata pelajaran Anda.'
    )
  }

  const siswaIds = data.map((d) => d.siswa_id)
  const tanggal = data[0].tanggal
  const mataPelajaranId = data[0].mata_pelajaran_id

  // 1. Ambil data presensi yang sudah ada pada tanggal & mapel & daftar siswa tersebut
  const { data: existing, error: fetchError } = await supabase
    .from('presensi')
    .select('id, siswa_id')
    .eq('tanggal', tanggal)
    .eq('mata_pelajaran_id', mataPelajaranId)
    .in('siswa_id', siswaIds)

  if (fetchError) throw new Error(fetchError.message)

  const existingMap = new Map<string, string>()
  existing?.forEach((r) => existingMap.set(r.siswa_id, r.id))

  interface PresensiPayload {
    siswa_id: string
    mata_pelajaran_id: string
    semester_id: string | null
    tanggal: string
    status: PresensiStatus
    keterangan: string | null
    dicatat_oleh: string | null
  }

  const toInsert: PresensiPayload[] = []
  const toUpdate: { id: string; payload: PresensiPayload }[] = []

  for (const item of data) {
    const existingId = existingMap.get(item.siswa_id)
    const payload: PresensiPayload = {
      siswa_id: item.siswa_id,
      mata_pelajaran_id: item.mata_pelajaran_id,
      semester_id: item.semester_id,
      tanggal: item.tanggal,
      status: item.status as PresensiStatus,
      keterangan: item.keterangan || null,
      dicatat_oleh: item.dicatat_oleh || null,
    }

    if (existingId) {
      toUpdate.push({ id: existingId, payload })
    } else {
      toInsert.push(payload)
    }
  }

  type PresensiBatchResult = { data: PresensiRow | PresensiRow[] | null; error: Error | null }

  const promises: Promise<PresensiBatchResult>[] = []

  let insertPromiseIdx = -1
  if (toInsert.length > 0) {
    insertPromiseIdx = promises.length
    promises.push(
      Promise.resolve(
        supabase
          .from('presensi')
          .insert(toInsert)
          .select(PRESENSI_SELECT)
      )
    )
  }

  const updatePromiseStartIdx = promises.length
  for (const item of toUpdate) {
    promises.push(
      Promise.resolve(
        supabase
          .from('presensi')
          .update(item.payload)
          .eq('id', item.id)
          .select(PRESENSI_SELECT)
          .single()
      )
    )
  }

  const results = await Promise.all(promises)

  for (const res of results) {
    if (res.error) throw new Error(res.error.message)
  }

  const finalRecords: PresensiRow[] = []

  if (insertPromiseIdx !== -1) {
    const insertRes = results[insertPromiseIdx]
    if (insertRes.data) {
      const rows = Array.isArray(insertRes.data) ? insertRes.data : [insertRes.data]
      finalRecords.push(...rows)
    }
  }

  for (let i = updatePromiseStartIdx; i < results.length; i++) {
    const updateRes = results[i]
    if (updateRes.data) {
      const row = Array.isArray(updateRes.data) ? updateRes.data[0] : updateRes.data
      if (row) finalRecords.push(row)
    }
  }

  return finalRecords.map(mapPresensi)
}

// ─── Nilai Harian ─────────────────────────────────────────────────────────────

export async function getNilaiHarian(
  filters: DiknasDashboardFilters & { isApproved?: boolean }
): Promise<{ data: NilaiHarianEntry[]; total: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const access = await resolveMapelAccess()
  if (access.isGuru && !access.hasMapelConfigured) {
    return { data: [], total: 0 }
  }

  const siswaIds = filters.siswaId
    ? [filters.siswaId]
    : await getSiswaIds(filters.unit, filters.kelas, filters.search)

  if (siswaIds && siswaIds.length === 0) {
    return { data: [], total: 0 }
  }

  let countQ = supabase
    .from('nilai_harian')
    .select('*', { count: 'exact', head: true })

  if (siswaIds) countQ = countQ.in('siswa_id', siswaIds)
  if (filters.semesterId) countQ = countQ.eq('semester_id', filters.semesterId)
  if (filters.mapelId) countQ = countQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.isApproved !== undefined) {
    countQ = countQ.eq('is_approved', filters.isApproved)
  }

  if (access.isGuru && access.mapelIds.length > 0) {
    countQ = countQ.in('mata_pelajaran_id', access.mapelIds)
  }

  const { count, error: countError } = await countQ
  if (countError) throw new Error(countError.message)

  let dataQ = supabase
    .from('nilai_harian')
    .select(NILAI_HARIAN_SELECT)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (siswaIds) dataQ = dataQ.in('siswa_id', siswaIds)
  if (filters.semesterId) dataQ = dataQ.eq('semester_id', filters.semesterId)
  if (filters.mapelId) dataQ = dataQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.isApproved !== undefined) {
    dataQ = dataQ.eq('is_approved', filters.isApproved)
  }

  if (access.isGuru && access.mapelIds.length > 0) {
    dataQ = dataQ.in('mata_pelajaran_id', access.mapelIds)
  }

  const { data, error } = await dataQ
  if (error) throw new Error(error.message)

  return { data: (data ?? []).map(mapNilaiHarian), total: count ?? 0 }
}

export async function createNilaiHarian(data: {
  siswa_id: string
  mata_pelajaran_id: string
  semester_id: string | null
  tipe_nilai: 'Formatif' | 'Sumatif'
  nama_tugas: string
  materi?: string | null
  bab?: string[] | null
  nilai_asli?: number | null
  nilai_remedial?: number | null
  tipe_remedial?: string | null
  bank_soal_id?: string | null
  tipe_nilai_id?: string | null
  dicatat_oleh?: string | null
  tanggal?: string | null
}): Promise<NilaiHarianEntry> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  assertGuruMapelWriteAccess(access, data.mata_pelajaran_id)

  let tipeNilai = data.tipe_nilai
  if (data.tipe_nilai_id) {
    const { data: tipeObj } = await supabase
      .from('tipe_nilai')
      .select('jenis_nilai')
      .eq('id', data.tipe_nilai_id)
      .single()
    if (tipeObj) {
      tipeNilai = tipeObj.jenis_nilai === 'Harian' ? 'Formatif' : 'Sumatif'
    }
  }

  const { data: result, error } = await supabase
    .from('nilai_harian')
    .insert({ ...data, tipe_nilai: tipeNilai })
    .select(NILAI_HARIAN_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapNilaiHarian(result)
}

export async function updateNilaiHarian(
  id: string,
  data: Partial<{
    tipe_nilai: 'Formatif' | 'Sumatif'
    tipe_nilai_id: string | null
    nama_tugas: string
    materi: string | null
    bab: string[] | null
    nilai_asli: number | null
    nilai_remedial: number | null
    tipe_remedial: string | null
    bank_soal_id: string | null
    tanggal: string | null
    is_approved: boolean
    approved_at: string | null
    approved_by: string | null
    mata_pelajaran_id?: string | null
  }>
): Promise<NilaiHarianEntry> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('nilai_harian')
      .select('mata_pelajaran_id')
      .eq('id', id)
      .single()
    if (existing && !access.mapelIds.includes(existing.mata_pelajaran_id)) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke data nilai ini')
    }
    if (data.mata_pelajaran_id && !access.mapelIds.includes(data.mata_pelajaran_id)) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke mata pelajaran baru ini')
    }
  }

  let updatedData = { ...data }
  if (data.tipe_nilai_id) {
    const { data: tipeObj } = await supabase
      .from('tipe_nilai')
      .select('jenis_nilai')
      .eq('id', data.tipe_nilai_id)
      .single()
    if (tipeObj) {
      updatedData.tipe_nilai = tipeObj.jenis_nilai === 'Harian' ? 'Formatif' : 'Sumatif'
    }
  }

  const { data: result, error } = await supabase
    .from('nilai_harian')
    .update(updatedData)
    .eq('id', id)
    .select(NILAI_HARIAN_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapNilaiHarian(result)
}

export async function deleteNilaiHarian(ids: string[]): Promise<void> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('nilai_harian')
      .select('mata_pelajaran_id')
      .in('id', ids)
    if (existing) {
      for (const row of existing) {
        if (!access.mapelIds.includes(row.mata_pelajaran_id)) {
          throw new Error('Akses ditolak: Anda tidak memiliki akses untuk menghapus data nilai ini')
        }
      }
    }
  }

  const { error } = await supabase.from('nilai_harian').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

export async function approveNilaiHarian(
  ids: string[],
  approvedBy: string
): Promise<void> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('nilai_harian')
      .select('mata_pelajaran_id')
      .in('id', ids)
    if (existing) {
      for (const row of existing) {
        if (!access.mapelIds.includes(row.mata_pelajaran_id)) {
          throw new Error('Akses ditolak: Anda tidak memiliki akses untuk menyetujui data nilai ini')
        }
      }
    }
  }

  const { error } = await supabase
    .from('nilai_harian')
    .update({
      is_approved: true,
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .in('id', ids)

  if (error) throw new Error(error.message)
}

export async function bulkCreateNilaiHarian(
  data: {
    siswa_id: string
    mata_pelajaran_id: string
    semester_id: string | null
    tipe_nilai: 'Formatif' | 'Sumatif'
    nama_tugas: string
    materi?: string | null
    bab?: string[] | null
    nilai_asli?: number | null
    nilai_remedial?: number | null
    tipe_remedial?: string | null
    bank_soal_id?: string | null
    tipe_nilai_id?: string | null
    dicatat_oleh?: string | null
    tanggal?: string | null
  }[]
): Promise<NilaiHarianEntry[]> {
  if (data.length === 0) return []
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    for (const item of data) {
      if (!access.mapelIds.includes(item.mata_pelajaran_id)) {
        throw new Error('Akses ditolak: Anda tidak memiliki akses ke mata pelajaran ini')
      }
    }
  } else if (access.isGuru && !access.hasMapelConfigured) {
    throw new Error(
      'Mata pelajaran belum dikonfigurasi. Hubungi Admin untuk mengatur mata pelajaran Anda.'
    )
  }

  const finalData = [...data]
  const tipeNilaiIds = Array.from(new Set(data.map((item) => item.tipe_nilai_id).filter(Boolean))) as string[]
  if (tipeNilaiIds.length > 0) {
    const { data: tipeList } = await supabase
      .from('tipe_nilai')
      .select('id, jenis_nilai')
      .in('id', tipeNilaiIds)
    if (tipeList && tipeList.length > 0) {
      const tipeMap = new Map(tipeList.map((t) => [t.id, t.jenis_nilai]))
      for (const item of finalData) {
        if (item.tipe_nilai_id) {
          const jenis = tipeMap.get(item.tipe_nilai_id)
          if (jenis) {
            item.tipe_nilai = jenis === 'Harian' ? 'Formatif' : 'Sumatif'
          }
        }
      }
    }
  }

  const { data: results, error } = await supabase
    .from('nilai_harian')
    .insert(finalData)
    .select(NILAI_HARIAN_SELECT)

  if (error) throw new Error(error.message)
  return (results ?? []).map(mapNilaiHarian)
}

// ─── Nilai UAS ────────────────────────────────────────────────────────────────

export async function getNilaiUAS(
  filters: DiknasDashboardFilters & { isApproved?: boolean }
): Promise<{ data: NilaiUASEntry[]; total: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const access = await resolveMapelAccess()
  if (access.isGuru && !access.hasMapelConfigured) {
    return { data: [], total: 0 }
  }

  const siswaIds = filters.siswaId
    ? [filters.siswaId]
    : await getSiswaIds(filters.unit, filters.kelas, filters.search)

  if (siswaIds && siswaIds.length === 0) {
    return { data: [], total: 0 }
  }

  let countQ = supabase
    .from('nilai_uas')
    .select('*', { count: 'exact', head: true })

  if (siswaIds) countQ = countQ.in('siswa_id', siswaIds)
  if (filters.semesterId) countQ = countQ.eq('semester_id', filters.semesterId)
  if (filters.mapelId) countQ = countQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.isApproved !== undefined) {
    countQ = countQ.eq('is_approved', filters.isApproved)
  }

  if (access.isGuru && access.mapelIds.length > 0) {
    countQ = countQ.in('mata_pelajaran_id', access.mapelIds)
  }

  const { count, error: countError } = await countQ
  if (countError) throw new Error(countError.message)

  let dataQ = supabase
    .from('nilai_uas')
    .select(NILAI_UAS_SELECT)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (siswaIds) dataQ = dataQ.in('siswa_id', siswaIds)
  if (filters.semesterId) dataQ = dataQ.eq('semester_id', filters.semesterId)
  if (filters.mapelId) dataQ = dataQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.isApproved !== undefined) {
    dataQ = dataQ.eq('is_approved', filters.isApproved)
  }

  if (access.isGuru && access.mapelIds.length > 0) {
    dataQ = dataQ.in('mata_pelajaran_id', access.mapelIds)
  }

  const { data, error } = await dataQ
  if (error) throw new Error(error.message)

  return { data: (data ?? []).map(mapNilaiUAS), total: count ?? 0 }
}

export async function createNilaiUAS(data: {
  siswa_id: string
  mata_pelajaran_id: string
  semester_id: string | null
  nilai_asli?: number | null
  nilai_remedial?: number | null
  tipe_remedial?: string | null
  bank_soal_id?: string | null
  tipe_nilai_id?: string | null
  materi?: string | null
  bab?: string[] | null
  dicatat_oleh?: string | null
}): Promise<NilaiUASEntry> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  assertGuruMapelWriteAccess(access, data.mata_pelajaran_id)

  const { data: result, error } = await supabase
    .from('nilai_uas')
    .insert(data)
    .select(NILAI_UAS_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapNilaiUAS(result)
}

export async function updateNilaiUAS(
  id: string,
  data: Partial<{
    nilai_asli: number | null
    nilai_remedial: number | null
    tipe_remedial: string | null
    bank_soal_id: string | null
    tipe_nilai_id: string | null
    materi: string | null
    bab: string[] | null
    is_approved: boolean
    approved_at: string | null
    approved_by: string | null
    mata_pelajaran_id?: string | null
  }>
): Promise<NilaiUASEntry> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('nilai_uas')
      .select('mata_pelajaran_id')
      .eq('id', id)
      .single()
    if (existing && !access.mapelIds.includes(existing.mata_pelajaran_id)) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke data nilai UAS ini')
    }
    if (data.mata_pelajaran_id && !access.mapelIds.includes(data.mata_pelajaran_id)) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke mata pelajaran baru ini')
    }
  }

  const { data: result, error } = await supabase
    .from('nilai_uas')
    .update(data)
    .eq('id', id)
    .select(NILAI_UAS_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapNilaiUAS(result)
}

export async function deleteNilaiUAS(ids: string[]): Promise<void> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('nilai_uas')
      .select('mata_pelajaran_id')
      .in('id', ids)
    if (existing) {
      for (const row of existing) {
        if (!access.mapelIds.includes(row.mata_pelajaran_id)) {
          throw new Error('Akses ditolak: Anda tidak memiliki akses untuk menghapus data nilai UAS ini')
        }
      }
    }
  }

  const { error } = await supabase.from('nilai_uas').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

export async function approveNilaiUAS(
  ids: string[],
  approvedBy: string
): Promise<void> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('nilai_uas')
      .select('mata_pelajaran_id')
      .in('id', ids)
    if (existing) {
      for (const row of existing) {
        if (!access.mapelIds.includes(row.mata_pelajaran_id)) {
          throw new Error('Akses ditolak: Anda tidak memiliki akses untuk menyetujui data nilai UAS ini')
        }
      }
    }
  }

  const { error } = await supabase
    .from('nilai_uas')
    .update({
      is_approved: true,
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .in('id', ids)

  if (error) throw new Error(error.message)
}
export async function bulkCreateNilaiUAS(
  data: {
    siswa_id: string
    mata_pelajaran_id: string
    semester_id: string | null
    nilai_asli?: number | null
    nilai_remedial?: number | null
    tipe_remedial?: string | null
    bank_soal_id?: string | null
    tipe_nilai_id?: string | null
    materi?: string | null
    bab?: string[] | null
    dicatat_oleh?: string | null
  }[]
): Promise<NilaiUASEntry[]> {
  if (data.length === 0) return []
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    for (const item of data) {
      if (!access.mapelIds.includes(item.mata_pelajaran_id)) {
        throw new Error('Akses ditolak: Anda tidak memiliki akses ke mata pelajaran ini')
      }
    }
  } else if (access.isGuru && !access.hasMapelConfigured) {
    throw new Error(
      'Mata pelajaran belum dikonfigurasi. Hubungi Admin untuk mengatur mata pelajaran Anda.'
    )
  }

  const siswaIds = data.map((d) => d.siswa_id)
  const mapelId = data[0].mata_pelajaran_id
  const semesterId = data[0].semester_id

  const { data: existing, error: fetchError } = await supabase
    .from('nilai_uas')
    .select('id, siswa_id')
    .eq('mata_pelajaran_id', mapelId)
    .eq('semester_id', semesterId)
    .in('siswa_id', siswaIds)

  if (fetchError) throw new Error(fetchError.message)

  const existingMap = new Map<string, string>()
  existing?.forEach((r) => existingMap.set(r.siswa_id, r.id))

  interface NilaiUASPayload {
    siswa_id: string
    mata_pelajaran_id: string
    semester_id: string | null
    nilai_asli: number | null | undefined
    nilai_remedial: number | null
    tipe_remedial: string | null
    bank_soal_id: string | null
    tipe_nilai_id: string | null
    materi: string | null
    bab: string[] | null
    dicatat_oleh: string | null | undefined
  }

  const toInsert: NilaiUASPayload[] = []
  const toUpdate: { id: string; payload: NilaiUASPayload }[] = []

  for (const item of data) {
    const existingId = existingMap.get(item.siswa_id)
    const payload = {
      siswa_id: item.siswa_id,
      mata_pelajaran_id: item.mata_pelajaran_id,
      semester_id: item.semester_id,
      nilai_asli: item.nilai_asli,
      nilai_remedial: item.nilai_remedial || null,
      tipe_remedial: item.tipe_remedial || null,
      bank_soal_id: item.bank_soal_id || null,
      tipe_nilai_id: item.tipe_nilai_id || null,
      materi: item.materi || null,
      bab: item.bab || null,
      dicatat_oleh: item.dicatat_oleh
    }

    if (existingId) {
      toUpdate.push({ id: existingId, payload })
    } else {
      toInsert.push(payload)
    }
  }

  type NilaiUASBatchResult = { data: NilaiUASRow | NilaiUASRow[] | null; error: Error | null }

  const promises: Promise<NilaiUASBatchResult>[] = []
  let insertPromiseIdx = -1
  if (toInsert.length > 0) {
    insertPromiseIdx = promises.length
    promises.push(
      Promise.resolve(
        supabase.from('nilai_uas').insert(toInsert).select(NILAI_UAS_SELECT)
      )
    )
  }

  const updatePromiseStartIdx = promises.length
  for (const item of toUpdate) {
    promises.push(
      Promise.resolve(
        supabase.from('nilai_uas').update(item.payload).eq('id', item.id).select(NILAI_UAS_SELECT).single()
      )
    )
  }

  const results = await Promise.all(promises)
  for (const res of results) {
    if (res.error) throw new Error(res.error.message)
  }

  const finalRecords: NilaiUASRow[] = []
  if (insertPromiseIdx !== -1) {
    const insertRes = results[insertPromiseIdx]
    if (insertRes.data) {
      const rows = Array.isArray(insertRes.data) ? insertRes.data : [insertRes.data]
      finalRecords.push(...rows)
    }
  }
  for (let i = updatePromiseStartIdx; i < results.length; i++) {
    const updateRes = results[i]
    if (updateRes.data) {
      const row = Array.isArray(updateRes.data) ? updateRes.data[0] : updateRes.data
      if (row) finalRecords.push(row)
    }
  }

  return finalRecords.map(mapNilaiUAS)
}

// ─── Bank Soal ────────────────────────────────────────────────────────────────

export async function getBankSoal(
  filters: DiknasDashboardFilters
): Promise<{ data: BankSoalEntry[]; total: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const access = await resolveMapelAccess()
  if (access.isGuru && !access.hasMapelConfigured) {
    return { data: [], total: 0 }
  }

  let countQ = supabase
    .from('bank_soal')
    .select('*', { count: 'exact', head: true })

  if (filters.mapelId) countQ = countQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.semesterId) countQ = countQ.eq('semester_id', filters.semesterId)
  if (filters.tipe) countQ = countQ.eq('tipe', filters.tipe)

  if (access.isGuru && access.mapelIds.length > 0) {
    countQ = countQ.in('mata_pelajaran_id', access.mapelIds)
  }

  const { count, error: countError } = await countQ
  if (countError) throw new Error(countError.message)

  let dataQ = supabase
    .from('bank_soal')
    .select(BANK_SOAL_SELECT)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.mapelId) dataQ = dataQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.semesterId) dataQ = dataQ.eq('semester_id', filters.semesterId)
  if (filters.tipe) dataQ = dataQ.eq('tipe', filters.tipe)

  if (access.isGuru && access.mapelIds.length > 0) {
    dataQ = dataQ.in('mata_pelajaran_id', access.mapelIds)
  }

  const { data, error } = await dataQ
  if (error) throw new Error(error.message)

  return { data: (data ?? []).map(mapBankSoal), total: count ?? 0 }
}
export async function createBankSoal(data: {
  judul: string
  tipe: string
  mata_pelajaran_id: string | null
  semester_id: string | null
  konten?: Record<string, unknown> | null
  dibuat_oleh?: string | null
  tipe_nilai_id?: string | null
  materi?: string | null
  bab?: string[] | null
  tujuan_pembelajaran?: string | null
}): Promise<BankSoalEntry> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (data.mata_pelajaran_id) {
    assertGuruMapelWriteAccess(access, data.mata_pelajaran_id)
  } else if (access.isGuru && !access.hasMapelConfigured) {
    throw new Error(
      'Mata pelajaran belum dikonfigurasi. Hubungi Admin untuk mengatur mata pelajaran Anda.'
    )
  }

  const { data: result, error } = await supabase
    .from('bank_soal')
    .insert(data)
    .select(BANK_SOAL_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapBankSoal(result)
}

export async function updateBankSoal(
  id: string,
  data: Partial<{
    judul: string
    tipe: string
    mata_pelajaran_id: string | null
    semester_id: string | null
    konten: Record<string, unknown> | null
    tipe_nilai_id: string | null
    materi: string | null
    bab: string[] | null
    tujuan_pembelajaran: string | null
  }>
): Promise<BankSoalEntry> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('bank_soal')
      .select('mata_pelajaran_id')
      .eq('id', id)
      .single()
    if (existing && existing.mata_pelajaran_id && !access.mapelIds.includes(existing.mata_pelajaran_id)) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke bank soal ini')
    }
    if (data.mata_pelajaran_id && !access.mapelIds.includes(data.mata_pelajaran_id)) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke mata pelajaran baru ini')
    }
  }

  const { data: result, error } = await supabase
    .from('bank_soal')
    .update(data)
    .eq('id', id)
    .select(BANK_SOAL_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapBankSoal(result)
}

export async function getBankSoalForAutoFill(
  tipeNilaiId: string,
  mapelId: string
): Promise<BankSoalEntry | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bank_soal')
    .select(BANK_SOAL_SELECT)
    .eq('tipe_nilai_id', tipeNilaiId)
    .eq('mata_pelajaran_id', mapelId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return null
  return mapBankSoal(data[0])
}

export async function deleteBankSoal(ids: string[]): Promise<void> {
  const supabase = createClient()
  const access = await resolveMapelAccess()
  if (access.isGuru && access.hasMapelConfigured) {
    const { data: existing } = await supabase
      .from('bank_soal')
      .select('mata_pelajaran_id')
      .in('id', ids)
    if (existing) {
      for (const row of existing) {
        if (row.mata_pelajaran_id && !access.mapelIds.includes(row.mata_pelajaran_id)) {
          throw new Error('Akses ditolak: Anda tidak memiliki akses untuk menghapus bank soal ini')
        }
      }
    }
  }

  const { error } = await supabase.from('bank_soal').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

// ─── Catatan Kelakuan ─────────────────────────────────────────────────────────

export async function getCatatanKelakuan(
  filters: DiknasDashboardFilters
): Promise<{ data: CatatanKelakuanEntry[]; total: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const siswaIds = filters.siswaId
    ? [filters.siswaId]
    : await getSiswaIds(filters.unit, filters.kelas, filters.search)

  if (siswaIds && siswaIds.length === 0) {
    return { data: [], total: 0 }
  }

  let countQ = supabase
    .from('catatan_kelakuan')
    .select('*', { count: 'exact', head: true })

  if (siswaIds) countQ = countQ.in('siswa_id', siswaIds)
  if (filters.semesterId) countQ = countQ.eq('semester_id', filters.semesterId)

  const { count, error: countError } = await countQ
  if (countError) throw new Error(countError.message)

  let dataQ = supabase
    .from('catatan_kelakuan')
    .select(CATATAN_KELAKUAN_SELECT)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (siswaIds) dataQ = dataQ.in('siswa_id', siswaIds)
  if (filters.semesterId) dataQ = dataQ.eq('semester_id', filters.semesterId)

  const { data, error } = await dataQ
  if (error) throw new Error(error.message)

  return { data: (data ?? []).map(mapCatatanKelakuan), total: count ?? 0 }
}

export async function createCatatanKelakuan(data: {
  siswa_id: string
  semester_id: string | null
  tipe: 'Baik' | 'Kurang Baik'
  catatan: string
  tanggal?: string | null
  dicatat_oleh?: string | null
}): Promise<CatatanKelakuanEntry> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('catatan_kelakuan')
    .insert(data)
    .select(CATATAN_KELAKUAN_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapCatatanKelakuan(result)
}

export async function updateCatatanKelakuan(
  id: string,
  data: Partial<{
    tipe: 'Baik' | 'Kurang Baik'
    catatan: string
    tanggal: string | null
    semester_id: string | null
  }>
): Promise<CatatanKelakuanEntry> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('catatan_kelakuan')
    .update(data)
    .eq('id', id)
    .select(CATATAN_KELAKUAN_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapCatatanKelakuan(result)
}

export async function deleteCatatanKelakuan(ids: string[]): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('catatan_kelakuan')
    .delete()
    .in('id', ids)

  if (error) throw new Error(error.message)
}

export async function bulkCreateCatatanKelakuan(
  data: {
    siswa_id: string
    semester_id: string | null
    tipe: 'Baik' | 'Kurang Baik'
    catatan: string
    tanggal?: string | null
    dicatat_oleh?: string | null
  }[]
): Promise<CatatanKelakuanEntry[]> {
  if (data.length === 0) return []
  const supabase = createClient()
  const { data: results, error } = await supabase
    .from('catatan_kelakuan')
    .insert(data)
    .select(CATATAN_KELAKUAN_SELECT)

  if (error) throw new Error(error.message)
  return (results ?? []).map(mapCatatanKelakuan)
}

// ─── Rekap Nilai Rapor ────────────────────────────────────────────────────────

function avg(values: (number | null | undefined)[]): number {
  const valid = values.filter((v): v is number => v !== null && v !== undefined)
  if (valid.length === 0) return 0
  return valid.reduce((sum, v) => sum + v, 0) / valid.length
}

interface SiswaRow {
  id: string
  nama: string
  kelas: string
}

interface RaportNilaiHarianRow {
  siswa_id: string
  tipe_nilai: string
  nilai_final: number | null
  tipe_nilai_rel?: any
}

interface RaportNilaiUASRow {
  siswa_id: string
  nilai_final: number | null
}

export async function getRaportSiswa(filters: {
  semesterId: string
  unit?: string
  kelas?: string
  mapelId?: string
  search?: string
}): Promise<RaportSiswa[]> {
  const supabase = createClient()

  // 1. Ambil daftar siswa aktif sesuai filter
  let siswaQ = supabase
    .from('students')
    .select('id, nama, kelas_id, kelas(nama_kelas)')
    .eq('is_alumni', false)
    .order('nama', { ascending: true })

  if (filters.unit) siswaQ = siswaQ.eq('unit', filters.unit)
  
  if (filters.kelas) {
    let kelasIdFilter: string | null = null
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.kelas)
    if (!isUuid) {
      let query = supabase.from('kelas').select('id').eq('nama_kelas', filters.kelas)
      if (filters.unit) {
        query = query.eq('unit', filters.unit)
      }
      const { data: kelasRow } = await query.maybeSingle()
      if (kelasRow) {
        kelasIdFilter = kelasRow.id
      }
    } else {
      kelasIdFilter = filters.kelas
    }
    if (kelasIdFilter) {
      siswaQ = siswaQ.eq('kelas_id', kelasIdFilter)
    } else {
      return []
    }
  }

  if (filters.search) siswaQ = siswaQ.ilike('nama', `%${filters.search}%`)

  const { data: siswaData, error: siswaError } = await siswaQ
  if (siswaError) throw new Error(siswaError.message)

  const siswaList: SiswaRow[] = (siswaData ?? []).map((row: any) => ({
    id: row.id,
    nama: row.nama,
    kelas: row.kelas?.nama_kelas || '-',
  }))
  if (siswaList.length === 0) return []

  const siswaIds = siswaList.map((s) => s.id)

  // 2. Ambil nilai harian semua siswa pada semester & mapel yang sesuai
  let nilaiHarianQ = supabase
    .from('nilai_harian')
    .select('siswa_id, tipe_nilai, nilai_final, tipe_nilai_rel:tipe_nilai(jenis_nilai)')
    .eq('semester_id', filters.semesterId)
    .in('siswa_id', siswaIds)

  if (filters.mapelId) {
    nilaiHarianQ = nilaiHarianQ.eq('mata_pelajaran_id', filters.mapelId)
  }

  const { data: nilaiHarianData, error: nilaiHarianError } = await nilaiHarianQ
  if (nilaiHarianError) throw new Error(nilaiHarianError.message)

  const nilaiHarianList = (nilaiHarianData ?? []) as RaportNilaiHarianRow[]

  // 3. Ambil nilai UAS semua siswa
  let nilaiUASQ = supabase
    .from('nilai_uas')
    .select('siswa_id, nilai_final')
    .eq('semester_id', filters.semesterId)
    .in('siswa_id', siswaIds)

  if (filters.mapelId) {
    nilaiUASQ = nilaiUASQ.eq('mata_pelajaran_id', filters.mapelId)
  }

  const { data: nilaiUASData, error: nilaiUASError } = await nilaiUASQ
  if (nilaiUASError) throw new Error(nilaiUASError.message)

  const nilaiUASList = (nilaiUASData ?? []) as RaportNilaiUASRow[]

  // 4. Hitung rapor per siswa (client-side)
  return siswaList.map((siswa) => {
    const harianSiswa = nilaiHarianList.filter((n) => n.siswa_id === siswa.id)
    const formatifValues = harianSiswa
      .filter((n) => {
        const rel = Array.isArray(n.tipe_nilai_rel) ? n.tipe_nilai_rel[0] : n.tipe_nilai_rel
        const tipe = rel ? (rel.jenis_nilai === 'Harian' ? 'Formatif' : 'Sumatif') : n.tipe_nilai
        return tipe === 'Formatif'
      })
      .map((n) => n.nilai_final)
      .filter((v): v is number => v !== null && v !== undefined)
    const sumatifValues = harianSiswa
      .filter((n) => {
        const rel = Array.isArray(n.tipe_nilai_rel) ? n.tipe_nilai_rel[0] : n.tipe_nilai_rel
        const tipe = rel ? (rel.jenis_nilai === 'Harian' ? 'Formatif' : 'Sumatif') : n.tipe_nilai
        return tipe === 'Sumatif'
      })
      .map((n) => n.nilai_final)
      .filter((v): v is number => v !== null && v !== undefined)

    const uasEntry = nilaiUASList.find((n) => n.siswa_id === siswa.id)
    const nilai_uas = uasEntry?.nilai_final ?? null

    const avg_formatif = avg(formatifValues)
    const avg_sumatif = avg(sumatifValues)

    // Formula rapor: rata-rata komponen yang tersedia
    const components: number[] = []
    if (formatifValues.length > 0) components.push(avg_formatif)
    if (sumatifValues.length > 0) components.push(avg_sumatif)
    if (nilai_uas !== null) components.push(nilai_uas)

    const nilai_rapor = components.length > 0 ? avg(components) : 0

    return {
      id: siswa.id,
      siswa_id: siswa.id,
      nama: siswa.nama,
      kelas: siswa.kelas,
      avg_formatif,
      avg_sumatif,
      nilai_uas,
      nilai_rapor,
    }
  })
}

// ─── Search helpers ───────────────────────────────────────────────────────────

export async function searchMataKuliah(
  query: string,
  unit?: string
): Promise<MataKuliah[]> {
  const supabase = createClient()

  let q = supabase
    .from('mata_pelajaran')
    .select('*')
    .ilike('nama_mapel', `%${query}%`)
    .limit(20)

  if (unit) q = q.eq('unit', unit)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  return (data ?? []) as MataKuliah[]
}

export async function searchBankSoal(
  query: string,
  mapelId?: string
): Promise<BankSoalEntry[]> {
  const supabase = createClient()

  let q = supabase
    .from('bank_soal')
    .select(BANK_SOAL_SELECT)
    .ilike('judul', `%${query}%`)
    .limit(20)

  if (mapelId) q = q.eq('mata_pelajaran_id', mapelId)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  return (data ?? []).map(mapBankSoal)
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DiknasDashboardStats {
  totalPresensiMonthly: number
  rataKehadiran: number
  totalCatatanKelakuan: number
  nilaiRaporTertinggi: number
}

export async function getDiknasDashboardStats(semesterId?: string): Promise<DiknasDashboardStats> {
  const supabase = createClient()
  const now = new Date()
  const bulanIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [yr, mo] = bulanIni.split('-').map(Number)
  const lastDay = new Date(yr, mo, 0).getDate()
  const tglSelesai = `${bulanIni}-${String(lastDay).padStart(2, '0')}`

  // Total presensi bulan ini
  let presensiQ = supabase
    .from('presensi')
    .select('*', { count: 'exact', head: true })
    .gte('tanggal', `${bulanIni}-01`)
    .lte('tanggal', tglSelesai)

  const { count: totalPresensi } = await presensiQ

  // Rata-rata kehadiran bulan ini
  let hadirQ = supabase
    .from('presensi')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Hadir')
    .gte('tanggal', `${bulanIni}-01`)
    .lte('tanggal', tglSelesai)

  const { count: hadirCount } = await hadirQ

  const rataKehadiran =
    (totalPresensi ?? 0) > 0
      ? Math.round(((hadirCount ?? 0) / (totalPresensi ?? 1)) * 100)
      : 0

  // Total catatan kelakuan
  let catatanQ = supabase
    .from('catatan_kelakuan')
    .select('*', { count: 'exact', head: true })

  if (semesterId) catatanQ = catatanQ.eq('semester_id', semesterId)

  const { count: totalCatatan } = await catatanQ

  return {
    totalPresensiMonthly: totalPresensi ?? 0,
    rataKehadiran,
    totalCatatanKelakuan: totalCatatan ?? 0,
    nilaiRaporTertinggi: 0, // Dihitung dari getRaportSiswa jika dibutuhkan
  }
}

export async function getKehadiranPerKelas(
  bulan: string
): Promise<{ kelas: string; hadir: number; total: number }[]> {
  const supabase = createClient()

  const [yr, mo] = bulan.split('-').map(Number)
  const lastDay = new Date(yr, mo, 0).getDate()
  const tglSelesai = `${bulan}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('presensi')
    .select('status, students!left(kelas_id, kelas(nama_kelas))')
    .gte('tanggal', `${bulan}-01`)
    .lte('tanggal', tglSelesai)

  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((row: any) => {
    const std = unwrapRelation(row.students)
    return {
      status: row.status,
      students: std ? { kelas: std.kelas?.nama_kelas || '-' } : null,
    }
  })

  const kelasMap = new Map<string, { hadir: number; total: number }>()

  for (const row of rows) {
    const kelas = row.students?.kelas
    if (!kelas) continue

    const existing = kelasMap.get(kelas) ?? { hadir: 0, total: 0 }
    existing.total++
    if (row.status === 'Hadir') existing.hadir++
    kelasMap.set(kelas, existing)
  }

  return Array.from(kelasMap.entries())
    .map(([kelas, val]) => ({ kelas, ...val }))
    .sort((a, b) => a.kelas.localeCompare(b.kelas))
}

export async function getKelasOptions(unit: string): Promise<{ id: string; nama_kelas: string }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kelas')
    .select('id, nama_kelas')
    .eq('unit', unit)
    .order('nama_kelas', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as { id: string; nama_kelas: string }[]
}

export async function uploadBankSoalPDF(file: File): Promise<string> {
  const supabase = createClient()
  const extension = 'pdf'
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${extension}`
  const path = `bank-soal/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, {
      upsert: false,
      contentType: 'application/pdf',
    })

  if (uploadError) throw new Error(uploadError.message)

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
  return urlData.publicUrl
}

// ─── Orang Tua (read-only — WAJIB is_approved=true) ───────────────────────────

/** Nilai harian yang sudah disetujui guru — untuk dashboard orang tua (Fase G). */
export async function getNilaiHarianForOrangTua(
  filters: DiknasDashboardFilters & { siswaId: string }
): Promise<{ data: NilaiHarianEntry[]; total: number }> {
  return getNilaiHarian({ ...filters, isApproved: true })
}

/** Nilai UAS yang sudah disetujui guru — untuk dashboard orang tua (Fase G). */
export async function getNilaiUASForOrangTua(
  filters: DiknasDashboardFilters & { siswaId: string }
): Promise<{ data: NilaiUASEntry[]; total: number }> {
  return getNilaiUAS({ ...filters, isApproved: true })
}

/** Presensi anak — orang tua boleh melihat semua status kehadiran. */
export async function getPresensiForOrangTua(
  filters: DiknasDashboardFilters & { siswaId: string }
): Promise<{ data: PresensiEntry[]; total: number }> {
  return getPresensi(filters)
}

export async function getBankSoalOptions(
  semesterId: string,
  mapelId: string
): Promise<BankSoalEntry[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bank_soal')
    .select(BANK_SOAL_SELECT)
    .eq('semester_id', semesterId)
    .eq('mata_pelajaran_id', mapelId)
    .order('judul', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapBankSoal)
}

