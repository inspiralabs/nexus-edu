import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'

export interface UpdateProfileInput {
  nama_lengkap: string
  guru_mapel: string
}

function getFileExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName
  }

  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }

  return mimeMap[file.type] ?? 'jpg'
}

async function removeOtherAvatars(
  userId: string,
  keepPath: string
): Promise<void> {
  const supabase = createClient()

  const { data: files, error } = await supabase.storage
    .from('avatars')
    .list(userId)

  if (error || !files?.length) {
    return
  }

  const pathsToRemove = files
    .map((file) => `${userId}/${file.name}`)
    .filter((path) => path !== keepPath)

  if (pathsToRemove.length > 0) {
    await supabase.storage.from('avatars').remove(pathsToRemove)
  }
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
  const extension = getFileExtension(file)
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`
  const path = `${userId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    })

  if (uploadError) throw new Error(uploadError.message)

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('avatar_url')
    .single()

  if (updateError) {
    await supabase.storage.from('avatars').remove([path])
    throw new Error(updateError.message)
  }

  if (updatedProfile?.avatar_url !== publicUrl) {
    await supabase.storage.from('avatars').remove([path])
    throw new Error('Gagal memperbarui avatar_url di database')
  }

  await removeOtherAvatars(userId, path)

  return publicUrl
}

export async function updateAvatarUrl(
  userId: string,
  avatarUrl: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function changePassword(newPassword: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) throw new Error(error.message)
}
