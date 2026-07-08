import { addMonths, format, parseISO, startOfMonth, subMonths } from 'date-fns'
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

interface SemesterRangeRow {
  tanggal_mulai: string
  tanggal_selesai: string
}

interface PresensiTodayRow {
  siswa_id: string
  status: string | null
}

interface PrestasiTrendRow {
  unit: Unit | null
  waktu: string | null
}

interface PresensiActivityRow {
  id: string
  created_at: string
  tanggal: string
  status: string
  students?: Relation<{
    nama: string
    kelas?: Relation<{ nama_kelas: string }>
  }>
}

interface KedisiplinanActivityRow {
  id: string
  created_at: string
  tanggal: string
  status: string
  students?: Relation<{
    nama: string
    kelas?: Relation<{ nama_kelas: string }>
  }>
  kategori_disiplin?: Relation<{ nama_kategori: string }>
}

interface PrestasiActivityRow {
  id: string
  created_at: string
  waktu: string | null
  kelas_saat_prestasi?: string | null
  event?: Relation<{ nama_event: string }>
  juara?: Relation<{ nama_juara: string }>
  students?: Relation<{
    nama: string
    kelas?: Relation<{ nama_kelas: string }>
  }>
}

export interface DashboardMetrics {
  totalSiswaAktif: number
  presensiHariIni: {
    hadir: number
    total: number
    persentase: number
  }
  totalPelanggaranAktifBulanIni: number
  totalPrestasiBerjalan: number
}

export interface PrestasiTrendByUnitItem {
  bulan: string
  SD: number
  SMP: number
  SMA: number
}

export interface DashboardActivityItem {
  id: string
  tipe: 'Presensi' | 'Kedisiplinan' | 'Prestasi'
  created_at: string
  tanggal: string
  nama: string
  kelas: string
  deskripsi: string
  status: string
}

type Relation<T> = T | T[] | null | undefined

function unwrapRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
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
    .eq('is_alumni', false)

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
    .select('kelas_id, kelas(nama_kelas), jenis_kelamin')
    .eq('unit', unit)
    .eq('is_alumni', false)

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as any[]
  const classMap = new Map<string, { laki: number; perempuan: number }>()

  for (const row of rows) {
    const className = row.kelas?.nama_kelas || 'Tanpa Kelas'
    const existing = classMap.get(className) ?? { laki: 0, perempuan: 0 }

    if (row.jenis_kelamin === 'L') {
      existing.laki++
    } else if (row.jenis_kelamin === 'P') {
      existing.perempuan++
    }

    classMap.set(className, existing)
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
    .eq('status', 'Sudah Diproses')

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
      `*, students(id,nama,kelas_id,kelas(nama_kelas)), kategori_disiplin(id,nama_kategori)`
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

function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null
  try {
    return parseISO(value)
  } catch {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }
}

async function getActiveSemesterRangeOrYearStart(): Promise<{
  start: string
  end?: string
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('semester')
    .select('tanggal_mulai, tanggal_selesai')
    .eq('is_aktif', true)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const semester = data as SemesterRangeRow | null
  if (semester?.tanggal_mulai) {
    return {
      start: semester.tanggal_mulai,
      end: semester.tanggal_selesai,
    }
  }

  const now = new Date()
  return {
    start: `${now.getFullYear()}-01-01`,
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10)

  const [
    { count: totalSiswa, error: siswaErr },
    { data: presensiRows, error: presensiErr },
    { count: pelanggaranAktif, error: pelanggaranErr },
    periodePrestasi,
  ] = await Promise.all([
    supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('is_alumni', false),
    supabase
      .from('presensi')
      .select('siswa_id, status')
      .eq('tanggal', today),
    supabase
      .from('kedisiplinan')
      .select('*', { count: 'exact', head: true })
      .gte('tanggal', monthStart)
      .neq('status', 'Sudah Diproses'),
    getActiveSemesterRangeOrYearStart(),
  ])

  if (siswaErr) throw new Error(siswaErr.message)
  if (presensiErr) throw new Error(presensiErr.message)
  if (pelanggaranErr) throw new Error(pelanggaranErr.message)

  let prestasiQuery = supabase
    .from('prestasi')
    .select('*', { count: 'exact', head: true })
    .gte('waktu', periodePrestasi.start)

  if (periodePrestasi.end) {
    prestasiQuery = prestasiQuery.lte('waktu', periodePrestasi.end)
  }

  const { count: totalPrestasi, error: prestasiErr } = await prestasiQuery
  if (prestasiErr) throw new Error(prestasiErr.message)

  const totalSiswaAktif = totalSiswa ?? 0
  const hadirSet = new Set(
    ((presensiRows ?? []) as PresensiTodayRow[])
      .filter((row) => row.status === 'Hadir')
      .map((row) => row.siswa_id)
  )

  return {
    totalSiswaAktif,
    presensiHariIni: {
      hadir: hadirSet.size,
      total: totalSiswaAktif,
      persentase:
        totalSiswaAktif > 0
          ? Math.round((hadirSet.size / totalSiswaAktif) * 100)
          : 0,
    },
    totalPelanggaranAktifBulanIni: pelanggaranAktif ?? 0,
    totalPrestasiBerjalan: totalPrestasi ?? 0,
  }
}

export async function getPrestasiTrendByUnit(
  totalBulan: number = 6
): Promise<PrestasiTrendByUnitItem[]> {
  const supabase = createClient()
  const startDate = startOfMonth(subMonths(new Date(), totalBulan - 1))
    .toISOString()
    .slice(0, 10)

  const { data, error } = await supabase
    .from('prestasi')
    .select('unit, waktu')
    .gte('waktu', startDate)

  if (error) throw new Error(error.message)

  const seed = new Map<string, PrestasiTrendByUnitItem>()
  for (let i = totalBulan - 1; i >= 0; i--) {
    const date = startOfMonth(subMonths(new Date(), i))
    const key = format(date, 'yyyy-MM')
    seed.set(key, {
      bulan: format(date, 'MMM yy'),
      SD: 0,
      SMP: 0,
      SMA: 0,
    })
  }

  for (const row of (data ?? []) as PrestasiTrendRow[]) {
    const date = parseDateSafe(row.waktu)
    if (!date || !row.unit) continue
    const key = format(date, 'yyyy-MM')
    const bucket = seed.get(key)
    if (!bucket) continue
    if (row.unit === 'SD') bucket.SD++
    if (row.unit === 'SMP') bucket.SMP++
    if (row.unit === 'SMA') bucket.SMA++
  }

  return Array.from(seed.values())
}

export async function getRecentDashboardActivities(
  limit: number = 12
): Promise<DashboardActivityItem[]> {
  const supabase = createClient()

  const [presensiRes, kedisiplinanRes, prestasiRes] = await Promise.all([
    supabase
      .from('presensi')
      .select('id, created_at, tanggal, status, students(nama, kelas(nama_kelas))')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('kedisiplinan')
      .select(
        'id, created_at, tanggal, status, students(nama, kelas(nama_kelas)), kategori_disiplin(nama_kategori)'
      )
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('prestasi')
      .select(
        'id, created_at, waktu, kelas_saat_prestasi, event(nama_event), juara(nama_juara), students(nama, kelas(nama_kelas))'
      )
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (presensiRes.error) throw new Error(presensiRes.error.message)
  if (kedisiplinanRes.error) throw new Error(kedisiplinanRes.error.message)
  if (prestasiRes.error) throw new Error(prestasiRes.error.message)

  const presensi = (
    (presensiRes.data ?? []) as unknown as PresensiActivityRow[]
  ).map((row) => {
    const student = unwrapRelation(row.students)
    const kelas = unwrapRelation(student?.kelas)
    return {
      id: `presensi-${row.id}`,
      tipe: 'Presensi' as const,
      created_at: row.created_at,
      tanggal: row.tanggal,
      nama: student?.nama ?? '-',
      kelas: kelas?.nama_kelas ?? '-',
      deskripsi: 'Input presensi harian',
      status: row.status,
    }
  })

  const kedisiplinan = (
    (kedisiplinanRes.data ?? []) as unknown as KedisiplinanActivityRow[]
  ).map((row) => {
    const student = unwrapRelation(row.students)
    const kelas = unwrapRelation(student?.kelas)
    const kategori = unwrapRelation(row.kategori_disiplin)
    return {
      id: `kedisiplinan-${row.id}`,
      tipe: 'Kedisiplinan' as const,
      created_at: row.created_at,
      tanggal: row.tanggal,
      nama: student?.nama ?? '-',
      kelas: kelas?.nama_kelas ?? '-',
      deskripsi: kategori?.nama_kategori ?? 'Catatan kedisiplinan',
      status: row.status,
    }
  })

  const prestasi = (
    (prestasiRes.data ?? []) as unknown as PrestasiActivityRow[]
  ).map((row) => {
    const student = unwrapRelation(row.students)
    const kelas = unwrapRelation(student?.kelas)
    const event = unwrapRelation(row.event)
    const juara = unwrapRelation(row.juara)
    return {
      id: `prestasi-${row.id}`,
      tipe: 'Prestasi' as const,
      created_at: row.created_at,
      tanggal: row.waktu ?? row.created_at.slice(0, 10),
      nama: student?.nama ?? '-',
      kelas: row.kelas_saat_prestasi ?? kelas?.nama_kelas ?? '-',
      deskripsi: `${event?.nama_event ?? 'Prestasi'} · ${
        juara?.nama_juara ?? '-'
      }`,
      status: 'Selesai',
    }
  })

  return [...presensi, ...kedisiplinan, ...prestasi]
    .sort((a, b) => {
      const aTime = parseDateSafe(a.created_at)?.getTime() ?? 0
      const bTime = parseDateSafe(b.created_at)?.getTime() ?? 0
      return bTime - aTime
    })
    .slice(0, limit)
}
