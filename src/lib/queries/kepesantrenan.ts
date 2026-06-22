import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

export async function getMissingMutabaahDates(
  semesterId: string,
  musyrifId: string,
  startDate: string,
  endDate: string,
  kamarNama?: string
) {
  const supabase = createClient()

  if (!kamarNama || kamarNama === 'all') {
    return []
  }

  // 1. Get all students in this room
  const { data: students, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('kamar', kamarNama)
    .eq('is_alumni', false)

  if (studentError) throw studentError
  if (!students || students.length === 0) return []

  const studentIds = students.map((s) => s.id)

  // 2. Fetch all filled dates for these students
  const { data: filledData, error: filledError } = await supabase
    .from('mutabaah')
    .select('tanggal')
    .in('siswa_id', studentIds)
    .gte('tanggal', startDate)
    .lte('tanggal', endDate)

  if (filledError) throw filledError

  const filledDates = new Set(filledData?.map((d) => d.tanggal) ?? [])

  // 3. Fetch all holidays in range
  const { data: holidays, error: holidaysError } = await supabase
    .from('hari_libur')
    .select('tanggal')
    .gte('tanggal', startDate)
    .lte('tanggal', endDate)

  if (holidaysError) throw holidaysError
  const holidaySet = new Set(holidays?.map((h) => h.tanggal) ?? [])

  // 4. Generate all dates between startDate and today/endDate
  const start = new Date(startDate)
  const end = new Date(endDate)
  const today = new Date()
  const limit = end < today ? end : today

  const missingDates: Date[] = []
  let curr = new Date(start)
  while (curr <= limit) {
    const dateStr = format(curr, 'yyyy-MM-dd')
    // A date is missing if it has no filled entries and is not a holiday
    if (!filledDates.has(dateStr) && !holidaySet.has(dateStr)) {
      missingDates.push(new Date(curr))
    }
    curr.setDate(curr.getDate() + 1)
  }

  return missingDates
}

