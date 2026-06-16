import { createClient } from '@/lib/supabase/client'
import type { Kamar, Profile, Unit } from '@/lib/supabase/types'

export interface GetKamarOptions {
  unit?: Unit
  search?: string
  page?: number
  pageSize?: number
}

export interface CreateKamarInput {
  nama_kamar: string
  unit: Unit
  musyrif_id: string | null
}

export interface UpdateKamarInput {
  nama_kamar?: string
  unit?: Unit
  musyrif_id?: string | null
}

export async function getKamar(
  options: GetKamarOptions = {}
): Promise<{ data: Kamar[]; total: number }> {
  const supabase = createClient()
  const { unit, search, page = 1, pageSize = 10 } = options

  let query = supabase
    .from('kamar')
    .select('*, profiles:musyrif_id(id, nama_lengkap, username, email)', { count: 'exact' })
    .order('nama_kamar', { ascending: true })

  if (unit) query = query.eq('unit', unit)
  if (search) query = query.ilike('nama_kamar', `%${search}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as Kamar[],
    total: count ?? 0,
  }
}

export async function createKamar(input: CreateKamarInput): Promise<Kamar> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kamar')
    .insert(input)
    .select('*, profiles:musyrif_id(id, nama_lengkap, username, email)')
    .single()

  if (error) throw new Error(error.message)
  return data as Kamar
}

export async function updateKamar(id: string, input: UpdateKamarInput): Promise<Kamar> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kamar')
    .update(input)
    .eq('id', id)
    .select('*, profiles:musyrif_id(id, nama_lengkap, username, email)')
    .single()

  if (error) throw new Error(error.message)
  return data as Kamar
}

export async function deleteKamar(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('kamar').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getMusyrifOptions(): Promise<Pick<Profile, 'id' | 'nama_lengkap' | 'username' | 'email'>[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nama_lengkap, username, email')
    .or('tipe_role.eq.musyrif,tipe_role.eq.guru_musyrif,is_musyrif.eq.true')
    .eq('is_approved', true)
    .order('nama_lengkap', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}
