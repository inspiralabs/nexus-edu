import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'

export interface UpdateProfileInput {
  nama_lengkap: string
  guru_mapel: string
}

export async function updateProfile(
  userId: string,
  data: UpdateProfileInput
): Promise<Profile> {
  const supabase = createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .update({
      nama_lengkap: data.nama_lengkap,
      guru_mapel: data.guru_mapel,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  return profile as Profile
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = createClient()
  const path = `${userId}/avatar`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function updateAvatarUrl(
  userId: string,
  avatarUrl: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function changePassword(newPassword: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) throw new Error(error.message)
}
