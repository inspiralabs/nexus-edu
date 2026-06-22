// src/lib/queries/admin-extended.ts
// Query functions untuk 3 fitur admin baru: MataPelajaran, Guru, OrangTua

import { createClient } from '@/lib/supabase/client'
import type {
  Guru,
  JenisKelamin,
  MataPelajaran,
  OrangTua,
  TipeGuru,
  TipeRole,
  Unit,
  Kelas,
} from '@/lib/supabase/types'

// ─── Tipe Input ───────────────────────────────────────────────────────────────

export interface CreateMapelInput {
  nama_mapel: string
  kategori: string
  unit: Unit
  kelas_ids?: string[] | null
}

export interface UpdateMapelInput {
  nama_mapel?: string
  kategori?: string
  unit?: Unit
  kelas_ids?: string[] | null
}

export interface GetMapelOptions {
  unit?: Unit
  search?: string
  page?: number
  pageSize?: number
}

export interface CreateKelasInput {
  nama_kelas: string
  deskripsi?: string | null
  unit: Unit
}

export interface UpdateKelasInput {
  nama_kelas?: string
  deskripsi?: string | null
}

export interface GetKelasOptions {
  unit?: Unit
  search?: string
  page?: number
  pageSize?: number
}

export interface CreateGuruInput {
  nama_lengkap: string
  nip?: string
  jenis_kelamin?: JenisKelamin
  mapel_ids?: string[]
  unit?: string[]
  tipe?: TipeGuru
  email?: string
  no_hp?: string
}

export interface UpdateGuruInput {
  nama_lengkap?: string
  nip?: string
  jenis_kelamin?: JenisKelamin
  mapel_ids?: string[]
  unit?: string[]
  tipe?: TipeGuru
  email?: string
  no_hp?: string
  profile_id?: string | null
}

export interface GetGuruOptions {
  search?: string
  page?: number
  pageSize?: number
}

export interface CreateOrangTuaInput {
  nama_lengkap: string
  pekerjaan?: string
  email?: string
  no_hp?: string
  siswa_ids?: string[]
}

export interface UpdateOrangTuaInput {
  nama_lengkap?: string
  pekerjaan?: string
  email?: string
  no_hp?: string
  siswa_ids?: string[]
}

export interface GetOrangTuaOptions {
  search?: string
  page?: number
  pageSize?: number
}

// ─── Mata Pelajaran ───────────────────────────────────────────────────────────

export async function getMapel(
  options: GetMapelOptions = {}
): Promise<{ data: MataPelajaran[]; total: number }> {
  const supabase = createClient()
  const { unit, search, page = 1, pageSize = 10 } = options

  let query = supabase
    .from('mata_pelajaran')
    .select('*', { count: 'exact' })
    .order('nama_mapel', { ascending: true })

  if (unit) query = query.eq('unit', unit)
  if (search) query = query.ilike('nama_mapel', `%${search}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as MataPelajaran[],
    total: count ?? 0,
  }
}

export async function getAllMapel(unit?: Unit): Promise<MataPelajaran[]> {
  const supabase = createClient()
  let query = supabase
    .from('mata_pelajaran')
    .select('*')
    .order('nama_mapel', { ascending: true })

  if (unit) query = query.eq('unit', unit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as MataPelajaran[]
}

export async function getAllKelas(unit?: Unit): Promise<Kelas[]> {
  const supabase = createClient()
  let query = supabase
    .from('kelas')
    .select('*')
    .order('nama_kelas', { ascending: true })

  if (unit) query = query.eq('unit', unit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Kelas[]
}

export async function createMapel(input: CreateMapelInput): Promise<MataPelajaran> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('mata_pelajaran')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as MataPelajaran
}

export async function updateMapel(
  id: string,
  input: UpdateMapelInput
): Promise<MataPelajaran> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('mata_pelajaran')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as MataPelajaran
}

export async function deleteMapel(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('mata_pelajaran').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Guru ─────────────────────────────────────────────────────────────────────

export async function getGuru(
  options: GetGuruOptions = {}
): Promise<{ data: Guru[]; total: number }> {
  const supabase = createClient()
  const { search, page = 1, pageSize = 10 } = options

  let query = supabase
    .from('guru')
    .select('*, profiles(id, nama_lengkap, username, email, role)', { count: 'exact' })
    .order('nama_lengkap', { ascending: true })

  if (search) query = query.ilike('nama_lengkap', `%${search}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  const filteredData = (data ?? []).filter((item) => {
    const guruItem = item as Guru & { profiles?: { role?: string } | null }
    return guruItem.profiles?.role !== 'superadmin'
  }) as Guru[]

  const excludedCount = (data ?? []).length - filteredData.length
  const total = (count ?? 0) - excludedCount

  return {
    data: filteredData,
    total,
  }
}

export async function createGuru(input: CreateGuruInput): Promise<Guru> {
  const supabase = createClient()
  const payload = {
    nama_lengkap: input.nama_lengkap,
    nip: input.nip || null,
    jenis_kelamin: input.jenis_kelamin || null,
    mapel_ids: input.mapel_ids || [],
    unit: input.unit || [],
    tipe: input.tipe || 'guru',
    email: input.email || null,
    no_hp: input.no_hp || null,
  }
  const { data, error } = await supabase
    .from('guru')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Guru
}

export async function updateGuru(
  id: string,
  input: UpdateGuruInput
): Promise<Guru> {
  const supabase = createClient()
  const payload: {
    nama_lengkap?: string
    nip?: string | null
    jenis_kelamin?: JenisKelamin | null
    mapel_ids?: string[]
    unit?: string[]
    tipe?: TipeGuru
    email?: string | null
    no_hp?: string | null
  } = {}

  if (input.nama_lengkap !== undefined) payload.nama_lengkap = input.nama_lengkap
  if (input.nip !== undefined) payload.nip = input.nip || null
  if (input.jenis_kelamin !== undefined) payload.jenis_kelamin = input.jenis_kelamin || null
  if (input.mapel_ids !== undefined) payload.mapel_ids = input.mapel_ids || []
  if (input.unit !== undefined) payload.unit = input.unit || []
  if (input.tipe !== undefined) payload.tipe = input.tipe || 'guru'
  if (input.email !== undefined) payload.email = input.email || null
  if (input.no_hp !== undefined) payload.no_hp = input.no_hp || null

  let profileId = input.profile_id
  if (profileId === undefined) {
    const { data: current } = await supabase
      .from('guru')
      .select('profile_id')
      .eq('id', id)
      .single()
    profileId = current?.profile_id
  }

  const updateGuruPromise = supabase
    .from('guru')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (profileId) {
    const mapelIds = input.mapel_ids || []
    const isMusyrif = input.tipe ? input.tipe.includes('musyrif') : false
    const isMultiMapel = mapelIds.length > 1

    const profilePayload: {
      nama_lengkap?: string
      email?: string | null
      tipe_role?: TipeRole
      unit_mengajar?: Unit[]
      mapel_ids?: string[]
      is_musyrif?: boolean
      is_multi_mapel?: boolean
    } = {}

    if (input.nama_lengkap !== undefined) profilePayload.nama_lengkap = input.nama_lengkap
    if (input.email !== undefined) profilePayload.email = input.email || null
    if (input.tipe !== undefined) profilePayload.tipe_role = input.tipe as TipeRole
    if (input.unit !== undefined) profilePayload.unit_mengajar = input.unit as Unit[]
    if (input.mapel_ids !== undefined) profilePayload.mapel_ids = mapelIds
    if (input.tipe !== undefined) profilePayload.is_musyrif = isMusyrif
    if (input.mapel_ids !== undefined) profilePayload.is_multi_mapel = isMultiMapel

    const updateProfilePromise = supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', profileId)

    const [guruResult] = await Promise.all([updateGuruPromise, updateProfilePromise])
    if (guruResult.error) throw new Error(guruResult.error.message)
    return guruResult.data as Guru
  } else {
    const guruResult = await updateGuruPromise
    if (guruResult.error) throw new Error(guruResult.error.message)
    return guruResult.data as Guru
  }
}

export async function deleteGuru(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('guru').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function linkGuruToProfile(
  guruId: string,
  profileId: string
): Promise<Guru> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('guru')
    .update({ profile_id: profileId })
    .eq('id', guruId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  if (data) {
    const isMusyrif = data.tipe === 'musyrif' || data.tipe === 'guru_musyrif'
    const isMultiMapel = data.mapel_ids && data.mapel_ids.length > 1
    await supabase
      .from('profiles')
      .update({
        nama_lengkap: data.nama_lengkap,
        email: data.email,
        tipe_role: data.tipe as any,
        unit_mengajar: data.unit as any,
        mapel_ids: data.mapel_ids,
        is_musyrif: isMusyrif,
        is_multi_mapel: isMultiMapel,
      })
      .eq('id', profileId)
  }

  return data as Guru
}

// ─── Orang Tua ────────────────────────────────────────────────────────────────

export async function getOrangTua(
  options: GetOrangTuaOptions = {}
): Promise<{ data: OrangTua[]; total: number }> {
  const supabase = createClient()
  const { search, page = 1, pageSize = 10 } = options

  let query = supabase
    .from('orangtua')
    .select(
      '*, orangtua_siswa(id, siswa_id, hubungan, students(id, nama, kelas_id, unit, kelas(nama_kelas)))',
      { count: 'exact' }
    )
    .order('nama_lengkap', { ascending: true })

  if (search) query = query.ilike('nama_lengkap', `%${search}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as OrangTua[],
    total: count ?? 0,
  }
}

export async function createOrangTua(
  input: CreateOrangTuaInput
): Promise<OrangTua> {
  const supabase = createClient()
  const { siswa_ids, ...orangTuaData } = input

  // 1. Insert orangtua
  const { data, error } = await supabase
    .from('orangtua')
    .insert(orangTuaData)
    .select()
    .single()

  if (error) throw new Error(error.message)

  // 2. Insert relasi orangtua_siswa
  if (siswa_ids && siswa_ids.length > 0) {
    const relasi = siswa_ids.map((siswa_id) => ({
      orangtua_id: data.id as string,
      siswa_id,
      hubungan: 'ayah/ibu',
    }))

    const { error: relasiError } = await supabase
      .from('orangtua_siswa')
      .insert(relasi)

    if (relasiError) throw new Error(relasiError.message)
  }

  return data as OrangTua
}

export async function updateOrangTua(
  id: string,
  input: UpdateOrangTuaInput
): Promise<OrangTua> {
  const supabase = createClient()
  const { siswa_ids, ...orangTuaData } = input

  // 1. Update orangtua
  const { data, error } = await supabase
    .from('orangtua')
    .update(orangTuaData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  // 2. Sync orangtua_siswa jika siswa_ids diberikan
  if (siswa_ids !== undefined) {
    // Hapus semua relasi lama
    const { error: deleteError } = await supabase
      .from('orangtua_siswa')
      .delete()
      .eq('orangtua_id', id)

    if (deleteError) throw new Error(deleteError.message)

    // Insert relasi baru
    if (siswa_ids.length > 0) {
      const relasi = siswa_ids.map((siswa_id) => ({
        orangtua_id: id,
        siswa_id,
        hubungan: 'ayah/ibu',
      }))

      const { error: insertError } = await supabase
        .from('orangtua_siswa')
        .insert(relasi)

      if (insertError) throw new Error(insertError.message)
    }
  }

  return data as OrangTua
}

export async function deleteOrangTua(id: string): Promise<void> {
  const supabase = createClient()
  // Cascade delete will handle orangtua_siswa via FK constraint
  const { error } = await supabase.from('orangtua').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Guru belum punya akun (untuk form Tambah Pengguna) ───────────────────────

export interface GuruTanpaAkun {
  id: string
  nama_lengkap: string
  email: string | null
  tipe: string
}

export async function getGuruTanpaAkun(): Promise<GuruTanpaAkun[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('guru')
    .select('id, nama_lengkap, email, tipe')
    .is('profile_id', null)
    .order('nama_lengkap', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as GuruTanpaAkun[]
}

export interface OrangTuaTanpaAkun {
  id: string
  nama_lengkap: string
  email: string | null
}

export async function getOrangTuaTanpaAkun(): Promise<OrangTuaTanpaAkun[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orangtua')
    .select('id, nama_lengkap, email')
    .is('profile_id', null)
    .order('nama_lengkap', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as OrangTuaTanpaAkun[]
}

// ─── Guru dengan filter unit dan mapel ────────────────────────────────────────

export interface GetGuruFilteredOptions {
  unit?: string
  mapel_id?: string
  search?: string
  page?: number
  pageSize?: number
}

export async function getGuruFiltered(
  options: GetGuruFilteredOptions = {}
): Promise<{ data: Guru[]; total: number }> {
  const supabase = createClient()
  const { unit, mapel_id, search, page = 1, pageSize = 10 } = options

  let query = supabase
    .from('guru')
    .select(
      '*, profiles(id, nama_lengkap, username, email, is_approved)',
      { count: 'exact' }
    )
    .order('nama_lengkap', { ascending: true })

  if (unit) query = query.contains('unit', [unit])
  if (mapel_id) query = query.contains('mapel_ids', [mapel_id])
  if (search) query = query.ilike('nama_lengkap', `%${search}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as Guru[],
    total: count ?? 0,
  }
}

// ─── OrangTua dengan filter unit anak ────────────────────────────────────────

export interface GetOrangTuaFilteredOptions {
  unit?: string
  kelas?: string
  search?: string
  page?: number
  pageSize?: number
}

export async function getOrangTuaFiltered(
  options: GetOrangTuaFilteredOptions = {}
): Promise<{ data: OrangTua[]; total: number }> {
  const supabase = createClient()
  const { unit, kelas, search, page = 1, pageSize = 10 } = options

  // Basis query dengan join
  let query = supabase
    .from('orangtua')
    .select(
      '*, profiles(id, nama_lengkap, username, email, is_approved), orangtua_siswa(id, siswa_id, hubungan, students(id, nama, kelas_id, unit, kelas(nama_kelas)))',
      { count: 'exact' }
    )
    .order('nama_lengkap', { ascending: true })

  if (search) query = query.ilike('nama_lengkap', `%${search}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  // Client-side filter untuk unit dan kelas (karena ini nested relation)
  let filtered = (data ?? []) as OrangTua[]
  if (unit || kelas) {
    filtered = filtered.filter((ortu) => {
      const anak = ortu.orangtua_siswa ?? []
      return anak.some((os) => {
        const matchUnit = unit ? os.students?.unit === unit : true
        const matchKelas = kelas ? os.students?.kelas?.nama_kelas === kelas : true
        return matchUnit && matchKelas
      })
    })
  }

  return {
    data: filtered,
    total: count ?? 0,
  }
}

// ─── Bulk insert guru ─────────────────────────────────────────────────────────

export async function bulkCreateGuru(
  items: CreateGuruInput[]
): Promise<Guru[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('guru')
    .insert(items)
    .select()

  if (error) throw new Error(error.message)
  return (data ?? []) as Guru[]
}

// ─── Bulk update guru ─────────────────────────────────────────────────────────

export async function bulkUpdateGuru(
  ids: string[],
  input: Partial<UpdateGuruInput>
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('guru')
    .update(input)
    .in('id', ids)

  if (error) throw new Error(error.message)
}

// ─── Bulk insert mata pelajaran ───────────────────────────────────────────────

export async function bulkCreateMapel(
  items: CreateMapelInput[]
): Promise<MataPelajaran[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('mata_pelajaran')
    .insert(items)
    .select()

  if (error) throw new Error(error.message)
  return (data ?? []) as MataPelajaran[]
}

// ─── Bulk update mata pelajaran ───────────────────────────────────────────────

export async function bulkUpdateMapel(
  ids: string[],
  input: Partial<UpdateMapelInput>
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('mata_pelajaran')
    .update(input)
    .in('id', ids)

  if (error) throw new Error(error.message)
}

// ─── Bulk insert orangtua ─────────────────────────────────────────────────────

export async function bulkCreateOrangTua(
  items: Omit<CreateOrangTuaInput, 'siswa_ids'>[]
): Promise<OrangTua[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orangtua')
    .insert(items)
    .select()

  if (error) throw new Error(error.message)
  return (data ?? []) as OrangTua[]
}

// ─── Kelas ────────────────────────────────────────────────────────────────────

export async function getKelas(
  options: GetKelasOptions = {}
): Promise<{ data: Kelas[]; total: number }> {
  const supabase = createClient()
  const { unit, search, page = 1, pageSize = 10 } = options

  let query = supabase
    .from('kelas')
    .select('*', { count: 'exact' })
    .order('nama_kelas', { ascending: true })

  if (unit) query = query.eq('unit', unit)
  if (search) query = query.ilike('nama_kelas', `%${search}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as Kelas[],
    total: count ?? 0,
  }
}

export async function createKelas(input: CreateKelasInput): Promise<Kelas> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kelas')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Kelas
}

export async function updateKelas(
  id: string,
  input: UpdateKelasInput
): Promise<Kelas> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kelas')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Kelas
}

export async function deleteKelas(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('kelas').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
