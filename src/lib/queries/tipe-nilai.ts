import { createClient } from '@/lib/supabase/client'
import type { TipeNilaiDb } from '@/lib/supabase/types'

export interface CreateTipeNilaiInput {
  nama_tipe: string
  jenis_nilai: 'Harian' | 'Ujian Akhir Bab' | 'Ujian Akhir Semester'
  deskripsi?: string | null
}

export interface UpdateTipeNilaiInput {
  nama_tipe?: string
  jenis_nilai?: 'Harian' | 'Ujian Akhir Bab' | 'Ujian Akhir Semester'
  deskripsi?: string | null
}

export async function getTipeNilai(): Promise<TipeNilaiDb[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tipe_nilai')
    .select('*')
    .order('nama_tipe', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as TipeNilaiDb[]
}

export async function createTipeNilai(
  input: CreateTipeNilaiInput
): Promise<TipeNilaiDb> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tipe_nilai')
    .insert(input)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as TipeNilaiDb
}

export async function updateTipeNilai(
  id: string,
  input: UpdateTipeNilaiInput
): Promise<TipeNilaiDb> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tipe_nilai')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as TipeNilaiDb
}

export async function deleteTipeNilai(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('tipe_nilai').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
