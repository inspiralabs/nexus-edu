import { createClient } from '@/lib/supabase/client'
import type { JenisKelamin, Student, Unit } from '@/lib/supabase/types'

export interface CreateStudentInput {
  nama: string
  kelas: string
  jenis_kelamin: JenisKelamin
  unit: Unit
}

export interface UpdateStudentInput {
  nama?: string
  kelas?: string
  jenis_kelamin?: JenisKelamin
}

export interface GetStudentsOptions {
  search?: string
  kelas?: string
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

  let countQuery = supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('unit', unit)

  if (options?.search) {
    countQuery = countQuery.ilike('nama', `%${options.search}%`)
  }

  if (options?.kelas) {
    countQuery = countQuery.eq('kelas', options.kelas)
  }

  const { count, error: countError } = await countQuery

  if (countError) throw new Error(countError.message)

  let dataQuery = supabase
    .from('students')
    .select('*')
    .eq('unit', unit)

  if (options?.search) {
    dataQuery = dataQuery.ilike('nama', `%${options.search}%`)
  }

  if (options?.kelas) {
    dataQuery = dataQuery.eq('kelas', options.kelas)
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

  const { data: result, error } = await supabase
    .from('students')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return result as Student
}

export async function updateStudent(
  id: string,
  data: UpdateStudentInput
): Promise<Student> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('students')
    .update(data)
    .eq('id', id)
    .select()
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
  data: { kelas?: string; unit?: Unit }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('students').update(data).in('id', ids)

  if (error) throw new Error(error.message)
}

export async function bulkCreateStudents(
  data: CreateStudentInput[]
): Promise<Student[]> {
  const supabase = createClient()

  const { data: result, error } = await supabase
    .from('students')
    .insert(data)
    .select()

  if (error) throw new Error(error.message)

  return (result ?? []) as Student[]
}

export async function getStudentClasses(unit: Unit): Promise<string[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('students')
    .select('kelas')
    .eq('unit', unit)

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

  return classes.sort((a, b) => a.localeCompare(b, 'id'))
}

export async function searchStudents(
  query: string,
  unit?: Unit
): Promise<Student[]> {
  const supabase = createClient()

  let searchQuery = supabase
    .from('students')
    .select('id, nama, kelas, unit')
    .ilike('nama', `%${query}%`)
    .limit(10)

  if (unit) {
    searchQuery = searchQuery.eq('unit', unit)
  }

  const { data, error } = await searchQuery

  if (error) throw new Error(error.message)

  return (data ?? []) as Student[]
}
