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
  kamar_ids?: string[]
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
  kamar_ids?: string[]
  unit?: string[]
  tipe?: TipeGuru
  email?: string
  no_hp?: string
  profile_id?: string | null
}

function roleFlags(tipe?: TipeGuru): { isGuru: boolean; isMusyrif: boolean } {
  const isGuru = tipe === 'guru' || tipe === 'guru_musyrif'
  const isMusyrif = tipe === 'musyrif' || tipe === 'guru_musyrif'
  return { isGuru, isMusyrif }
}

interface GuruRelations {
  unit: string[]
  mapel_ids: string[]
  kamar_ids: string[]
}

function normalizeGuruRelations(input: {
  tipe?: TipeGuru
  unit?: string[]
  mapel_ids?: string[]
  kamar_ids?: string[]
}): GuruRelations {
  const { isGuru, isMusyrif } = roleFlags(input.tipe)
  return {
    unit: isGuru || isMusyrif ? input.unit ?? [] : [],
    mapel_ids: isGuru ? input.mapel_ids ?? [] : [],
    kamar_ids: isMusyrif ? input.kamar_ids ?? [] : [],
  }
}

/** Kolom yang boleh ditulis ke tabel master `guru` — relasi kamar TIDAK termasuk. */
function buildGuruTableInsertPayload(
  input: CreateGuruInput,
  relations: GuruRelations,
  tipe: TipeGuru
): Record<string, unknown> {
  const { isGuru, isMusyrif } = roleFlags(tipe)
  const row: Record<string, unknown> = {
    nama_lengkap: input.nama_lengkap,
    nip: input.nip || null,
    jenis_kelamin: input.jenis_kelamin || null,
    tipe,
    email: input.email || null,
    no_hp: input.no_hp || null,
  }
  if (isGuru || isMusyrif) {
    row.unit = relations.unit
  }
  if (isGuru) {
    row.mapel_ids = relations.mapel_ids
  }
  return row
}

/** Update baris `guru` — tanpa kamar_ids; mapel_ids hanya untuk peran guru. */
function buildGuruTableUpdatePayload(
  input: UpdateGuruInput,
  relations: GuruRelations,
  tipe: TipeGuru
): Record<string, unknown> {
  const { isGuru, isMusyrif } = roleFlags(tipe)
  const row: Record<string, unknown> = {}

  if (input.nama_lengkap !== undefined) row.nama_lengkap = input.nama_lengkap
  if (input.nip !== undefined) row.nip = input.nip || null
  if (input.jenis_kelamin !== undefined) row.jenis_kelamin = input.jenis_kelamin || null
  if (input.tipe !== undefined) row.tipe = input.tipe
  if (input.email !== undefined) row.email = input.email || null
  if (input.no_hp !== undefined) row.no_hp = input.no_hp || null

  if (input.unit !== undefined || input.tipe !== undefined) {
    if (isGuru || isMusyrif) row.unit = relations.unit
  }
  if (input.mapel_ids !== undefined || input.tipe !== undefined) {
    if (isGuru) {
      row.mapel_ids = relations.mapel_ids
    } else if (input.tipe !== undefined) {
      row.mapel_ids = []
    }
  }

  return row
}

type GuruProfileJoin = {
  id?: string
  nama_lengkap?: string
  username?: string
  email?: string | null
  role?: string
  mapel_ids?: string[] | null
  kamar_ids?: string[] | null
  unit_mengajar?: Unit[] | null
}

/** Gabungkan relasi dari baris guru + profil auth (kamar & mapel profil). */
function enrichGuruRow(
  row: Guru & { profiles?: GuruProfileJoin | null },
  relationsOverride?: GuruRelations
): Guru {
  const profile = row.profiles
  const { isGuru, isMusyrif } = roleFlags(row.tipe)
  const relations =
    relationsOverride ??
    normalizeGuruRelations({
      tipe: row.tipe,
      unit: (row.unit as string[] | undefined) ?? (profile?.unit_mengajar as string[] | undefined),
      mapel_ids: isGuru
        ? ((row.mapel_ids as string[] | undefined) ?? profile?.mapel_ids ?? undefined)
        : [],
      kamar_ids: isMusyrif ? (profile?.kamar_ids ?? undefined) : [],
    })

  return {
    ...row,
    unit: relations.unit,
    mapel_ids: relations.mapel_ids,
    kamar_ids: relations.kamar_ids,
  }
}

/** Simpan mapel_ids & kamar_ids ke tabel `profiles` (bukan ke master `guru`). */
async function syncGuruRelationsToProfile(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  tipe: TipeGuru,
  relations: GuruRelations,
  input: Pick<UpdateGuruInput, 'nama_lengkap' | 'email' | 'tipe' | 'unit' | 'mapel_ids' | 'kamar_ids'>
): Promise<void> {
  const { isGuru, isMusyrif } = roleFlags(tipe)
  const profilePayload: Record<string, unknown> = {}

  if (input.nama_lengkap !== undefined) profilePayload.nama_lengkap = input.nama_lengkap
  if (input.email !== undefined) profilePayload.email = input.email || null

  if (input.tipe !== undefined) {
    profilePayload.tipe_role = tipe as TipeRole
    profilePayload.is_musyrif = isMusyrif
  }

  if (input.unit !== undefined || input.tipe !== undefined) {
    if (isGuru || isMusyrif) profilePayload.unit_mengajar = relations.unit
  }

  if (input.mapel_ids !== undefined || input.tipe !== undefined) {
    profilePayload.mapel_ids = isGuru ? relations.mapel_ids : []
    profilePayload.is_multi_mapel = isGuru && relations.mapel_ids.length > 1
  }

  if (input.kamar_ids !== undefined || input.tipe !== undefined) {
    profilePayload.kamar_ids = isMusyrif ? relations.kamar_ids : []
  }

  if (Object.keys(profilePayload).length === 0) return

  const { error } = await supabase.from('profiles').update(profilePayload).eq('id', profileId)
  if (error) throw new Error(error.message)
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
    .select(
      '*, profiles(id, nama_lengkap, username, email, role, mapel_ids, kamar_ids, unit_mengajar)',
      { count: 'exact' }
    )
    .order('nama_lengkap', { ascending: true })

  if (search) query = query.ilike('nama_lengkap', `%${search}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  const filteredData = (data ?? [])
    .filter((item) => {
      const guruItem = item as Guru & { profiles?: { role?: string } | null }
      return guruItem.profiles?.role !== 'superadmin'
    })
    .map((item) => enrichGuruRow(item as Guru & { profiles?: GuruProfileJoin | null })) as Guru[]

  const excludedCount = (data ?? []).length - filteredData.length
  const total = (count ?? 0) - excludedCount

  return {
    data: filteredData,
    total,
  }
}

export async function createGuru(input: CreateGuruInput): Promise<Guru> {
  const supabase = createClient()
  const tipe = input.tipe || 'guru'
  const relations = normalizeGuruRelations({ ...input, tipe })
  const payload = buildGuruTableInsertPayload(input, relations, tipe)

  const { data, error } = await supabase
    .from('guru')
    .insert(payload)
    .select('*, profiles(id, mapel_ids, kamar_ids, unit_mengajar)')
    .single()

  if (error) throw new Error(error.message)

  const guruRow = data as Guru & { profiles?: GuruProfileJoin | null }

  if (guruRow.profile_id) {
    await syncGuruRelationsToProfile(supabase, guruRow.profile_id, tipe, relations, input)
  }

  return enrichGuruRow(guruRow, relations)
}

export async function updateGuru(
  id: string,
  input: UpdateGuruInput
): Promise<Guru> {
  const supabase = createClient()

  const { data: currentGuru } = await supabase
    .from('guru')
    .select('profile_id, tipe, unit, mapel_ids')
    .eq('id', id)
    .single()

  const effectiveTipe = (input.tipe ?? currentGuru?.tipe ?? 'guru') as TipeGuru
  const profileId =
    input.profile_id !== undefined ? input.profile_id : currentGuru?.profile_id

  let profileKamarIds: string[] | undefined
  if (profileId && input.kamar_ids === undefined) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('kamar_ids')
      .eq('id', profileId)
      .maybeSingle()
    profileKamarIds = (profileRow?.kamar_ids as string[] | undefined) ?? []
  }

  const relations = normalizeGuruRelations({
    tipe: effectiveTipe,
    unit: input.unit ?? (currentGuru?.unit as string[] | undefined),
    mapel_ids: input.mapel_ids ?? (currentGuru?.mapel_ids as string[] | undefined),
    kamar_ids: input.kamar_ids ?? profileKamarIds,
  })

  const payload = buildGuruTableUpdatePayload(input, relations, effectiveTipe)

  const updateGuruPromise = supabase
    .from('guru')
    .update(payload)
    .eq('id', id)
    .select('*, profiles(id, mapel_ids, kamar_ids, unit_mengajar)')
    .single()

  if (profileId) {
    await syncGuruRelationsToProfile(supabase, profileId, effectiveTipe, relations, input)
    const guruResult = await updateGuruPromise
    if (guruResult.error) throw new Error(guruResult.error.message)
    return enrichGuruRow(guruResult.data as Guru & { profiles?: GuruProfileJoin | null }, relations)
  }

  const guruResult = await updateGuruPromise
  if (guruResult.error) throw new Error(guruResult.error.message)
  return enrichGuruRow(
    guruResult.data as Guru & { profiles?: GuruProfileJoin | null },
    relations
  )
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
    .select('*, profiles(id, mapel_ids, kamar_ids, unit_mengajar)')
    .single()

  if (error) throw new Error(error.message)

  if (data) {
    const guruRow = data as Guru & { profiles?: GuruProfileJoin | null }
    const relations = normalizeGuruRelations({
      tipe: guruRow.tipe,
      unit: (guruRow.unit as string[] | undefined) ?? undefined,
      mapel_ids: (guruRow.mapel_ids as string[] | undefined) ?? undefined,
      kamar_ids: guruRow.profiles?.kamar_ids ?? undefined,
    })
    await syncGuruRelationsToProfile(supabase, profileId, guruRow.tipe, relations, {
      nama_lengkap: guruRow.nama_lengkap,
      email: guruRow.email ?? undefined,
      tipe: guruRow.tipe,
      unit: relations.unit,
      mapel_ids: relations.mapel_ids,
      kamar_ids: relations.kamar_ids,
    })
    return enrichGuruRow({ ...guruRow, profile_id: profileId }, relations)
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
