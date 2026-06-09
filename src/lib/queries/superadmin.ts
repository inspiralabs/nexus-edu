import { createClient } from '@/lib/supabase/client'
import type { AuditLog, Profile, Unit } from '@/lib/supabase/types'

export interface SystemStats {
  profiles: number
  students: number
  kedisiplinan: number
  prestasi: number
  kategoriDisiplin: number
  divisi: number
  event: number
  announcements: number
}

export interface ActivityDayCount {
  date: string
  count: number
}

export interface TopActiveUser {
  nama_lengkap: string
  action_count: number
}

export interface GetAuditLogOptions {
  userId?: string
  action?: string
  tableName?: string
  page?: number
  pageSize?: number
  sortDirection?: 'asc' | 'desc'
}

export interface AnalyticsData {
  userTrenBulanan: { bulan: string; count: number }[]
  kedisiplinanTren: { bulan: string; count: number }[]
  prestasiTren: { bulan: string; count: number }[]
  siswaPerUnit: { unit: string; count: number }[]
  top10Kedisiplinan: { nama: string; kelas: string; count: number }[]
  top10Prestasi: { nama: string; kelas: string; count: number }[]
}

export interface SystemConfig {
  title: string
  content: string
}

const EXPORTABLE_TABLES = [
  'profiles',
  'students',
  'kedisiplinan',
  'prestasi',
  'kategori_disiplin',
  'divisi',
  'pasal',
  'tindakan',
  'kategori_prestasi',
  'event',
  'juara',
  'bidang',
] as const

type ExportableTable = (typeof EXPORTABLE_TABLES)[number]

type Relation<T> = T | T[] | null | undefined

interface AuditLogProfileRelation {
  nama_lengkap: string
  username: string
}

interface AuditLogRow {
  id: string
  user_id: string | null
  action: AuditLog['action']
  table_name: string | null
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  profiles: Relation<AuditLogProfileRelation>
}

interface AuditActivityRow {
  id: string
  user_id: string | null
  profiles: Relation<Pick<Profile, 'nama_lengkap'>>
}

interface ProfileCreatedRow {
  created_at: string
}

interface KedisiplinanAnalyticsRow {
  tanggal: string
  siswa_id: string | null
  students: Relation<{ nama: string; kelas: string }>
}

interface PrestasiAnalyticsRow {
  waktu: string | null
  created_at: string
  siswa_id: string | null
  students: Relation<{ nama: string; kelas: string }>
}

interface StudentUnitRow {
  unit: Unit | null
}

function unwrapRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
}

function isExportableTable(tableName: string): tableName is ExportableTable {
  return (EXPORTABLE_TABLES as readonly string[]).includes(tableName)
}

function getLast7DateStrings(): string[] {
  const dates: string[] = []

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    dates.push(date.toISOString().split('T')[0])
  }

  return dates
}

function getYearDateRange(tahun: number): { start: string; end: string } {
  return {
    start: `${tahun}-01-01`,
    end: `${tahun}-12-31`,
  }
}

function incrementMonthCount(
  map: Map<string, number>,
  dateValue: string | null | undefined
): void {
  if (!dateValue) return
  const bulan = dateValue.substring(0, 7)
  map.set(bulan, (map.get(bulan) ?? 0) + 1)
}

function mapToSortedMonthSeries(
  map: Map<string, number>
): { bulan: string; count: number }[] {
  return Array.from(map.entries())
    .map(([bulan, count]) => ({ bulan, count }))
    .sort((a, b) => a.bulan.localeCompare(b.bulan))
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue =
    typeof value === 'object' ? JSON.stringify(value) : String(value)

  if (
    stringValue.includes('"') ||
    stringValue.includes(',') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return ''
  }

  const headers = [
    ...rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key))
      return keys
    }, new Set<string>()),
  ]

  const headerLine = headers.map(escapeCsvValue).join(',')
  const dataLines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header])).join(',')
  )

  return [headerLine, ...dataLines].join('\n')
}

function normalizeAuditLogRow(row: AuditLogRow): AuditLog {
  const profile = unwrapRelation(row.profiles)

  return {
    id: row.id,
    user_id: row.user_id,
    action: row.action,
    table_name: row.table_name,
    record_id: row.record_id,
    old_data: row.old_data,
    new_data: row.new_data,
    created_at: row.created_at,
    profiles: profile
      ? ({
          nama_lengkap: profile.nama_lengkap,
          username: profile.username,
        } as Profile)
      : undefined,
  }
}

async function countTable(tableName: ExportableTable | 'announcements'): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })

  if (error) throw new Error(error.message)

  return count ?? 0
}

export async function getSystemStats(): Promise<SystemStats> {
  const [
    profiles,
    students,
    kedisiplinan,
    prestasi,
    kategoriDisiplin,
    divisi,
    event,
    announcements,
  ] = await Promise.all([
    countTable('profiles'),
    countTable('students'),
    countTable('kedisiplinan'),
    countTable('prestasi'),
    countTable('kategori_disiplin'),
    countTable('divisi'),
    countTable('event'),
    countTable('announcements'),
  ])

  return {
    profiles,
    students,
    kedisiplinan,
    prestasi,
    kategoriDisiplin,
    divisi,
    event,
    announcements,
  }
}

export async function getActivityLast7Days(): Promise<ActivityDayCount[]> {
  const supabase = createClient()
  const dateRange = getLast7DateStrings()
  const startDate = `${dateRange[0]}T00:00:00.000Z`

  const { data, error } = await supabase
    .from('audit_log')
    .select('created_at')
    .gte('created_at', startDate)

  if (error) throw new Error(error.message)

  const countByDate = new Map<string, number>(
    dateRange.map((date) => [date, 0])
  )

  for (const row of data ?? []) {
    const date = row.created_at.split('T')[0]
    if (countByDate.has(date)) {
      countByDate.set(date, (countByDate.get(date) ?? 0) + 1)
    }
  }

  return dateRange.map((date) => ({
    date,
    count: countByDate.get(date) ?? 0,
  }))
}

export async function getTopActiveUsers(
  limit: number = 5
): Promise<TopActiveUser[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('audit_log')
    .select('id, user_id, profiles(nama_lengkap)')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as AuditActivityRow[]
  const countByName = new Map<string, number>()

  for (const row of rows) {
    const profile = unwrapRelation(row.profiles)
    const namaLengkap = profile?.nama_lengkap?.trim() || 'Pengguna Tidak Dikenal'
    countByName.set(namaLengkap, (countByName.get(namaLengkap) ?? 0) + 1)
  }

  return Array.from(countByName.entries())
    .map(([nama_lengkap, action_count]) => ({ nama_lengkap, action_count }))
    .sort((a, b) => b.action_count - a.action_count)
    .slice(0, limit)
}

export async function getAuditLog(
  options?: GetAuditLogOptions
): Promise<{ data: AuditLog[]; total: number }> {
  const supabase = createClient()
  const page = options?.page ?? 1
  const pageSize = options?.pageSize ?? 20
  const sortDirection = options?.sortDirection ?? 'desc'
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let countQuery = supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })

  let dataQuery = supabase
    .from('audit_log')
    .select('*, profiles(nama_lengkap, username)')

  if (options?.userId) {
    countQuery = countQuery.eq('user_id', options.userId)
    dataQuery = dataQuery.eq('user_id', options.userId)
  }

  if (options?.action) {
    countQuery = countQuery.eq('action', options.action)
    dataQuery = dataQuery.eq('action', options.action)
  }

  if (options?.tableName) {
    countQuery = countQuery.eq('table_name', options.tableName)
    dataQuery = dataQuery.eq('table_name', options.tableName)
  }

  const { count, error: countError } = await countQuery

  if (countError) throw new Error(countError.message)

  const { data, error } = await dataQuery
    .order('created_at', { ascending: sortDirection === 'asc' })
    .range(from, to)

  if (error) throw new Error(error.message)

  return {
    data: ((data ?? []) as AuditLogRow[]).map(normalizeAuditLogRow),
    total: count ?? 0,
  }
}

export async function getAnalyticsData(
  tahun?: number
): Promise<AnalyticsData> {
  const supabase = createClient()
  const yearRange = tahun ? getYearDateRange(tahun) : null

  let profilesQuery = supabase.from('profiles').select('created_at')
  let kedisiplinanQuery = supabase
    .from('kedisiplinan')
    .select('tanggal, siswa_id, students(nama, kelas)')
  let prestasiQuery = supabase
    .from('prestasi')
    .select('waktu, created_at, siswa_id, students(nama, kelas)')
  const studentsQuery = supabase.from('students').select('unit')

  if (yearRange) {
    profilesQuery = profilesQuery
      .gte('created_at', `${yearRange.start}T00:00:00.000Z`)
      .lte('created_at', `${yearRange.end}T23:59:59.999Z`)
    kedisiplinanQuery = kedisiplinanQuery
      .gte('tanggal', yearRange.start)
      .lte('tanggal', yearRange.end)
    prestasiQuery = prestasiQuery
      .gte('waktu', yearRange.start)
      .lte('waktu', yearRange.end)
  }

  const [
    { data: profilesData, error: profilesError },
    { data: kedisiplinanData, error: kedisiplinanError },
    { data: prestasiData, error: prestasiError },
    { data: studentsData, error: studentsError },
  ] = await Promise.all([
    profilesQuery,
    kedisiplinanQuery,
    prestasiQuery,
    studentsQuery,
  ])

  if (profilesError) throw new Error(profilesError.message)
  if (kedisiplinanError) throw new Error(kedisiplinanError.message)
  if (prestasiError) throw new Error(prestasiError.message)
  if (studentsError) throw new Error(studentsError.message)

  const userMonthMap = new Map<string, number>()
  for (const row of (profilesData ?? []) as ProfileCreatedRow[]) {
    incrementMonthCount(userMonthMap, row.created_at)
  }

  const kedisiplinanMonthMap = new Map<string, number>()
  const kedisiplinanStudentMap = new Map<
    string,
    { nama: string; kelas: string; count: number }
  >()

  for (const row of (kedisiplinanData ?? []) as KedisiplinanAnalyticsRow[]) {
    incrementMonthCount(kedisiplinanMonthMap, row.tanggal)

    if (!row.siswa_id) continue

    const student = unwrapRelation(row.students)
    const existing = kedisiplinanStudentMap.get(row.siswa_id) ?? {
      nama: student?.nama ?? 'Tidak Dikenal',
      kelas: student?.kelas ?? '-',
      count: 0,
    }

    existing.count += 1
    kedisiplinanStudentMap.set(row.siswa_id, existing)
  }

  const prestasiMonthMap = new Map<string, number>()
  const prestasiStudentMap = new Map<
    string,
    { nama: string; kelas: string; count: number }
  >()

  for (const row of (prestasiData ?? []) as PrestasiAnalyticsRow[]) {
    incrementMonthCount(prestasiMonthMap, row.waktu ?? row.created_at)

    if (!row.siswa_id) continue

    const student = unwrapRelation(row.students)
    const existing = prestasiStudentMap.get(row.siswa_id) ?? {
      nama: student?.nama ?? 'Tidak Dikenal',
      kelas: student?.kelas ?? '-',
      count: 0,
    }

    existing.count += 1
    prestasiStudentMap.set(row.siswa_id, existing)
  }

  const unitCountMap = new Map<string, number>()
  for (const row of (studentsData ?? []) as StudentUnitRow[]) {
    const unit = row.unit ?? 'Tidak Diketahui'
    unitCountMap.set(unit, (unitCountMap.get(unit) ?? 0) + 1)
  }

  return {
    userTrenBulanan: mapToSortedMonthSeries(userMonthMap),
    kedisiplinanTren: mapToSortedMonthSeries(kedisiplinanMonthMap),
    prestasiTren: mapToSortedMonthSeries(prestasiMonthMap),
    siswaPerUnit: Array.from(unitCountMap.entries())
      .map(([unit, count]) => ({ unit, count }))
      .sort((a, b) => a.unit.localeCompare(b.unit, 'id')),
    top10Kedisiplinan: Array.from(kedisiplinanStudentMap.values())
      .map(({ nama, kelas, count }) => ({ nama, kelas, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    top10Prestasi: Array.from(prestasiStudentMap.values())
      .map(({ nama, kelas, count }) => ({ nama, kelas, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  }
}

export async function getSystemConfig(): Promise<SystemConfig | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('announcements')
    .select('title, content')
    .eq('title', 'SYSTEM_CONFIG')
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (!data) {
    return null
  }

  return {
    title: data.title,
    content: data.content,
  }
}

export async function saveSystemConfig(content: string): Promise<void> {
  const supabase = createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('announcements')
    .select('id')
    .eq('title', 'SYSTEM_CONFIG')
    .limit(1)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)

  if (existing) {
    const { error } = await supabase
      .from('announcements')
      .update({ content })
      .eq('id', existing.id)

    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('announcements').insert({
    title: 'SYSTEM_CONFIG',
    content,
  })

  if (error) throw new Error(error.message)
}

export async function exportTableAsCSV(tableName: string): Promise<string> {
  if (!isExportableTable(tableName)) {
    throw new Error(`Tabel "${tableName}" tidak diizinkan untuk diekspor`)
  }

  const supabase = createClient()

  const { data, error } = await supabase.from(tableName).select('*')

  if (error) throw new Error(error.message)

  return rowsToCsv((data ?? []) as Record<string, unknown>[])
}
