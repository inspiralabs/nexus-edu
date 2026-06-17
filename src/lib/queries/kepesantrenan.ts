import { createClient } from '@/lib/supabase/client'

export async function getMissingMutabaahDates(
  semesterId: string,
  musyrifId: string,
  startDate: string,
  endDate: string
) {
  const supabase = createClient()
  console.log('CALLING SUPABASE RPC get_missing_mutabaah_dates WITH:', {
    semester_id: semesterId,
    musyrif_id: musyrifId,
    start_date: startDate,
    end_date: endDate,
  })
  const { data, error } = await supabase.rpc('get_missing_mutabaah_dates', {
    semester_id: semesterId,
    musyrif_id: musyrifId,
    start_date: startDate,
    end_date: endDate,
  })
  if (error) {
    console.error("SUPABASE RPC RAW ERROR:", error)
    throw error
  }
  return data ? data.map((item: { missing_date: string }) => new Date(item.missing_date)) : []
}
