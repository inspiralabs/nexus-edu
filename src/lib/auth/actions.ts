'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
