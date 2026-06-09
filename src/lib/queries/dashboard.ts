import { startOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type {
  JenisKelamin,
  Kedisiplinan,
  StatusKedisiplinan,
  Unit,
} from '@/lib/supabase/types'

interface StudentUnitRow {
  unit: Unit | null
}

interface StudentClassRow {
  kelas: string
  jenis_kelamin: JenisKelamin | null
}

interface KedisiplinanStatusRow {
  status: StatusKedisiplinan
}

type KategoriDisiplinRelation =
  | { nama_kategori: string }
  | { nama_kategori: string }[]
  | null

interface KedisiplinanKategoriRow {
  kategori_disiplin: KategoriDisiplinRelation
}

function getNamaKategori(kategori: KategoriDisiplinRelation): string | null {
  if (!kategori) return null
  if (Array.isArray(kategori)) {
    return kategori[0]?.nama_kategori ?? null
  }
  return kategori.nama_kategori
}

interface PrestasiUnitRow {
  unit: Unit | null
}

function sortKelasAlphanumeric(
  a: { kelas: string },
  b: { kelas: string }
): number {
  return a.kelas.localeCompare(b.kelas, 'id', {
    numeric: true,
    sensitivity: 'base',
  })
}

export async function getStudentCounts(): Promise<{
  sd: number
  smp: number
  sma: number
  total: number
}> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('students')
    .select('unit')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as StudentUnitRow[]
  const counts = { sd: 0, smp: 0, sma: 0, total: 0 }

  for (const row of rows) {
    if (row.unit === 'SD') counts.sd++
    else if (row.unit === 'SMP') counts.smp++
    else if (row.unit === 'SMA') counts.sma++
    counts.total++
  }

  return counts
}

export async function getStudentsByClass(
  unit: Unit
): Promise<{ kelas: string; laki: number; perempuan: number }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('students')
    .select('kelas, jenis_kelamin')
    .eq('unit', unit)

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as StudentClassRow[]
  const classMap = new Map<string, { laki: number; perempuan: number }>()

  for (const row of rows) {
    const existing = classMap.get(row.kelas) ?? { laki: 0, perempuan: 0 }

    if (row.jenis_kelamin === 'L') {
      existing.laki++
    } else if (row.jenis_kelamin === 'P') {
      existing.perempuan++
    }

    classMap.set(row.kelas, existing)
  }

  return Array.from(classMap.entries())
    .map(([kelas, counts]) => ({
      kelas,
      laki: counts.laki,
      perempuan: counts.perempuan,
    }))
    .sort(sortKelasAlphanumeric)
}

export async function getKedisiplinanStatusCount(): Promise<
  { status: StatusKedisiplinan; count: number }[]
> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kedisiplinan')
    .select('status')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as KedisiplinanStatusRow[]
  const statusMap = new Map<StatusKedisiplinan, number>()

  for (const row of rows) {
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1)
  }

  return Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }))
}

export async function getKedisiplinanTopKategori(
  limit: number = 5
): Promise<{ nama_kategori: string; count: number }[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kedisiplinan')
    .select('kategori_disiplin(nama_kategori)')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as KedisiplinanKategoriRow[]
  const kategoriMap = new Map<string, number>()

  for (const row of rows) {
    const namaKategori = getNamaKategori(row.kategori_disiplin)
    if (!namaKategori) continue
    kategoriMap.set(namaKategori, (kategoriMap.get(namaKategori) ?? 0) + 1)
  }

  return Array.from(kategoriMap.entries())
    .map(([nama_kategori, count]) => ({ nama_kategori, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export async function getPrestasiByUnit(): Promise<
  { unit: Unit; count: number }[]
> {
  const supabase = createClient()

  const { data, error } = await supabase.from('prestasi').select('unit')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as PrestasiUnitRow[]
  const unitMap = new Map<Unit, number>()

  for (const row of rows) {
    if (!row.unit) continue
    unitMap.set(row.unit, (unitMap.get(row.unit) ?? 0) + 1)
  }

  return Array.from(unitMap.entries()).map(([unit, count]) => ({
    unit,
    count,
  }))
}

export async function getRecentKedisiplinan(
  limit: number = 5
): Promise<Kedisiplinan[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kedisiplinan')
    .select(
      `*, students(id,nama,kelas), kategori_disiplin(id,nama_kategori)`
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []) as Kedisiplinan[]
}

export async function getPrestasiCount(): Promise<{
  total: number
  thisMonth: number
  juara1: number
  nasionalPlus: number
}> {
  const supabase = createClient()
  const monthStart = startOfMonth(new Date()).toISOString().split('T')[0]

  const { count: total, error: totalError } = await supabase
    .from('prestasi')
    .select('*', { count: 'exact', head: true })

  if (totalError) throw new Error(totalError.message)

  const { count: thisMonth, error: monthError } = await supabase
    .from('prestasi')
    .select('*', { count: 'exact', head: true })
    .gte('waktu', monthStart)

  if (monthError) throw new Error(monthError.message)

  const { count: juara1, error: juara1Error } = await supabase
    .from('prestasi')
    .select('*, juara!inner(nama_juara)', { count: 'exact', head: true })
    .ilike('juara.nama_juara', '%juara 1%')

  if (juara1Error) throw new Error(juara1Error.message)

  const { count: nasionalPlus, error: nasionalError } = await supabase
    .from('prestasi')
    .select('*', { count: 'exact', head: true })
    .in('tingkat_kejuaraan', [
      'Tingkat Nasional',
      'Tingkat Internasional',
    ])

  if (nasionalError) throw new Error(nasionalError.message)

  return {
    total: total ?? 0,
    thisMonth: thisMonth ?? 0,
    juara1: juara1 ?? 0,
    nasionalPlus: nasionalPlus ?? 0,
  }
}
