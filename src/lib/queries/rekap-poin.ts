import { createClient } from '@/lib/supabase/client'
import type { StatusKedisiplinan } from '@/lib/supabase/types'

export interface RekapPoinSiswa {
  siswa_id: string
  nama: string
  kelas: string
  unit: string
  jenis_kelamin: string | null
  total_poin_pelanggaran: number
  total_poin_prestasi: number
  jumlah_kasus_pelanggaran: number
  jumlah_kasus_prestasi: number
}

export interface RekapFilterOptions {
  unit?: string
  kelas?: string[]
  search?: string
  tahun?: number
  page?: number
  pageSize?: number
}

export interface RiwayatItem {
  id: string
  tanggal: string
  nama_pasal: string
  poin: number
  nama_kategori: string
  status: string
}

export interface DetailSiswa {
  siswa: {
    id: string
    nama: string
    kelas: string
    unit: string
    jenis_kelamin: string | null
  }
  riwayat_pelanggaran: RiwayatItem[]
  riwayat_prestasi: RiwayatItem[]
  total_poin_pelanggaran: number
  total_poin_prestasi: number
}

export interface KelasOption {
  value: string
  label: string
}

interface StudentRow {
  id: string
  nama: string
  kelas: string
  unit: string | null
  jenis_kelamin: string | null
}

interface KedisiplinanAggRow {
  siswa_id: string | null
  pasal: { poin: number } | { poin: number }[] | null
  kategori_disiplin:
    | { nama_kategori: string }
    | { nama_kategori: string }[]
    | null
}

interface KedisiplinanDetailRow {
  id: string
  tanggal: string
  status: StatusKedisiplinan
  pasal:
    | { id: string; nama_pasal: string; poin: number }
    | { id: string; nama_pasal: string; poin: number }[]
    | null
  kategori_disiplin:
    | { id: string; nama_kategori: string }
    | { id: string; nama_kategori: string }[]
    | null
}

function resolveRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function isPrestasiKategori(namaKategori: string): boolean {
  return namaKategori.toLowerCase().includes('prestasi')
}

export async function getRekapPoin(
  options?: RekapFilterOptions
): Promise<{ data: RekapPoinSiswa[]; total: number }> {
  const supabase = createClient()

  let studentsQuery = supabase
    .from('students')
    .select('id, nama, kelas, unit, jenis_kelamin')

  if (options?.unit) {
    studentsQuery = studentsQuery.eq('unit', options.unit)
  }

  if (options?.kelas && options.kelas.length > 0) {
    studentsQuery = studentsQuery.in('kelas', options.kelas)
  }

  if (options?.search && options.search.trim() !== '') {
    studentsQuery = studentsQuery.ilike('nama', `%${options.search.trim()}%`)
  }

  studentsQuery = studentsQuery.order('nama', { ascending: true })

  const { data: students, error: studentsError } = await studentsQuery

  if (studentsError) throw new Error(studentsError.message)
  if (!students || students.length === 0) return { data: [], total: 0 }

  const studentRows = students as StudentRow[]
  const studentIds = studentRows.map((s) => s.id)

  let kedisiplinanQuery = supabase
    .from('kedisiplinan')
    .select(`
      siswa_id,
      pasal!inner(poin),
      kategori_disiplin!inner(nama_kategori)
    `)
    .in('siswa_id', studentIds)
    .eq('status', 'Sudah Diproses')

  if (options?.tahun) {
    kedisiplinanQuery = kedisiplinanQuery
      .gte('tanggal', `${options.tahun}-01-01`)
      .lte('tanggal', `${options.tahun}-12-31`)
  }

  const { data: kedisiplinanData, error: kedError } = await kedisiplinanQuery

  if (kedError) throw new Error(kedError.message)

  const pelanggaranMap = new Map<
    string,
    { totalPoin: number; jumlahKasus: number }
  >()
  const prestasiMap = new Map<
    string,
    { totalPoin: number; jumlahKasus: number }
  >()

  for (const k of (kedisiplinanData ?? []) as KedisiplinanAggRow[]) {
    if (!k.siswa_id) continue

    const kategori = resolveRelation(k.kategori_disiplin)
    const pasal = resolveRelation(k.pasal)
    const isPrestasi = isPrestasiKategori(kategori?.nama_kategori ?? '')
    const poin = pasal?.poin ?? 0

    if (isPrestasi) {
      const existing = prestasiMap.get(k.siswa_id) ?? {
        totalPoin: 0,
        jumlahKasus: 0,
      }
      prestasiMap.set(k.siswa_id, {
        totalPoin: existing.totalPoin + poin,
        jumlahKasus: existing.jumlahKasus + 1,
      })
    } else {
      const existing = pelanggaranMap.get(k.siswa_id) ?? {
        totalPoin: 0,
        jumlahKasus: 0,
      }
      pelanggaranMap.set(k.siswa_id, {
        totalPoin: existing.totalPoin + poin,
        jumlahKasus: existing.jumlahKasus + 1,
      })
    }
  }

  const rekapData: RekapPoinSiswa[] = studentRows.map((s) => ({
    siswa_id: s.id,
    nama: s.nama,
    kelas: s.kelas,
    unit: s.unit ?? '',
    jenis_kelamin: s.jenis_kelamin,
    total_poin_pelanggaran: pelanggaranMap.get(s.id)?.totalPoin ?? 0,
    total_poin_prestasi: prestasiMap.get(s.id)?.totalPoin ?? 0,
    jumlah_kasus_pelanggaran: pelanggaranMap.get(s.id)?.jumlahKasus ?? 0,
    jumlah_kasus_prestasi: prestasiMap.get(s.id)?.jumlahKasus ?? 0,
  }))

  const total = rekapData.length
  const page = options?.page ?? 1
  const pageSize = options?.pageSize ?? 20
  const from = (page - 1) * pageSize
  const paginatedData = rekapData.slice(from, from + pageSize)

  return { data: paginatedData, total }
}

export async function getTop10Leaderboard(
  options?: Pick<RekapFilterOptions, 'unit' | 'kelas' | 'tahun'>
): Promise<{
  topPrestasi: RekapPoinSiswa[]
  topPelanggaran: RekapPoinSiswa[]
}> {
  const { data: allData } = await getRekapPoin({
    unit: options?.unit,
    kelas: options?.kelas,
    tahun: options?.tahun,
    pageSize: 99999,
  })

  const topPrestasi = allData
    .filter((s) => s.total_poin_prestasi > 0)
    .sort((a, b) => b.total_poin_prestasi - a.total_poin_prestasi)
    .slice(0, 10)

  const topPelanggaran = allData
    .filter((s) => s.total_poin_pelanggaran > 0)
    .sort((a, b) => b.total_poin_pelanggaran - a.total_poin_pelanggaran)
    .slice(0, 10)

  return { topPrestasi, topPelanggaran }
}

export async function getDetailSiswa(
  siswaId: string,
  tahun?: number
): Promise<DetailSiswa> {
  const supabase = createClient()

  const { data: siswa, error: siswaError } = await supabase
    .from('students')
    .select('id, nama, kelas, unit, jenis_kelamin')
    .eq('id', siswaId)
    .single()

  if (siswaError || !siswa) throw new Error('Siswa tidak ditemukan')

  const student = siswa as StudentRow

  let kedQuery = supabase
    .from('kedisiplinan')
    .select(`
      id,
      tanggal,
      status,
      pasal (id, nama_pasal, poin),
      kategori_disiplin (id, nama_kategori)
    `)
    .eq('siswa_id', siswaId)
    .order('tanggal', { ascending: false })

  if (tahun) {
    kedQuery = kedQuery
      .gte('tanggal', `${tahun}-01-01`)
      .lte('tanggal', `${tahun}-12-31`)
  }

  const { data: kedData, error: kedError } = await kedQuery

  if (kedError) throw new Error(kedError.message)

  const riwayat_pelanggaran: RiwayatItem[] = []
  const riwayat_prestasi: RiwayatItem[] = []

  for (const k of (kedData ?? []) as KedisiplinanDetailRow[]) {
    const kategori = resolveRelation(k.kategori_disiplin)
    const pasal = resolveRelation(k.pasal)
    const nama_kategori = kategori?.nama_kategori ?? '-'
    const isPrestasi = isPrestasiKategori(nama_kategori)

    const item: RiwayatItem = {
      id: k.id,
      tanggal: k.tanggal,
      nama_pasal: pasal?.nama_pasal ?? '-',
      poin: pasal?.poin ?? 0,
      nama_kategori,
      status: k.status,
    }

    if (isPrestasi) {
      riwayat_prestasi.push(item)
    } else {
      riwayat_pelanggaran.push(item)
    }
  }

  const total_poin_pelanggaran = riwayat_pelanggaran
    .filter((r) => r.status === 'Sudah Diproses')
    .reduce((sum, r) => sum + r.poin, 0)
  const total_poin_prestasi = riwayat_prestasi
    .filter((r) => r.status === 'Sudah Diproses')
    .reduce((sum, r) => sum + r.poin, 0)

  return {
    siswa: {
      id: student.id,
      nama: student.nama,
      kelas: student.kelas,
      unit: student.unit ?? '',
      jenis_kelamin: student.jenis_kelamin,
    },
    riwayat_pelanggaran,
    riwayat_prestasi,
    total_poin_pelanggaran,
    total_poin_prestasi,
  }
}

export async function getKelasOptions(unit?: string): Promise<KelasOption[]> {
  const supabase = createClient()

  let query = supabase.from('students').select('kelas')

  if (unit) {
    query = query.eq('unit', unit)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  const uniqueKelas = [
    ...new Set(
      (data ?? [])
        .map((row) => row.kelas)
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

export async function getTahunOptions(): Promise<number[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('kedisiplinan')
    .select('tanggal')

  if (error) throw new Error(error.message)

  const years = new Set<number>()

  for (const row of data ?? []) {
    if (row.tanggal) {
      years.add(new Date(row.tanggal).getFullYear())
    }
  }

  return Array.from(years).sort((a, b) => b - a)
}
