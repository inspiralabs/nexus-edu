import { logAudit } from '@/lib/audit/log'
import { createClient } from '@/lib/supabase/client'
import type {
  Announcement,
  AuditLog,
  Profile,
  Role,
} from '@/lib/supabase/types'

export {
  approveUser,
  changeUserRole,
  getManageableProfiles,
  revokeUser,
  updateManageableProfile,
} from '@/lib/queries/users'
export type {
  CreateManageableUserInput,
  ManageableRole,
  UpdateManageableProfileInput,
} from '@/lib/queries/users'

export interface GetAllProfilesOptions {
  role?: Role
  isApproved?: boolean
  page?: number
  pageSize?: number
  manageableOnly?: boolean
}

export interface AdminStats {
  totalUsers: number
  pendingUsers: number
  totalStudents: number
  totalKedisiplinan: number
  totalPrestasi: number
}

export interface CreateAnnouncementInput {
  title: string
  content: string
}

export interface UpdateAnnouncementInput {
  title: string
  content: string
}

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

function applyProfileFilters<
  T extends {
    eq: (column: string, value: Role | boolean) => T
    in: (column: string, values: Role[]) => T
  },
>(query: T, options?: GetAllProfilesOptions): T {
  let filteredQuery = query

  if (options?.manageableOnly) {
    filteredQuery = filteredQuery.in('role', ['user', 'admin'])
  }

  if (options?.role !== undefined) {
    filteredQuery = filteredQuery.eq('role', options.role)
  }

  if (options?.isApproved !== undefined) {
    filteredQuery = filteredQuery.eq('is_approved', options.isApproved)
  }

  return filteredQuery
}

export async function getAllProfiles(
  options?: GetAllProfilesOptions
): Promise<{ data: Profile[]; total: number }> {
  const supabase = createClient()
  const page = options?.page ?? 1
  const pageSize = options?.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let countQuery = supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  countQuery = applyProfileFilters(countQuery, options)

  const { count, error: countError } = await countQuery

  if (countError) throw new Error(countError.message)

  let dataQuery = supabase.from('profiles').select('*')

  dataQuery = applyProfileFilters(dataQuery, options)

  const { data, error } = await dataQuery
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []) as Profile[],
    total: count ?? 0,
  }
}

export async function deleteProfile(
  profileId: string,
  deletingUserId: string
): Promise<void> {
  const supabase = createClient()
  const oldProfile = await fetchProfileById(profileId)

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  await logAudit(
    deletingUserId,
    'DELETE',
    'profiles',
    profileId,
    profileToAuditData(oldProfile),
    null
  )
}

export async function getPendingUsers(): Promise<Profile[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_approved', false)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []) as Profile[]
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createClient()

  const [
    { count: totalUsers, error: totalUsersError },
    { count: pendingUsers, error: pendingUsersError },
    { count: totalStudents, error: totalStudentsError },
    { count: totalKedisiplinan, error: totalKedisiplinanError },
    { count: totalPrestasi, error: totalPrestasiError },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_approved', false),
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('kedisiplinan').select('*', { count: 'exact', head: true }),
    supabase.from('prestasi').select('*', { count: 'exact', head: true }),
  ])

  if (totalUsersError) throw new Error(totalUsersError.message)
  if (pendingUsersError) throw new Error(pendingUsersError.message)
  if (totalStudentsError) throw new Error(totalStudentsError.message)
  if (totalKedisiplinanError) throw new Error(totalKedisiplinanError.message)
  if (totalPrestasiError) throw new Error(totalPrestasiError.message)

  return {
    totalUsers: totalUsers ?? 0,
    pendingUsers: pendingUsers ?? 0,
    totalStudents: totalStudents ?? 0,
    totalKedisiplinan: totalKedisiplinan ?? 0,
    totalPrestasi: totalPrestasi ?? 0,
  }
}

export async function getRecentAuditLog(
  limit: number = 5
): Promise<AuditLog[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('audit_log')
    .select('*, profiles(nama_lengkap)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []) as AuditLog[]
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .neq('title', 'SYSTEM_CONFIG')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []) as Announcement[]
}

export async function createAnnouncement(
  data: CreateAnnouncementInput
): Promise<Announcement> {
  const supabase = createClient()

  const { data: announcement, error } = await supabase
    .from('announcements')
    .insert({
      title: data.title,
      content: data.content,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return announcement as Announcement
}

export async function updateAnnouncement(
  id: string,
  data: UpdateAnnouncementInput
): Promise<Announcement> {
  const supabase = createClient()

  const { data: announcement, error } = await supabase
    .from('announcements')
    .update({
      title: data.title,
      content: data.content,
    })
    .eq('id', id)
    .neq('title', 'SYSTEM_CONFIG')
    .select()
    .single()

  if (error) throw new Error(error.message)

  return announcement as Announcement
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)
    .neq('title', 'SYSTEM_CONFIG')

  if (error) throw new Error(error.message)
}
