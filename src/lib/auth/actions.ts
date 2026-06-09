'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

export async function signup(
  formData: SignupFormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()

  const { data: existingProfile, error: checkError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', formData.username)
    .maybeSingle()

  if (checkError) {
    return { error: 'Gagal memeriksa username' }
  }

  if (existingProfile) {
    return { error: 'Username sudah digunakan' }
  }

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
  })

  if (signUpError) {
    return { error: signUpError.message }
  }

  if (!authData.user) {
    return { error: 'Gagal membuat akun' }
  }

  const { error: insertError } = await supabase.from('profiles').insert({
    user_id: authData.user.id,
    nama_lengkap: formData.nama_lengkap,
    guru_mapel: formData.guru_mapel,
    username: formData.username,
    email: formData.email,
    role: 'user',
    is_approved: false,
  })

  if (insertError) {
    return { error: 'Gagal membuat profil akun' }
  }

  return { success: true }
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
