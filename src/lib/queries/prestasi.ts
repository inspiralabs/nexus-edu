import { startOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type {
  Bidang,
  Event,
  JenisJuara,
  Juara,
  KategoriPrestasi,
  Prestasi,
  Tempat,
  TingkatKejuaraan,
  Unit,
} from '@/lib/supabase/types'

export interface CreatePrestasiInput {
  unit: Unit
  siswa_id: string
  event_id: string
  tempat: Tempat
  waktu: string
  juara_id: string
  jenis_juara: JenisJuara
  bidang_id: string
  kategori_id: string
  tingkat_kejuaraan: TingkatKejuaraan
}

export interface PrestasiFilters {
  tahun?: number[]
  unit?: Unit[]
  juara_id?: string[]
  kategori_id?: string[]
  tingkat_kejuaraan?: TingkatKejuaraan[]
  search?: string
  page?: number
  pageSize?: number
  sortField?: string
  sortDirection?: 'asc' | 'desc'
}

export interface PrestasiDashboardFilters {
  tahun?: number[]
  unit?: Unit[]
  juara_id?: string[]
  kategori_id?: string[]
  tingkat_kejuaraan?: TingkatKejuaraan[]
}

export interface PrestasiDashboardResult {
  totalPrestasi: number
  thisMonth: number
  juara1: number
  nasionalPlus: number
  trenBulanan: { bulan: string; count: number }[]
  perTingkat: { tingkat_kejuaraan: string; count: number }[]
  perBidang: { nama_bidang: string; count: number }[]
  individuVsKelompok: { jenis_juara: string; count: number }[]
}

export const TINGKAT_KEJUARAAN: TingkatKejuaraan[] = [
  'Tingkat Sekolah',
  'Tingkat Lokal',
  'Tingkat Kecamatan',
  'Tingkat Kabupaten/Kota',
  'Tingkat Provinsi',
  'Tingkat Regional',
  'Tingkat Nasional',
  'Tingkat Internasional',
]

const NASIONAL_PLUS_TINGKAT: TingkatKejuaraan[] = [
  'Tingkat Nasional',
  'Tingkat Internasional',
]

const PRESTASI_SELECT = `
  *,
  students(id,nama,kelas),
  event(id,nama_event),
  juara(id,nama_juara),
  bidang(id,nama_bidang),
  kategori_prestasi(id,nama_kategori)
`

const ALLOWED_SORT_FIELDS = [
  'unit',
  'waktu',
  'tempat',
  'jenis_juara',
  'tingkat_kejuaraan',
  'created_at',
  'siswa_id',
  'event_id',
  'juara_id',
  'bidang_id',
  'kategori_id',
] as const

type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number]

type Relation<T> = T | T[] | null | undefined

interface StudentIdRow {
  id: string
}

interface PrestasiAggregateRow {
  waktu: string | null
  jenis_juara: JenisJuara | null
  tingkat_kejuaraan: TingkatKejuaraan | null
  juara: Relation<{ nama_juara: string }>
  bidang: Relation<{ nama_bidang: string }>
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
  return 'waktu'
}

async function getFilteredStudentIds(
  search?: string
): Promise<string[] | null> {
  if (!search || search.length === 0) {
    return null
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .ilike('nama', `%${search}%`)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => (row as StudentIdRow).id)
}

type PrestasiTableFilterInput = Pick<
  PrestasiFilters,
  'tahun' | 'unit' | 'juara_id' | 'kategori_id' | 'tingkat_kejuaraan'
>

function applyPrestasiTableFilters<
  Q extends {
    in: (
      column: string,
      values: string[] | Unit[] | TingkatKejuaraan[]
    ) => Q
    gte: (column: string, value: string) => Q
    lte: (column: string, value: string) => Q
    or: (filters: string) => Q
  },
>(
  query: Q,
  filters?: PrestasiTableFilterInput,
  studentIds?: string[] | null
): Q {
  let nextQuery = query

  if (studentIds) {
    nextQuery = nextQuery.in('siswa_id', studentIds)
  }

  if (filters?.unit && filters.unit.length > 0) {
    nextQuery = nextQuery.in('unit', filters.unit)
  }

  if (filters?.juara_id && filters.juara_id.length > 0) {
    nextQuery = nextQuery.in('juara_id', filters.juara_id)
  }

  if (filters?.kategori_id && filters.kategori_id.length > 0) {
    nextQuery = nextQuery.in('kategori_id', filters.kategori_id)
  }

  if (filters?.tingkat_kejuaraan && filters.tingkat_kejuaraan.length > 0) {
    nextQuery = nextQuery.in('tingkat_kejuaraan', filters.tingkat_kejuaraan)
  }

  if (filters?.tahun && filters.tahun.length > 0) {
    if (filters.tahun.length === 1) {
      nextQuery = nextQuery
        .gte('waktu', `${filters.tahun[0]}-01-01`)
        .lte('waktu', `${filters.tahun[0]}-12-31`)
    } else {
      const orClause = filters.tahun
        .map(
          (year) => `and(waktu.gte.${year}-01-01,waktu.lte.${year}-12-31)`
        )
        .join(',')
      nextQuery = nextQuery.or(orClause)
    }
  }

  return nextQuery
}

function isJuara1(namaJuara: string): boolean {
  return namaJuara.toLowerCase().includes('juara 1')
}

export async function getPrestasi(
  filters?: PrestasiFilters
): Promise<{ data: Prestasi[]; total: number }> {
  const supabase = createClient()
  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortField = resolveSortField(filters?.sortField)
  const ascending = filters?.sortDirection !== 'desc'

  const studentIds = await getFilteredStudentIds(filters?.search)

  if (studentIds && studentIds.length === 0) {
    return { data: [], total: 0 }
  }

  let countQuery = supabase
    .from('prestasi')
    .select('*', { count: 'exact', head: true })

  countQuery = applyPrestasiTableFilters(countQuery, filters, studentIds)

  const { count, error: countError } = await countQuery

  if (countError) throw new Error(countError.message)

  let dataQuery = supabase.from('prestasi').select(PRESTASI_SELECT)

  dataQuery = applyPrestasiTableFilters(dataQuery, filters, studentIds)

  const { data, error } = await dataQuery
    .order(sortField, { ascending })
    .range(from, to)

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as Prestasi[],
    total: count ?? 0,
  }
}

export async function createPrestasi(
  data: CreatePrestasiInput
): Promise<Prestasi> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('prestasi')
    .insert(data)
    .select(PRESTASI_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return result as Prestasi
}

export async function updatePrestasi(
  id: string,
  data: Partial<CreatePrestasiInput>
): Promise<Prestasi> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('prestasi')
    .update(data)
    .eq('id', id)
    .select(PRESTASI_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return result as Prestasi
}

export async function deletePrestasi(ids: string[]): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('prestasi').delete().in('id', ids)

  if (error) throw new Error(error.message)
}

export async function getPrestasiDashboard(
  filters?: PrestasiDashboardFilters
): Promise<PrestasiDashboardResult> {
  const supabase = createClient()
  const monthStart = startOfMonth(new Date()).toISOString().split('T')[0]

  let dashboardQuery = supabase
    .from('prestasi')
    .select(
      'waktu, jenis_juara, tingkat_kejuaraan, juara(nama_juara), bidang(nama_bidang)'
    )

  if (filters?.unit && filters.unit.length > 0) {
    dashboardQuery = dashboardQuery.in('unit', filters.unit)
  }

  if (filters?.juara_id && filters.juara_id.length > 0) {
    dashboardQuery = dashboardQuery.in('juara_id', filters.juara_id)
  }

  if (filters?.kategori_id && filters.kategori_id.length > 0) {
    dashboardQuery = dashboardQuery.in('kategori_id', filters.kategori_id)
  }

  if (filters?.tingkat_kejuaraan && filters.tingkat_kejuaraan.length > 0) {
    dashboardQuery = dashboardQuery.in(
      'tingkat_kejuaraan',
      filters.tingkat_kejuaraan
    )
  }

  if (filters?.tahun && filters.tahun.length > 0) {
    if (filters.tahun.length === 1) {
      dashboardQuery = dashboardQuery
        .gte('waktu', `${filters.tahun[0]}-01-01`)
        .lte('waktu', `${filters.tahun[0]}-12-31`)
    } else {
      const orClause = filters.tahun
        .map(
          (year) => `and(waktu.gte.${year}-01-01,waktu.lte.${year}-12-31)`
        )
        .join(',')
      dashboardQuery = dashboardQuery.or(orClause)
    }
  }

  const { data, error } = await dashboardQuery

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as PrestasiAggregateRow[]

  let thisMonth = 0
  let juara1 = 0
  let nasionalPlus = 0

  const bulanMap = new Map<string, number>()
  const tingkatMap = new Map<string, number>()
  const bidangMap = new Map<string, number>()
  const jenisJuaraMap = new Map<string, number>()

  for (const row of rows) {
    if (row.waktu && row.waktu >= monthStart) {
      thisMonth++
    }

    const juara = unwrapRelation(row.juara)
    if (juara?.nama_juara && isJuara1(juara.nama_juara)) {
      juara1++
    }

    if (
      row.tingkat_kejuaraan &&
      NASIONAL_PLUS_TINGKAT.includes(row.tingkat_kejuaraan)
    ) {
      nasionalPlus++
    }

    if (row.waktu) {
      const bulan = row.waktu.substring(0, 7)
      bulanMap.set(bulan, (bulanMap.get(bulan) ?? 0) + 1)
    }

    if (row.tingkat_kejuaraan) {
      tingkatMap.set(
        row.tingkat_kejuaraan,
        (tingkatMap.get(row.tingkat_kejuaraan) ?? 0) + 1
      )
    }

    const bidang = unwrapRelation(row.bidang)
    if (bidang?.nama_bidang) {
      bidangMap.set(
        bidang.nama_bidang,
        (bidangMap.get(bidang.nama_bidang) ?? 0) + 1
      )
    }

    if (row.jenis_juara) {
      jenisJuaraMap.set(
        row.jenis_juara,
        (jenisJuaraMap.get(row.jenis_juara) ?? 0) + 1
      )
    }
  }

  const trenBulanan = Array.from(bulanMap.entries())
    .map(([bulan, count]) => ({ bulan, count }))
    .sort((a, b) => a.bulan.localeCompare(b.bulan))

  const perTingkat = Array.from(tingkatMap.entries())
    .map(([tingkat_kejuaraan, count]) => ({ tingkat_kejuaraan, count }))
    .sort((a, b) => b.count - a.count)

  const perBidang = Array.from(bidangMap.entries())
    .map(([nama_bidang, count]) => ({ nama_bidang, count }))
    .sort((a, b) => b.count - a.count)

  const individuVsKelompok = Array.from(jenisJuaraMap.entries()).map(
    ([jenis_juara, count]) => ({ jenis_juara, count })
  )

  return {
    totalPrestasi: rows.length,
    thisMonth,
    juara1,
    nasionalPlus,
    trenBulanan,
    perTingkat,
    perBidang,
    individuVsKelompok,
  }
}

export async function searchEvent(query: string): Promise<Event[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('event')
    .select('*')
    .ilike('nama_event', `%${query}%`)
    .limit(10)

  if (error) throw new Error(error.message)

  return (data ?? []) as Event[]
}

export async function searchJuara(query: string): Promise<Juara[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('juara')
    .select('*')
    .ilike('nama_juara', `%${query}%`)
    .limit(10)

  if (error) throw new Error(error.message)

  return (data ?? []) as Juara[]
}

export async function searchBidang(query: string): Promise<Bidang[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('bidang')
    .select('*')
    .ilike('nama_bidang', `%${query}%`)
    .limit(10)

  if (error) throw new Error(error.message)

  return (data ?? []) as Bidang[]
}

export async function searchKategoriPrestasi(
  query: string
): Promise<KategoriPrestasi[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kategori_prestasi')
    .select('*')
    .ilike('nama_kategori', `%${query}%`)
    .limit(10)

  if (error) throw new Error(error.message)

  return (data ?? []) as KategoriPrestasi[]
}

export async function createEvent(data: {
  nama_event: string
  penyelenggara?: string | null
}): Promise<Event> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('event')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return result as Event
}

export async function updateEvent(
  id: string,
  data: Partial<{ nama_event: string; penyelenggara: string | null }>
): Promise<Event> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('event')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return result as Event
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('event').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

export async function createJuara(nama_juara: string): Promise<Juara> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('juara')
    .insert({ nama_juara })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as Juara
}

export async function updateJuara(
  id: string,
  nama_juara: string
): Promise<Juara> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('juara')
    .update({ nama_juara })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as Juara
}

export async function deleteJuara(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('juara').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

export async function createBidang(nama_bidang: string): Promise<Bidang> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('bidang')
    .insert({ nama_bidang })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as Bidang
}

export async function updateBidang(
  id: string,
  nama_bidang: string
): Promise<Bidang> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('bidang')
    .update({ nama_bidang })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as Bidang
}

export async function deleteBidang(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('bidang').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

export async function createKategoriPrestasi(
  nama_kategori: string
): Promise<KategoriPrestasi> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kategori_prestasi')
    .insert({ nama_kategori })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as KategoriPrestasi
}

export async function updateKategoriPrestasi(
  id: string,
  nama_kategori: string
): Promise<KategoriPrestasi> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kategori_prestasi')
    .update({ nama_kategori })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return data as KategoriPrestasi
}

export async function deleteKategoriPrestasi(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('kategori_prestasi')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
