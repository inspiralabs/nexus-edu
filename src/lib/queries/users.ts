import { logAudit } from '@/lib/audit/log'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Role } from '@/lib/supabase/types'

type AuditProfileRow = Pick<
  Profile,
  | 'id'
  | 'user_id'
  | 'nama_lengkap'
  | 'guru_mapel'
  | 'username'
  | 'role'
  | 'is_approved'
  | 'avatar_url'
  | 'email'
  | 'created_at'
  | 'updated_at'
>

const VALID_ROLES: Role[] = ['user', 'admin', 'superadmin']

function assertValidRole(value: string): Role {
  const normalized = value.trim().toLowerCase()
  if (!VALID_ROLES.includes(normalized as Role)) {
    throw new Error(`Role "${value}" tidak valid`)
  }
  return normalized as Role
}

function profileToAuditData(profile: AuditProfileRow): Record<string, unknown> {
  return {
    id: profile.id,
    user_id: profile.user_id,
    nama_lengkap: profile.nama_lengkap,
    guru_mapel: profile.guru_mapel,
    username: profile.username,
    role: profile.role,
    is_approved: profile.is_approved,
    avatar_url: profile.avatar_url,
    email: profile.email,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }
}

async function fetchProfileById(profileId: string): Promise<Profile> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single()

  if (error) throw new Error(error.message)

  return data as Profile
}

export async function approveUser(
  profileId: string,
  approvingUserId: string
): Promise<void> {
  const supabase = createClient()
  const oldProfile = await fetchProfileById(profileId)
  const roleValue = assertValidRole(oldProfile.role)
  const updatedAt = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved: true,
      role: roleValue,
      updated_at: updatedAt,
    })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  const verifiedProfile = await fetchProfileById(profileId)

  if (verifiedProfile.is_approved !== true) {
    throw new Error(
      'Gagal menyetujui user. Pastikan hak akses admin dan kebijakan RLS mengizinkan update profiles.'
    )
  }

  await logAudit(
    approvingUserId,
    'APPROVE_USER',
    'profiles',
    profileId,
    profileToAuditData(oldProfile),
    profileToAuditData(verifiedProfile)
  )
}

export async function revokeUser(
  profileId: string,
  revokingUserId: string
): Promise<void> {
  const supabase = createClient()
  const oldProfile = await fetchProfileById(profileId)
  const roleValue = assertValidRole(oldProfile.role)
  const updatedAt = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved: false,
      role: roleValue,
      updated_at: updatedAt,
    })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  const verifiedProfile = await fetchProfileById(profileId)

  if (verifiedProfile.is_approved !== false) {
    throw new Error(
      'Gagal mencabut persetujuan user. Pastikan hak akses admin dan kebijakan RLS mengizinkan update profiles.'
    )
  }

  await logAudit(
    revokingUserId,
    'APPROVE_USER',
    'profiles',
    profileId,
    profileToAuditData(oldProfile),
    profileToAuditData(verifiedProfile)
  )
}

export async function changeUserRole(
  profileId: string,
  newRole: Role,
  changingUserId: string
): Promise<void> {
  const supabase = createClient()
  const oldProfile = await fetchProfileById(profileId)
  const roleValue = assertValidRole(newRole)
  const updatedAt = new Date().toISOString()

  const { error } = await supabase
    .from('profiles')
    .update({
      role: roleValue,
      updated_at: updatedAt,
    })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  const verifiedProfile = await fetchProfileById(profileId)

  if (verifiedProfile.role !== roleValue) {
    throw new Error(
      'Gagal mengubah role user. Pastikan hak akses admin dan kebijakan RLS mengizinkan update profiles.'
    )
  }

  await logAudit(
    changingUserId,
    'CHANGE_ROLE',
    'profiles',
    profileId,
    profileToAuditData(oldProfile),
    profileToAuditData(verifiedProfile)
  )
}
