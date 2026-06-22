import { createClient } from '@/lib/supabase/client'
import type {
  Divisi,
  KategoriDisiplin,
  Kedisiplinan,
  Pasal,
  StatusKedisiplinan,
  Tindakan,
  Unit,
} from '@/lib/supabase/types'

export interface CreateKedisiplinanInput {
  tanggal: string
  diberikan_oleh: string
  siswa_id: string
  kategori_id: string
  divisi_id: string
  pasal_id: string
  tindakan_id: string
  status: StatusKedisiplinan
}

export interface KedisiplinanFilters {
  tahun?: number[]
  unit?: Unit[]
  kategori_id?: string[]
  divisi_id?: string[]
  status?: StatusKedisiplinan[]
  tanggalDari?: string
  tanggalSampai?: string
  search?: string
  page?: number
  pageSize?: number
  sortField?: string
  sortDirection?: 'asc' | 'desc'
}

export interface KedisiplinanDashboardFilters {
  tahun?: number[]
  unit?: Unit[]
  kelas?: string[]
  kategori_id?: string[]
  divisi_id?: string[]
}

export interface KedisiplinanDashboardResult {
  totalKasus: number
  belumDiproses: number
  pending: number
  sudahDiproses: number
  trenBulanan: { bulan: string; count: number }[]
  perKategori: { nama_kategori: string; count: number }[]
  perDivisi: { nama_divisi: string; count: number }[]
  perStatus: { status: string; count: number }[]
}

const KEDISIPLINAN_SELECT = `
  *,
  students(id,nama,kelas_id,unit,kelas(nama_kelas)),
  kategori_disiplin(id,nama_kategori),
  divisi(id,nama_divisi,unit),
  pasal(id,nama_pasal,poin),
  tindakan(id,nama_tindakan)
`

const ALLOWED_SORT_FIELDS = [
  'tanggal',
  'diberikan_oleh',
  'status',
  'created_at',
  'siswa_id',
  'kategori_id',
  'divisi_id',
  'pasal_id',
  'tindakan_id',
] as const

type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number]

type Relation<T> = T | T[] | null | undefined

interface StudentIdRow {
  id: string
}

interface KedisiplinanAggregateRow {
  tanggal: string
  status: StatusKedisiplinan
  kategori_disiplin: Relation<{ nama_kategori: string }>
  divisi: Relation<{ nama_divisi: string; unit: Unit | null }>
}

function unwrapRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
}

function resolveSortField(sortField?: string): AllowedSortField {
  if (
    sortField &&
    ALLOWED_SORT_FIELDS.includes(sortField as AllowedSortField)
  ) {
    return sortField as AllowedSortField
  }
  return 'tanggal'
}

async function getFilteredStudentIds(
  filters?: Pick<KedisiplinanFilters, 'unit' | 'search'> & { kelas?: string[] }
): Promise<string[] | null> {
  const hasUnitFilter = Boolean(filters?.unit && filters.unit.length > 0)
  const hasSearchFilter = Boolean(filters?.search && filters.search.length > 0)
  const hasKelasFilter = Boolean(filters?.kelas && filters.kelas.length > 0)

  if (!hasUnitFilter && !hasSearchFilter && !hasKelasFilter) {
    return null
  }

  const supabase = createClient()
  let query = supabase.from('students').select('id')

  if (hasUnitFilter && filters?.unit) {
    query = query.in('unit', filters.unit)
  }

  if (hasKelasFilter && filters?.kelas) {
    // kelas_ids is array of kelas UUIDs — resolve nama_kelas to IDs if needed
    const kelasIds = filters.kelas
    query = query.in('kelas_id', kelasIds)
  }

  if (hasSearchFilter && filters?.search) {
    query = query.ilike('nama', `%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => (row as StudentIdRow).id)
}

type KedisiplinanTableFilterInput = Pick<
  KedisiplinanFilters,
  | 'tahun'
  | 'kategori_id'
  | 'divisi_id'
  | 'status'
  | 'tanggalDari'
  | 'tanggalSampai'
>

// Supabase query builder chaining — pola sama seperti students.ts
function applyKedisiplinanTableFilters<
  Q extends {
    in: (column: string, values: string[] | StatusKedisiplinan[]) => Q
    gte: (column: string, value: string) => Q
    lte: (column: string, value: string) => Q
    or: (filters: string) => Q
  },
>(
  query: Q,
  filters?: KedisiplinanTableFilterInput,
  studentIds?: string[] | null
): Q {
  let nextQuery = query

  if (studentIds) {
    nextQuery = nextQuery.in('siswa_id', studentIds)
  }

  if (filters?.kategori_id && filters.kategori_id.length > 0) {
    nextQuery = nextQuery.in('kategori_id', filters.kategori_id)
  }

  if (filters?.divisi_id && filters.divisi_id.length > 0) {
    nextQuery = nextQuery.in('divisi_id', filters.divisi_id)
  }

  if (filters?.status && filters.status.length > 0) {
    nextQuery = nextQuery.in('status', filters.status)
  }

  if (filters?.tanggalDari) {
    nextQuery = nextQuery.gte('tanggal', filters.tanggalDari)
  }

  if (filters?.tanggalSampai) {
    nextQuery = nextQuery.lte('tanggal', filters.tanggalSampai)
  }

  if (filters?.tahun && filters.tahun.length > 0) {
    if (filters.tahun.length === 1) {
      nextQuery = nextQuery
        .gte('tanggal', `${filters.tahun[0]}-01-01`)
        .lte('tanggal', `${filters.tahun[0]}-12-31`)
    } else {
      const orClause = filters.tahun
        .map(
          (year) =>
            `and(tanggal.gte.${year}-01-01,tanggal.lte.${year}-12-31)`
        )
        .join(',')
      nextQuery = nextQuery.or(orClause)
    }
  }

  return nextQuery
}

export async function getKedisiplinan(
  filters?: KedisiplinanFilters
): Promise<{ data: Kedisiplinan[]; total: number }> {
  const supabase = createClient()
  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortField = resolveSortField(filters?.sortField)
  const ascending = filters?.sortDirection !== 'desc'

  const studentIds = await getFilteredStudentIds(filters)

  if (studentIds && studentIds.length === 0) {
    return { data: [], total: 0 }
  }

  let countQuery = supabase
    .from('kedisiplinan')
    .select('*', { count: 'exact', head: true })

  countQuery = applyKedisiplinanTableFilters(
    countQuery,
    filters,
    studentIds
  )

  const { count, error: countError } = await countQuery

  if (countError) throw new Error(countError.message)

  let dataQuery = supabase
    .from('kedisiplinan')
    .select(KEDISIPLINAN_SELECT)

  dataQuery = applyKedisiplinanTableFilters(dataQuery, filters, studentIds)

  const { data, error } = await dataQuery
    .order(sortField, { ascending })
    .range(from, to)

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as Kedisiplinan[],
    total: count ?? 0,
  }
}

export async function createKedisiplinan(
  data: CreateKedisiplinanInput
): Promise<Kedisiplinan> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('kedisiplinan')
    .insert(data)
    .select(KEDISIPLINAN_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return result as Kedisiplinan
}

export async function updateKedisiplinan(
  id: string,
  data: Partial<CreateKedisiplinanInput>
): Promise<Kedisiplinan> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('kedisiplinan')
    .update(data)
    .eq('id', id)
    .select(KEDISIPLINAN_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return result as Kedisiplinan
}

export async function deleteKedisiplinan(ids: string[]): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('kedisiplinan').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

export async function bulkCreateKedisiplinan(
  data: CreateKedisiplinanInput[]
): Promise<Kedisiplinan[]> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('kedisiplinan')
    .insert(data)
    .select(KEDISIPLINAN_SELECT)

  if (error) throw new Error(error.message)

  return (result ?? []) as Kedisiplinan[]
}

export async function getKedisiplinanDashboard(
  filters?: KedisiplinanDashboardFilters
): Promise<KedisiplinanDashboardResult> {
  const supabase = createClient()

  const studentIds = await getFilteredStudentIds({
    unit: filters?.unit,
    kelas: filters?.kelas,
  })

  if (studentIds && studentIds.length === 0) {
    return {
      totalKasus: 0,
      belumDiproses: 0,
      pending: 0,
      sudahDiproses: 0,
      trenBulanan: [],
      perKategori: [],
      perDivisi: [],
      perStatus: [],
    }
  }

  let dashboardQuery = supabase
    .from('kedisiplinan')
    .select(
      'tanggal, status, kategori_disiplin(nama_kategori), divisi(nama_divisi,unit)'
    )

  if (studentIds) {
    dashboardQuery = dashboardQuery.in('siswa_id', studentIds)
  }

  if (filters?.kategori_id && filters.kategori_id.length > 0) {
    dashboardQuery = dashboardQuery.in('kategori_id', filters.kategori_id)
  }

  if (filters?.divisi_id && filters.divisi_id.length > 0) {
    dashboardQuery = dashboardQuery.in('divisi_id', filters.divisi_id)
  }

  if (filters?.tahun && filters.tahun.length > 0) {
    if (filters.tahun.length === 1) {
      dashboardQuery = dashboardQuery
        .gte('tanggal', `${filters.tahun[0]}-01-01`)
        .lte('tanggal', `${filters.tahun[0]}-12-31`)
    } else {
      const orClause = filters.tahun
        .map(
          (year) =>
            `and(tanggal.gte.${year}-01-01,tanggal.lte.${year}-12-31)`
        )
        .join(',')
      dashboardQuery = dashboardQuery.or(orClause)
    }
  }

  const { data, error } = await dashboardQuery

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as KedisiplinanAggregateRow[]

  let belumDiproses = 0
  let pending = 0
  let sudahDiproses = 0

  const bulanMap = new Map<string, number>()
  const kategoriMap = new Map<string, number>()
  const divisiMap = new Map<string, number>()
  const statusMap = new Map<string, number>()

  for (const row of rows) {
    if (row.status === 'Belum Diproses') belumDiproses++
    else if (row.status === 'Pending') pending++
    else if (row.status === 'Sudah Diproses') sudahDiproses++

    const bulan = row.tanggal.substring(0, 7)
    bulanMap.set(bulan, (bulanMap.get(bulan) ?? 0) + 1)

    const kategori = unwrapRelation(row.kategori_disiplin)
    if (kategori?.nama_kategori) {
      kategoriMap.set(
        kategori.nama_kategori,
        (kategoriMap.get(kategori.nama_kategori) ?? 0) + 1
      )
    }

    const divisi = unwrapRelation(row.divisi)
    if (divisi?.nama_divisi) {
      const divisiKey = divisi.unit
        ? `${divisi.nama_divisi} ${divisi.unit}`
        : divisi.nama_divisi
      divisiMap.set(divisiKey, (divisiMap.get(divisiKey) ?? 0) + 1)
    }

    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1)
  }

  const trenBulanan = Array.from(bulanMap.entries())
    .map(([bulan, count]) => ({ bulan, count }))
    .sort((a, b) => a.bulan.localeCompare(b.bulan))

  const perKategori = Array.from(kategoriMap.entries())
    .map(([nama_kategori, count]) => ({ nama_kategori, count }))
    .sort((a, b) => b.count - a.count)

  const perDivisi = Array.from(divisiMap.entries())
    .map(([nama_divisi, count]) => ({ nama_divisi, count }))
    .sort((a, b) => b.count - a.count)

  const perStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }))

  return {
    totalKasus: rows.length,
    belumDiproses,
    pending,
    sudahDiproses,
    trenBulanan,
    perKategori,
    perDivisi,
    perStatus,
  }
}

export async function getKategoriDisiplin(): Promise<KategoriDisiplin[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kategori_disiplin')
    .select('*')
    .order('nama_kategori', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as KategoriDisiplin[]
}

export async function getDivisi(unit?: Unit): Promise<Divisi[]> {
  const supabase = createClient()

  let query = supabase.from('divisi').select('*')

  if (unit) {
    query = query.eq('unit', unit)
  }

  const { data, error } = await query.order('nama_divisi', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as Divisi[]
}

export async function getPasalByKategori(kategoriId: string): Promise<Pasal[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('pasal')
    .select('*')
    .eq('kategori_id', kategoriId)
    .order('nama_pasal', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as Pasal[]
}

export async function getTindakanByKategori(
  kategoriId: string
): Promise<Tindakan[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tindakan')
    .select('*')
    .eq('kategori_id', kategoriId)
    .order('nama_tindakan', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as Tindakan[]
}

export async function searchKategoriDisiplin(
  query: string
): Promise<KategoriDisiplin[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kategori_disiplin')
    .select('*')
    .ilike('nama_kategori', `%${query}%`)
    .limit(10)

  if (error) throw new Error(error.message)

  return (data ?? []) as KategoriDisiplin[]
}

export async function searchDivisi(query: string): Promise<Divisi[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('divisi')
    .select('*')
    .ilike('nama_divisi', `%${query}%`)
    .limit(10)

  if (error) throw new Error(error.message)

  return (data ?? []) as Divisi[]
}

export async function searchPasal(
  query: string,
  kategoriId: string
): Promise<Pasal[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('pasal')
    .select('*')
    .eq('kategori_id', kategoriId)
    .ilike('nama_pasal', `%${query}%`)
    .limit(10)

  if (error) throw new Error(error.message)

  return (data ?? []) as Pasal[]
}

export async function searchTindakan(
  query: string,
  kategoriId: string
): Promise<Tindakan[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tindakan')
    .select('*')
    .eq('kategori_id', kategoriId)
    .ilike('nama_tindakan', `%${query}%`)
    .limit(10)

  if (error) throw new Error(error.message)

  return (data ?? []) as Tindakan[]
}

export async function createKategoriDisiplin(
  nama_kategori: string
): Promise<KategoriDisiplin> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kategori_disiplin')
    .insert({ nama_kategori })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as KategoriDisiplin
}

export async function updateKategoriDisiplin(
  id: string,
  nama_kategori: string
): Promise<KategoriDisiplin> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kategori_disiplin')
    .update({ nama_kategori })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as KategoriDisiplin
}

export async function deleteKategoriDisiplin(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('kategori_disiplin')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function createDivisi(data: {
  nama_divisi: string
  unit: Unit
}): Promise<Divisi> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('divisi')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return result as Divisi
}

export async function updateDivisi(
  id: string,
  data: Partial<{ nama_divisi: string; unit: Unit }>
): Promise<Divisi> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('divisi')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return result as Divisi
}

export async function deleteDivisi(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('divisi').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

export async function createPasal(data: {
  nama_pasal: string
  kategori_id: string
  poin: number
}): Promise<Pasal> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('pasal')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return result as Pasal
}

export async function updatePasal(
  id: string,
  data: Partial<{ nama_pasal: string; kategori_id: string; poin: number }>
): Promise<Pasal> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('pasal')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return result as Pasal
}

export async function deletePasal(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('pasal').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

export async function createTindakan(data: {
  nama_tindakan: string
  kategori_id: string
}): Promise<Tindakan> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('tindakan')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return result as Tindakan
}

export async function updateTindakan(
  id: string,
  data: Partial<{ nama_tindakan: string; kategori_id: string }>
): Promise<Tindakan> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('tindakan')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return result as Tindakan
}

export async function deleteTindakan(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('tindakan').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Antrian Poin Prestasi ────────────────────────────────────────────────────

export interface AntrianPoinItem {
  id: string
  tanggal: string
  diberikan_oleh: string
  siswa_id: string | null
  pasal_id: string | null
  divisi_id: string | null
  sumber: string | null
  prestasi_id: string | null
  status: StatusKedisiplinan
  created_at: string
  siswa: { id: string; nama: string; kelas_id: string | null; unit: Unit; kelas?: { nama_kelas: string } | null } | null
  pasal: { id: string; nama_pasal: string; poin: number } | null
  prestasi: {
    id: string
    tingkat_kejuaraan: string | null
    tipe: 'siswa' | 'guru' | null
    event_id?: string | null
    juara_id?: string | null
    event: { nama_event: string } | null
    juara: { nama_juara: string } | null
  } | null
}

export async function getAntrianPoinPrestasi(): Promise<{
  data: AntrianPoinItem[]
  total: number
}> {
  const supabase = createClient()

  const { data, error, count } = await supabase
    .from('kedisiplinan')
    .select(
      `
      *,
      siswa:students(*),
      pasal(*),
      prestasi:prestasi(*)
      `,
      { count: 'exact' }
    )
    .eq('sumber', 'prestasi')
    .in('status', ['Belum Diproses', 'Pending'])
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rawData = data ?? []

  // Ambil semua event_id dan juara_id yang unik untuk di-fetch secara paralel
  const eventIds = Array.from(
    new Set(
      rawData
        .map((item: any) => item.prestasi?.event_id)
        .filter(Boolean)
    )
  ) as string[]

  const juaraIds = Array.from(
    new Set(
      rawData
        .map((item: any) => item.prestasi?.juara_id)
        .filter(Boolean)
    )
  ) as string[]

  // Fetch event dan juara secara paralel
  const [eventsResult, juarasResult] = await Promise.all([
    eventIds.length > 0
      ? supabase.from('event').select('id, nama_event').in('id', eventIds)
      : Promise.resolve({ data: null, error: null }),
    juaraIds.length > 0
      ? supabase.from('juara').select('id, nama_juara').in('id', juaraIds)
      : Promise.resolve({ data: null, error: null }),
  ])

  const eventsMap = new Map<string, string>()
  if (eventsResult.data) {
    eventsResult.data.forEach((evt: any) => {
      eventsMap.set(evt.id, evt.nama_event)
    })
  }

  const juarasMap = new Map<string, string>()
  if (juarasResult.data) {
    juarasResult.data.forEach((jr: any) => {
      juarasMap.set(jr.id, jr.nama_juara)
    })
  }

  // Petakan kembali event dan juara ke dalam data prestasi
  const items: AntrianPoinItem[] = rawData.map((item: any) => {
    const prest = item.prestasi
      ? {
        ...item.prestasi,
        event: item.prestasi.event_id
          ? { nama_event: eventsMap.get(item.prestasi.event_id) ?? null }
          : null,
        juara: item.prestasi.juara_id
          ? { nama_juara: juarasMap.get(item.prestasi.juara_id) ?? null }
          : null,
      }
      : null

    return {
      id: item.id,
      tanggal: item.tanggal,
      diberikan_oleh: item.diberikan_oleh,
      siswa_id: item.siswa_id,
      pasal_id: item.pasal_id,
      divisi_id: item.divisi_id,
      sumber: item.sumber,
      prestasi_id: item.prestasi_id,
      status: item.status,
      created_at: item.created_at,
      siswa: item.siswa,
      pasal: item.pasal,
      prestasi: prest,
    }
  })

  return {
    data: items,
    total: count ?? 0,
  }
}

export async function approveAntrianPoin(ids: string[]): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('kedisiplinan')
    .update({ status: 'Sudah Diproses' })
    .in('id', ids)

  if (error) throw new Error(error.message)
}

export async function tolakAntrianPoin(
  id: string,
  prestasiId: string
): Promise<void> {
  const supabase = createClient()

  // 1. Hapus record kedisiplinan antrian
  const { error: deleteError } = await supabase
    .from('kedisiplinan')
    .delete()
    .eq('id', id)
    .eq('sumber', 'prestasi')

  if (deleteError) throw new Error(deleteError.message)

  // 2. Reset flag di prestasi
  const { error: resetError } = await supabase
    .from('prestasi')
    .update({ sudah_dilempar_kedisiplinan: false })
    .eq('id', prestasiId)

  if (resetError) throw new Error(resetError.message)
}
