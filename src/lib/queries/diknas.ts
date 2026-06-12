// src/lib/queries/diknas.ts
// Query functions untuk modul Akademik (DIKNAS) — Fase F

import { createClient } from '@/lib/supabase/client'
import type { Unit } from '@/lib/supabase/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MataKuliah {
  id: string
  nama_mapel: string
  kategori: string
  unit: Unit
  created_at: string
}

export interface SemesterOption {
  id: string
  tahun_pelajaran_id: string
  nomor_semester: number
  tanggal_mulai: string
  tanggal_selesai: string
  is_aktif: boolean
  created_at: string
  tahun_pelajaran: {
    id: string
    nama: string
    tahun_mulai: number
    tahun_selesai: number
    is_aktif: boolean
    created_at: string
  }
}

export interface PresensiEntry {
  id: string
  siswa_id: string
  mata_pelajaran_id: string
  semester_id: string | null
  tanggal: string
  status: string
  keterangan: string | null
  dicatat_oleh: string | null
  students?: { nama: string; kelas: string; unit: string }
  mata_pelajaran?: { nama_mapel: string; unit: string }
}

export interface NilaiHarianEntry {
  id: string
  siswa_id: string
  mata_pelajaran_id: string
  semester_id: string | null
  tipe_nilai: 'Formatif' | 'Sumatif'
  nama_tugas: string
  materi: string | null
  bab: string | null
  nilai_asli: number | null
  nilai_remedial: number | null
  nilai_final: number | null
  tipe_remedial: string | null
  bank_soal_id: string | null
  is_approved: boolean
  approved_at: string | null
  approved_by: string | null
  dicatat_oleh: string | null
  tanggal: string | null
  students?: { nama: string; kelas: string; unit: string }
  mata_pelajaran?: { nama_mapel: string }
  bank_soal?: { judul: string; tipe: string }
}

export interface NilaiUASEntry {
  id: string
  siswa_id: string
  mata_pelajaran_id: string
  semester_id: string | null
  nilai_asli: number | null
  nilai_remedial: number | null
  nilai_final: number | null
  tipe_remedial: string | null
  bank_soal_id: string | null
  is_approved: boolean
  approved_at: string | null
  dicatat_oleh: string | null
  students?: { nama: string; kelas: string; unit: string }
  mata_pelajaran?: { nama_mapel: string }
}

export interface BankSoalEntry {
  id: string
  judul: string
  tipe: string
  mata_pelajaran_id: string | null
  semester_id: string | null
  konten: Record<string, unknown> | null
  dibuat_oleh: string | null
  created_at: string
  mata_pelajaran?: { nama_mapel: string; unit: string }
  semester?: { nomor_semester: number; tahun_pelajaran?: { nama: string } }
}

export interface CatatanKelakuanEntry {
  id: string
  siswa_id: string
  semester_id: string | null
  tipe: 'Baik' | 'Kurang Baik'
  catatan: string
  tanggal: string | null
  dicatat_oleh: string | null
  created_at: string
  students?: { nama: string; kelas: string; unit: string }
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
  page?: number
  pageSize?: number
  isApproved?: boolean
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
] as const

export type PresensiStatus = (typeof PRESENSI_STATUS_OPTIONS)[number]

// ─── Helpers: Relation unwrapping ─────────────────────────────────────────────

type Relation<T> = T | T[] | null | undefined

function unwrapRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
}

function mapPresensi(row: any): PresensiEntry {
  return {
    id: row.id,
    siswa_id: row.siswa_id,
    mata_pelajaran_id: row.mata_pelajaran_id,
    semester_id: row.semester_id,
    tanggal: row.tanggal,
    status: row.status,
    keterangan: row.keterangan,
    dicatat_oleh: row.dicatat_oleh,
    students: unwrapRelation(row.students) ?? undefined,
    mata_pelajaran: unwrapRelation(row.mata_pelajaran) ?? undefined,
  }
}

function mapNilaiHarian(row: any): NilaiHarianEntry {
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
    is_approved: row.is_approved,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    dicatat_oleh: row.dicatat_oleh,
    tanggal: row.tanggal,
    students: unwrapRelation(row.students) ?? undefined,
    mata_pelajaran: unwrapRelation(row.mata_pelajaran) ?? undefined,
    bank_soal: unwrapRelation(row.bank_soal) ?? undefined,
  }
}

function mapNilaiUAS(row: any): NilaiUASEntry {
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
    is_approved: row.is_approved,
    approved_at: row.approved_at,
    dicatat_oleh: row.dicatat_oleh,
    students: unwrapRelation(row.students) ?? undefined,
    mata_pelajaran: unwrapRelation(row.mata_pelajaran) ?? undefined,
  }
}

function mapBankSoal(row: any): BankSoalEntry {
  return {
    id: row.id,
    judul: row.judul,
    tipe: row.tipe,
    mata_pelajaran_id: row.mata_pelajaran_id,
    semester_id: row.semester_id,
    konten: row.konten,
    dibuat_oleh: row.dibuat_oleh,
    created_at: row.created_at,
    mata_pelajaran: unwrapRelation(row.mata_pelajaran) ?? undefined,
    semester: unwrapRelation(row.semester) ?? undefined,
  }
}

function mapCatatanKelakuan(row: any): CatatanKelakuanEntry {
  return {
    id: row.id,
    siswa_id: row.siswa_id,
    semester_id: row.semester_id,
    tipe: row.tipe,
    catatan: row.catatan,
    tanggal: row.tanggal,
    dicatat_oleh: row.dicatat_oleh,
    created_at: row.created_at,
    students: unwrapRelation(row.students) ?? undefined,
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
  if (kelas) q = q.eq('kelas', kelas)
  if (search) q = q.ilike('nama', `%${search}%`)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  return (data ?? []).map((r: { id: string }) => r.id)
}

// ─── Mata Pelajaran ────────────────────────────────────────────────────────────

export async function getMataKuliah(unit?: string): Promise<MataKuliah[]> {
  const supabase = createClient()

  let query = supabase
    .from('mata_pelajaran')
    .select('*')
    .order('nama_mapel', { ascending: true })

  if (unit) {
    query = query.eq('unit', unit)
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

  const siswaIds = await getSiswaIds(filters.unit, filters.kelas, filters.search)

  if (siswaIds && siswaIds.length === 0) {
    return { data: [], total: 0 }
  }

  let countQ = supabase
    .from('presensi')
    .select('*', { count: 'exact', head: true })

  if (siswaIds) countQ = countQ.in('siswa_id', siswaIds)
  if (filters.semesterId) countQ = countQ.eq('semester_id', filters.semesterId)
  if (filters.mapelId) countQ = countQ.eq('mata_pelajaran_id', filters.mapelId)

  const { count, error: countError } = await countQ
  if (countError) throw new Error(countError.message)

  let dataQ = supabase
    .from('presensi')
    .select(
      'id, siswa_id, mata_pelajaran_id, semester_id, tanggal, status, keterangan, dicatat_oleh, students(nama, kelas, unit), mata_pelajaran(nama_mapel, unit)'
    )
    .order('tanggal', { ascending: false })
    .range(from, to)

  if (siswaIds) dataQ = dataQ.in('siswa_id', siswaIds)
  if (filters.semesterId) dataQ = dataQ.eq('semester_id', filters.semesterId)
  if (filters.mapelId) dataQ = dataQ.eq('mata_pelajaran_id', filters.mapelId)

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

  const { data: result, error } = await supabase
    .from('presensi')
    .insert(data)
    .select(
      'id, siswa_id, mata_pelajaran_id, semester_id, tanggal, status, keterangan, dicatat_oleh, students(nama, kelas, unit), mata_pelajaran(nama_mapel, unit)'
    )
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

  const { data: result, error } = await supabase
    .from('presensi')
    .update(data)
    .eq('id', id)
    .select(
      'id, siswa_id, mata_pelajaran_id, semester_id, tanggal, status, keterangan, dicatat_oleh, students(nama, kelas, unit), mata_pelajaran(nama_mapel, unit)'
    )
    .single()

  if (error) throw new Error(error.message)

  return mapPresensi(result)
}

export async function deletePresensi(ids: string[]): Promise<void> {
  const supabase = createClient()

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

  const { data: result, error } = await supabase
    .from('presensi')
    .upsert(data, { onConflict: 'siswa_id,mata_pelajaran_id,tanggal', ignoreDuplicates: false })
    .select(
      'id, siswa_id, mata_pelajaran_id, semester_id, tanggal, status, keterangan, dicatat_oleh, students(nama, kelas, unit), mata_pelajaran(nama_mapel, unit)'
    )

  if (error) throw new Error(error.message)

  return (result ?? []).map(mapPresensi)
}

// ─── Nilai Harian ─────────────────────────────────────────────────────────────

const NILAI_HARIAN_SELECT =
  'id, siswa_id, mata_pelajaran_id, semester_id, tipe_nilai, nama_tugas, materi, bab, nilai_asli, nilai_remedial, nilai_final, tipe_remedial, bank_soal_id, is_approved, approved_at, approved_by, dicatat_oleh, tanggal, students(nama, kelas, unit), mata_pelajaran(nama_mapel), bank_soal(judul, tipe)'

export async function getNilaiHarian(
  filters: DiknasDashboardFilters & { isApproved?: boolean }
): Promise<{ data: NilaiHarianEntry[]; total: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const siswaIds = await getSiswaIds(filters.unit, filters.kelas, filters.search)

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
  bab?: string | null
  nilai_asli?: number | null
  nilai_remedial?: number | null
  tipe_remedial?: string | null
  bank_soal_id?: string | null
  dicatat_oleh?: string | null
  tanggal?: string | null
}): Promise<NilaiHarianEntry> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('nilai_harian')
    .insert(data)
    .select(NILAI_HARIAN_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapNilaiHarian(result)
}

export async function updateNilaiHarian(
  id: string,
  data: Partial<{
    tipe_nilai: 'Formatif' | 'Sumatif'
    nama_tugas: string
    materi: string | null
    bab: string | null
    nilai_asli: number | null
    nilai_remedial: number | null
    tipe_remedial: string | null
    bank_soal_id: string | null
    tanggal: string | null
    is_approved: boolean
    approved_at: string | null
    approved_by: string | null
  }>
): Promise<NilaiHarianEntry> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('nilai_harian')
    .update(data)
    .eq('id', id)
    .select(NILAI_HARIAN_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapNilaiHarian(result)
}

export async function deleteNilaiHarian(ids: string[]): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('nilai_harian').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

export async function approveNilaiHarian(
  ids: string[],
  approvedBy: string
): Promise<void> {
  const supabase = createClient()

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

// ─── Nilai UAS ────────────────────────────────────────────────────────────────

const NILAI_UAS_SELECT =
  'id, siswa_id, mata_pelajaran_id, semester_id, nilai_asli, nilai_remedial, nilai_final, tipe_remedial, bank_soal_id, is_approved, approved_at, dicatat_oleh, students(nama, kelas, unit), mata_pelajaran(nama_mapel)'

export async function getNilaiUAS(
  filters: DiknasDashboardFilters & { isApproved?: boolean }
): Promise<{ data: NilaiUASEntry[]; total: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const siswaIds = await getSiswaIds(filters.unit, filters.kelas, filters.search)

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
  dicatat_oleh?: string | null
}): Promise<NilaiUASEntry> {
  const supabase = createClient()

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
    is_approved: boolean
    approved_at: string | null
  }>
): Promise<NilaiUASEntry> {
  const supabase = createClient()

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

  const { error } = await supabase.from('nilai_uas').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

export async function approveNilaiUAS(
  ids: string[],
  approvedBy: string
): Promise<void> {
  const supabase = createClient()

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

// ─── Bank Soal ────────────────────────────────────────────────────────────────

const BANK_SOAL_SELECT =
  'id, judul, tipe, mata_pelajaran_id, semester_id, konten, dibuat_oleh, created_at, mata_pelajaran(nama_mapel, unit), semester(nomor_semester, tahun_pelajaran(nama))'

export async function getBankSoal(
  filters: DiknasDashboardFilters
): Promise<{ data: BankSoalEntry[]; total: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let countQ = supabase
    .from('bank_soal')
    .select('*', { count: 'exact', head: true })

  if (filters.mapelId) countQ = countQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.semesterId) countQ = countQ.eq('semester_id', filters.semesterId)

  const { count, error: countError } = await countQ
  if (countError) throw new Error(countError.message)

  let dataQ = supabase
    .from('bank_soal')
    .select(BANK_SOAL_SELECT)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.mapelId) dataQ = dataQ.eq('mata_pelajaran_id', filters.mapelId)
  if (filters.semesterId) dataQ = dataQ.eq('semester_id', filters.semesterId)

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
}): Promise<BankSoalEntry> {
  const supabase = createClient()

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
  }>
): Promise<BankSoalEntry> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('bank_soal')
    .update(data)
    .eq('id', id)
    .select(BANK_SOAL_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapBankSoal(result)
}

export async function deleteBankSoal(ids: string[]): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('bank_soal').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

// ─── Catatan Kelakuan ─────────────────────────────────────────────────────────

const CATATAN_KELAKUAN_SELECT =
  'id, siswa_id, semester_id, tipe, catatan, tanggal, dicatat_oleh, created_at, students(nama, kelas, unit)'

export async function getCatatanKelakuan(
  filters: DiknasDashboardFilters
): Promise<{ data: CatatanKelakuanEntry[]; total: number }> {
  const supabase = createClient()
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const siswaIds = await getSiswaIds(filters.unit, filters.kelas, filters.search)

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

interface NilaiHarianRow {
  siswa_id: string
  tipe_nilai: string
  nilai_final: number | null
}

interface NilaiUASRow {
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
    .select('id, nama, kelas')
    .eq('is_alumni', false)
    .order('nama', { ascending: true })

  if (filters.unit) siswaQ = siswaQ.eq('unit', filters.unit)
  if (filters.kelas) siswaQ = siswaQ.eq('kelas', filters.kelas)
  if (filters.search) siswaQ = siswaQ.ilike('nama', `%${filters.search}%`)

  const { data: siswaData, error: siswaError } = await siswaQ
  if (siswaError) throw new Error(siswaError.message)

  const siswaList = (siswaData ?? []) as SiswaRow[]
  if (siswaList.length === 0) return []

  const siswaIds = siswaList.map((s) => s.id)

  // 2. Ambil nilai harian semua siswa pada semester & mapel yang sesuai
  let nilaiHarianQ = supabase
    .from('nilai_harian')
    .select('siswa_id, tipe_nilai, nilai_final')
    .eq('semester_id', filters.semesterId)
    .in('siswa_id', siswaIds)

  if (filters.mapelId) {
    nilaiHarianQ = nilaiHarianQ.eq('mata_pelajaran_id', filters.mapelId)
  }

  const { data: nilaiHarianData, error: nilaiHarianError } = await nilaiHarianQ
  if (nilaiHarianError) throw new Error(nilaiHarianError.message)

  const nilaiHarianList = (nilaiHarianData ?? []) as NilaiHarianRow[]

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

  const nilaiUASList = (nilaiUASData ?? []) as NilaiUASRow[]

  // 4. Hitung rapor per siswa (client-side)
  return siswaList.map((siswa) => {
    const harianSiswa = nilaiHarianList.filter((n) => n.siswa_id === siswa.id)
    const formatifValues = harianSiswa
      .filter((n) => n.tipe_nilai === 'Formatif')
      .map((n) => n.nilai_final)
    const sumatifValues = harianSiswa
      .filter((n) => n.tipe_nilai === 'Sumatif')
      .map((n) => n.nilai_final)

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

  // Total presensi bulan ini
  let presensiQ = supabase
    .from('presensi')
    .select('*', { count: 'exact', head: true })
    .gte('tanggal', `${bulanIni}-01`)
    .lte('tanggal', `${bulanIni}-31`)

  const { count: totalPresensi } = await presensiQ

  // Rata-rata kehadiran bulan ini
  let hadirQ = supabase
    .from('presensi')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Hadir')
    .gte('tanggal', `${bulanIni}-01`)
    .lte('tanggal', `${bulanIni}-31`)

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

  const { data, error } = await supabase
    .from('presensi')
    .select('status, students(kelas)')
    .gte('tanggal', `${bulan}-01`)
    .lte('tanggal', `${bulan}-31`)

  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((row: any) => ({
    status: row.status,
    students: unwrapRelation(row.students)
  }))

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

export async function getKelasOptions(unit: string): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('students')
    .select('kelas')
    .eq('unit', unit)
    .eq('is_alumni', false)

  if (error) throw new Error(error.message)

  const classes = [
    ...new Set(
      (data ?? [])
        .map((row) => row.kelas)
        .filter(
          (kelas): kelas is string =>
            typeof kelas === 'string' && kelas.length > 0
        )
    ),
  ]

  return classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
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

