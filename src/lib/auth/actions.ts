'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { CreateManageableUserInput } from '@/lib/queries/users'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

interface SignupFormData {
  nama_lengkap: string
  guru_mapel: string
  email: string
  username: string
  password: string
}

export async function login(
  username: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const normalizedUsername = username.trim().toLowerCase()

  const { data: profileByUsername, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .ilike('username', normalizedUsername)
    .single()

  if (profileError || !profileByUsername?.email) {
    return { error: 'Username tidak ditemukan' }
  }

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: profileByUsername.email,
      password,
    })

  if (authError || !authData.user) {
    return { error: 'Password salah' }
  }

  const { data: profile, error: approvalError } = await supabase
    .from('profiles')
    .select('is_approved')
    .eq('user_id', authData.user.id)
    .single()

  if (approvalError || !profile) {
    await supabase.auth.signOut()
    return { error: 'Username tidak ditemukan' }
  }

  if (!profile.is_approved) {
    await supabase.auth.signOut()
    return {
      error:
        'Akun belum disetujui oleh Admin. Silakan hubungi administrator.',
    }
  }

  try {
    revalidatePath('/')
    redirect('/dashboard')
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('NEXT_REDIRECT')
    ) {
      throw error
    }
    return { error: 'Terjadi kesalahan saat login' }
  }
}

function isAuthUserAlreadyExists(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('already') ||
    normalized.includes('registered') ||
    normalized.includes('exists')
  )
}

export async function signup(
  formData: SignupFormData
): Promise<{ error?: string; success?: boolean }> {
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      error:
        'Konfigurasi server tidak lengkap. Tambahkan SUPABASE_SERVICE_ROLE_KEY di environment.',
    }
  }

  const supabase = await createClient()
  const normalizedUsername = formData.username.trim().toLowerCase()
  const email = formData.email.trim().toLowerCase()
  const namaLengkap = formData.nama_lengkap.trim()
  const guruMapel = formData.guru_mapel.trim()

  const { data: existingProfile, error: checkError } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', normalizedUsername)
    .maybeSingle()

  if (checkError) {
    return { error: 'Gagal memeriksa username' }
  }

  if (existingProfile) {
    return { error: 'Username sudah digunakan' }
  }

  const { data: existingEmailProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingEmailProfile) {
    return { error: 'Email sudah terdaftar' }
  }

  let userId: string

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: formData.password,
    options: {
      data: {
        nama_lengkap: namaLengkap,
        username: normalizedUsername,
      },
    },
  })

  if (signUpError) {
    if (!isAuthUserAlreadyExists(signUpError.message)) {
      return { error: signUpError.message }
    }

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password: formData.password,
      })

    if (signInError || !signInData.user) {
      return {
        error:
          'Email sudah terdaftar. Gunakan email lain atau hubungi administrator.',
      }
    }

    userId = signInData.user.id
    await supabase.auth.signOut()

    const { data: existingUserProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingUserProfile) {
      return { error: 'Akun sudah terdaftar. Silakan login.' }
    }
  } else if (!authData.user) {
    return { error: 'Gagal membuat akun' }
  } else {
    userId = authData.user.id
    await supabase.auth.signOut()
  }

  const { error: insertError } = await admin.from('profiles').insert({
    user_id: userId,
    nama_lengkap: namaLengkap,
    guru_mapel: guruMapel,
    username: normalizedUsername,
    email,
    role: 'user',
    is_approved: false,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: recoveredProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (recoveredProfile) {
        return { success: true }
      }

      return { error: 'Username sudah digunakan' }
    }

    return { error: 'Gagal membuat profil akun' }
  }

  return { success: true }
}

function createIsolatedAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Konfigurasi Supabase tidak lengkap')
  }

  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

async function assertAdminAccess(): Promise<
  { error: string } | { adminUserId: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Anda harus login sebagai admin' }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      error:
        'Konfigurasi server tidak lengkap. Tambahkan SUPABASE_SERVICE_ROLE_KEY di environment.',
    }
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return { error: 'Profil admin tidak ditemukan' }
  }

  if (profile.role !== 'admin' && profile.role !== 'superadmin') {
    return { error: 'Akses ditolak. Hanya admin yang dapat menambah pengguna.' }
  }

  return { adminUserId: user.id }
}

export async function createManageableUserByAdmin(
  formData: CreateManageableUserInput
): Promise<{ error?: string; success?: boolean; profileId?: string }> {
  const access = await assertAdminAccess()
  if ('error' in access) {
    return { error: access.error }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      error:
        'Konfigurasi server tidak lengkap. Tambahkan SUPABASE_SERVICE_ROLE_KEY di environment.',
    }
  }

  const normalizedUsername = formData.username.trim().toLowerCase()
  const email = formData.email.trim().toLowerCase()
  const namaLengkap = formData.nama_lengkap.trim()
  const guruMapel = formData.guru_mapel.trim()
  const roleValue = formData.role === 'admin' ? 'admin' : 'user'

  const { data: existingProfile, error: checkError } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', normalizedUsername)
    .maybeSingle()

  if (checkError) {
    return { error: 'Gagal memeriksa username' }
  }

  if (existingProfile) {
    return { error: 'Username sudah digunakan' }
  }

  const { data: existingEmailProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingEmailProfile) {
    return { error: 'Email sudah terdaftar' }
  }

  let signUpClient
  try {
    signUpClient = createIsolatedAuthClient()
  } catch {
    return { error: 'Konfigurasi Supabase tidak lengkap' }
  }

  const { data: authData, error: signUpError } =
    await signUpClient.auth.signUp({
      email,
      password: formData.password,
      options: {
        data: {
          nama_lengkap: namaLengkap,
          username: normalizedUsername,
        },
      },
    })

  if (signUpError) {
    if (isAuthUserAlreadyExists(signUpError.message)) {
      return { error: 'Email sudah terdaftar di sistem autentikasi' }
    }
    return { error: signUpError.message }
  }

  if (!authData.user) {
    return { error: 'Gagal membuat akun autentikasi' }
  }

  const userId = authData.user.id

  const { data: insertedProfile, error: insertError } = await admin
    .from('profiles')
    .insert({
      user_id: userId,
      nama_lengkap: namaLengkap,
      guru_mapel: guruMapel,
      username: normalizedUsername,
      email,
      role: roleValue,
      is_approved: true,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'Username atau email sudah digunakan' }
    }
    return { error: 'Gagal membuat profil pengguna' }
  }

  await admin.from('audit_log').insert({
    user_id: access.adminUserId,
    action: 'CREATE',
    table_name: 'profiles',
    record_id: insertedProfile.id,
    old_data: null,
    new_data: {
      user_id: userId,
      nama_lengkap: namaLengkap,
      guru_mapel: guruMapel,
      username: normalizedUsername,
      email,
      role: roleValue,
      is_approved: true,
    },
  })

  revalidatePath('/admin/users')

  return { success: true, profileId: insertedProfile.id }
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
