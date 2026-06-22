import { createClient } from '@/lib/supabase/client'
import type { JenisKelamin, Student, Unit, MataPelajaran } from '@/lib/supabase/types'

export interface CreateStudentInput {
  nama: string
  kelas?: string | null
  kelas_id?: string | null
  jenis_kelamin: JenisKelamin
  unit: Unit
  kamar_id?: string | null
  kamar?: string
  nomor_induk?: string
  orangtua_id?: string | null
  orang_tua?: string
}

export interface UpdateStudentInput {
  nama?: string
  kelas?: string | null
  kelas_id?: string | null
  jenis_kelamin?: JenisKelamin
  kamar_id?: string | null
  kamar?: string
  nomor_induk?: string
  is_alumni?: boolean
  orangtua_id?: string | null
  orang_tua?: string
}

export interface GetStudentsOptions {
  search?: string
  kelas?: string
  unit?: Unit
  page?: number
  pageSize?: number
  sortField?: string
  sortDirection?: 'asc' | 'desc'
}

export async function getStudents(
  unit: Unit,
  options?: GetStudentsOptions
): Promise<{ data: Student[]; total: number }> {
  const supabase = createClient()
  const page = options?.page ?? 1
  const pageSize = options?.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortField = options?.sortField ?? 'nama'
  const ascending = options?.sortDirection !== 'desc'

  let kelasIdFilter: string | null = null
  if (options?.kelas) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.kelas)
    if (!isUuid) {
      const { data: kelasRow } = await supabase
        .from('kelas')
        .select('id')
        .eq('nama_kelas', options.kelas)
        .eq('unit', unit)
        .maybeSingle()
      if (kelasRow) {
        kelasIdFilter = kelasRow.id
      }
    } else {
      kelasIdFilter = options.kelas
    }
  }

  let countQuery = supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('unit', unit)
    .eq('is_alumni', false)

  if (options?.search) {
    countQuery = countQuery.ilike('nama', `%${options.search}%`)
  }

  if (kelasIdFilter) {
    countQuery = countQuery.eq('kelas_id', kelasIdFilter)
  }

  const { count, error: countError } = await countQuery

  if (countError) throw new Error(countError.message)

  let dataQuery = supabase
    .from('students')
    .select('*, kelas(nama_kelas), orangtua_siswa(orangtua_id, hubungan, orangtua(nama_lengkap))')
    .eq('unit', unit)
    .eq('is_alumni', false)

  if (options?.search) {
    dataQuery = dataQuery.ilike('nama', `%${options.search}%`)
  }

  if (kelasIdFilter) {
    dataQuery = dataQuery.eq('kelas_id', kelasIdFilter)
  }

  const { data, error } = await dataQuery
    .order(sortField, { ascending })
    .range(from, to)

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as Student[],
    total: count ?? 0,
  }
}

export async function getAlumniStudents(
  options?: GetStudentsOptions
): Promise<{ data: Student[]; total: number }> {
  const supabase = createClient()
  const page = options?.page ?? 1
  const pageSize = options?.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortField = options?.sortField ?? 'nama'
  const ascending = options?.sortDirection !== 'desc'

  let kelasIdsFilter: string[] = []
  if (options?.kelas) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.kelas)
    if (!isUuid) {
      let query = supabase.from('kelas').select('id').eq('nama_kelas', options.kelas)
      if (options?.unit) {
        query = query.eq('unit', options.unit)
      }
      const { data: kelasRows } = await query
      if (kelasRows && kelasRows.length > 0) {
        kelasIdsFilter = kelasRows.map((r) => r.id)
      }
    } else {
      kelasIdsFilter = [options.kelas]
    }
  }

  let countQuery = supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('is_alumni', true)

  if (options?.unit) {
    countQuery = countQuery.eq('unit', options.unit)
  }

  if (options?.search) {
    countQuery = countQuery.ilike('nama', `%${options.search}%`)
  }

  if (options?.kelas) {
    if (kelasIdsFilter.length > 0) {
      countQuery = countQuery.in('kelas_id', kelasIdsFilter)
    }
  }

  const { count, error: countError } = await countQuery

  if (countError) throw new Error(countError.message)

  let dataQuery = supabase
    .from('students')
    .select('*, kelas(nama_kelas), orangtua_siswa(orangtua_id, hubungan, orangtua(nama_lengkap))')
    .eq('is_alumni', true)

  if (options?.unit) {
    dataQuery = dataQuery.eq('unit', options.unit)
  }

  if (options?.search) {
    dataQuery = dataQuery.ilike('nama', `%${options.search}%`)
  }

  if (options?.kelas) {
    if (kelasIdsFilter.length > 0) {
      dataQuery = dataQuery.in('kelas_id', kelasIdsFilter)
    }
  }

  const { data, error } = await dataQuery
    .order(sortField, { ascending })
    .range(from, to)

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as Student[],
    total: count ?? 0,
  }
}

export async function createStudent(
  data: CreateStudentInput
): Promise<Student> {
  const supabase = createClient()

  let finalKamarId = data.kamar_id || null

  if (!finalKamarId && data.kamar) {
    const { data: kamarData } = await supabase
      .from('kamar')
      .select('id')
      .ilike('nama_kamar', data.kamar.trim())
      .maybeSingle()
    if (kamarData) {
      finalKamarId = kamarData.id
    }
  }

  const { kamar: _, orang_tua: __, orangtua_id: selectedOrangTuaId, kelas: ___, ...rest } = data
  const { data: result, error } = await supabase
    .from('students')
    .insert({ ...rest, kamar_id: finalKamarId, is_alumni: false })
    .select('*, kelas(nama_kelas)')
    .single()

  if (error) throw new Error(error.message)

  if (selectedOrangTuaId) {
    const { error: relasiError } = await supabase
      .from('orangtua_siswa')
      .insert({
        siswa_id: result.id,
        orangtua_id: selectedOrangTuaId,
        hubungan: 'Ortu',
      })
    if (relasiError) throw new Error(relasiError.message)
  }

  return result as Student
}

export async function updateStudent(
  id: string,
  data: UpdateStudentInput
): Promise<Student> {
  const supabase = createClient()

  let finalKamarId = data.kamar_id !== undefined ? (data.kamar_id === '' ? null : data.kamar_id) : undefined

  if (finalKamarId === undefined && data.kamar) {
    const { data: kamarData } = await supabase
      .from('kamar')
      .select('id')
      .ilike('nama_kamar', data.kamar.trim())
      .maybeSingle()
    if (kamarData) {
      finalKamarId = kamarData.id
    } else {
      finalKamarId = null
    }
  }

  const { kamar: _, orang_tua: __, orangtua_id: selectedOrangTuaId, kelas: ___, ...rest } = data
  const updatePayload: any = { ...rest }
  if (finalKamarId !== undefined) {
    updatePayload.kamar_id = finalKamarId
  }

  const { data: result, error } = await supabase
    .from('students')
    .update(updatePayload)
    .eq('id', id)
    .select('*, kelas(nama_kelas)')
    .single()

  if (error) throw new Error(error.message)

  if (selectedOrangTuaId !== undefined) {
    const { error: deleteError } = await supabase
      .from('orangtua_siswa')
      .delete()
      .eq('siswa_id', id)

    if (deleteError) throw new Error(deleteError.message)

    if (selectedOrangTuaId !== null) {
      const { error: relasiError } = await supabase
        .from('orangtua_siswa')
        .insert({
          siswa_id: id,
          orangtua_id: selectedOrangTuaId,
          hubungan: 'Ortu',
        })
      if (relasiError) throw new Error(relasiError.message)
    }
  }

  return result as Student
}

export async function restoreStudent(id: string): Promise<Student> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('students')
    .update({ is_alumni: false })
    .eq('id', id)
    .select('*, kelas(nama_kelas)')
    .single()

  if (error) throw new Error(error.message)

  return result as Student
}

export async function deleteStudents(ids: string[]): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('students').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

export async function bulkUpdateStudents(
  ids: string[],
  data: {
    kelas?: string | null
    kelas_id?: string | null
    unit?: Unit
    jenis_kelamin?: JenisKelamin
    kamar_id?: string | null
    kamar?: string
    nomor_induk?: string
    orangtua_id?: string | null
    orang_tua?: string
  }
): Promise<void> {
  const supabase = createClient()

  let finalKamarId = data.kamar_id !== undefined ? (data.kamar_id === '' ? null : data.kamar_id) : undefined

  if (finalKamarId === undefined && data.kamar) {
    const { data: kamarData } = await supabase
      .from('kamar')
      .select('id')
      .ilike('nama_kamar', data.kamar.trim())
      .maybeSingle()
    if (kamarData) {
      finalKamarId = kamarData.id
    } else {
      finalKamarId = null
    }
  }

  let finalOrangTuaId = data.orangtua_id !== undefined ? (data.orangtua_id === '' ? null : data.orangtua_id) : undefined
  if (finalOrangTuaId === undefined && data.orang_tua) {
    const { data: otData } = await supabase
      .from('orangtua')
      .select('id')
      .ilike('nama_lengkap', data.orang_tua.trim())
      .maybeSingle()
    if (otData) {
      finalOrangTuaId = otData.id
    } else {
      finalOrangTuaId = null
    }
  }

  const { kamar: _, orang_tua: __, orangtua_id: ___, kelas: ____, ...rest } = data
  const updatePayload: any = { ...rest }
  if (finalKamarId !== undefined) {
    updatePayload.kamar_id = finalKamarId
  }

  const { error } = await supabase.from('students').update(updatePayload).in('id', ids)

  if (error) throw new Error(error.message)

  if (finalOrangTuaId !== undefined) {
    const { error: deleteError } = await supabase
      .from('orangtua_siswa')
      .delete()
      .in('siswa_id', ids)

    if (deleteError) throw new Error(deleteError.message)

    if (finalOrangTuaId !== null) {
      const relasi = ids.map((siswa_id) => ({
        siswa_id,
        orangtua_id: finalOrangTuaId as string,
        hubungan: 'Ortu',
      }))

      const { error: insertError } = await supabase
        .from('orangtua_siswa')
        .insert(relasi)

      if (insertError) throw new Error(insertError.message)
    }
  }
}

export async function bulkCreateStudents(
  data: CreateStudentInput[]
): Promise<Student[]> {
  const supabase = createClient()

  const { data: kamarList, error: kamarErr } = await supabase
    .from('kamar')
    .select('id, nama_kamar')

  if (kamarErr) throw new Error(kamarErr.message)

  const kamarMap = new Map<string, string>()
  if (kamarList) {
    kamarList.forEach((k) => {
      kamarMap.set(k.nama_kamar.trim().toLowerCase(), k.id)
    })
  }

  const { data: orangTuaList, error: otErr } = await supabase
    .from('orangtua')
    .select('id, nama_lengkap')

  if (otErr) throw new Error(otErr.message)

  const orangTuaMap = new Map<string, string>()
  if (orangTuaList) {
    orangTuaList.forEach((ot) => {
      orangTuaMap.set(ot.nama_lengkap.trim().toLowerCase(), ot.id)
    })
  }

  const { data: kelasList, error: kelasErr } = await supabase
    .from('kelas')
    .select('id, nama_kelas, unit')

  if (kelasErr) throw new Error(kelasErr.message)

  const kelasMap = new Map<string, string>()
  if (kelasList) {
    kelasList.forEach((k) => {
      kelasMap.set(`${k.nama_kelas.trim().toLowerCase()}_${k.unit}`, k.id)
    })
  }

  const mappedData = data.map((item) => {
    let finalKamarId = item.kamar_id || null

    if (!finalKamarId && item.kamar) {
      const trimmedKamar = item.kamar.trim().toLowerCase()
      finalKamarId = kamarMap.get(trimmedKamar) || null
    }

    let finalKelasId = item.kelas_id || null
    if (!finalKelasId && item.kelas) {
      const trimmedKelas = item.kelas.trim().toLowerCase()
      const key = `${trimmedKelas}_${item.unit}`
      finalKelasId = kelasMap.get(key) || null
    }

    const { kamar: _, orang_tua: __, orangtua_id: ___, kelas: ____, ...rest } = item
    return {
      ...rest,
      kelas_id: finalKelasId,
      kamar_id: finalKamarId,
      is_alumni: false,
    }
  })

  const { data: result, error } = await supabase
    .from('students')
    .insert(mappedData)
    .select('*, kelas(nama_kelas)')

  if (error) throw new Error(error.message)

  const results = (result ?? []) as Student[]

  const relasiEntries: { orangtua_id: string; siswa_id: string; hubungan: string }[] = []
  results.forEach((siswa, idx) => {
    const inputItem = data[idx]
    let finalOrangTuaId = inputItem.orangtua_id || null
    if (!finalOrangTuaId && inputItem.orang_tua) {
      const trimmedOT = inputItem.orang_tua.trim().toLowerCase()
      finalOrangTuaId = orangTuaMap.get(trimmedOT) || null
    }
    if (finalOrangTuaId) {
      relasiEntries.push({
        siswa_id: siswa.id,
        orangtua_id: finalOrangTuaId,
        hubungan: 'Ortu',
      })
    }
  })

  if (relasiEntries.length > 0) {
    const { error: relasiError } = await supabase
      .from('orangtua_siswa')
      .insert(relasiEntries)

    if (relasiError) throw new Error(relasiError.message)
  }

  return results;
}

export interface KelasOption {
  value: string
  label: string
}

export async function getKelasOptionsByUnits(
  units?: Unit[]
): Promise<KelasOption[]> {
  const supabase = createClient()

  let query = supabase.from('kelas').select('nama_kelas')

  if (units && units.length > 0) {
    query = query.in('unit', units)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  const uniqueKelas = [
    ...new Set(
      (data ?? [])
        .map((row) => row.nama_kelas)
        .filter(
          (kelas): kelas is string =>
            typeof kelas === 'string' && kelas.length > 0
        )
    ),
  ].sort((a, b) => a.localeCompare(b, 'id'))

  return uniqueKelas.map((kelas) => ({
    value: kelas,
    label: kelas,
  }))
}

export async function getStudentClasses(unit: Unit): Promise<string[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kelas')
    .select('nama_kelas')
    .eq('unit', unit)

  if (error) throw new Error(error.message)

  const classes = [
    ...new Set(
      (data ?? [])
        .map((row) => row.nama_kelas)
        .filter(
          (kelas): kelas is string =>
            typeof kelas === 'string' && kelas.length > 0
        )
    ),
  ]

  return classes.sort((a, b) => a.localeCompare(b, 'id'))
}

export async function searchStudents(
  query: string,
  unit?: Unit
): Promise<Student[]> {
  const supabase = createClient()

  let searchQuery = supabase
    .from('students')
    .select('id, nama, kelas_id, unit, kelas(nama_kelas)')
    .ilike('nama', `%${query}%`)
    .eq('is_alumni', false)
    .limit(10)

  if (unit) {
    searchQuery = searchQuery.eq('unit', unit)
  }

  const { data, error } = await searchQuery

  if (error) throw new Error(error.message)

  return (data ?? []) as unknown as Student[]
}

export async function getKamarOptions(units?: string[]): Promise<{ id: string; nama_kamar: string; unit?: string; jenis_kelamin?: string }[]> {
  const supabase = createClient()
  if (units && units.length === 0) return []

  let query = supabase
    .from('kamar')
    .select('id, nama_kamar, unit, jenis_kelamin')
    .order('nama_kamar', { ascending: true })

  if (units && units.length > 0) {
    query = query.in('unit', units)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; nama_kamar: string; unit?: string; jenis_kelamin?: string }[]
}

export async function getMataKuliah(units: string[]): Promise<MataPelajaran[]> {
  const supabase = createClient()
  if (!units || units.length === 0) return []

  const { data, error } = await supabase
    .from('mata_pelajaran')
    .select('*')
    .in('unit', units)
    .order('nama_mapel', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as MataPelajaran[]
}

export async function getOrangTuaOptions(): Promise<{ id: string; nama_lengkap: string }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('orangtua')
    .select('id, nama_lengkap')
    .order('nama_lengkap', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; nama_lengkap: string }[]
}
