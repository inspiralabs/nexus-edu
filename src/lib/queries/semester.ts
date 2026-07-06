// src/lib/queries/semester.ts
// Query functions untuk Tahun Pelajaran dan Semester

import { createClient } from '@/lib/supabase/client'
import type { Semester, TahunPelajaran } from '@/lib/supabase/types'

export type { Semester, TahunPelajaran }

export interface CreateTahunPelajaranInput {
  nama: string
  tahun_mulai: number
  tahun_selesai: number
}

export interface UpdateTahunPelajaranInput {
  nama?: string
  tahun_mulai?: number
  tahun_selesai?: number
}

export interface CreateSemesterInput {
  tahun_pelajaran_id: string
  nomor_semester: 1 | 2
  tanggal_mulai: string
  tanggal_selesai: string
}

export interface UpdateSemesterInput {
  nomor_semester?: 1 | 2
  tanggal_mulai?: string
  tanggal_selesai?: string
}

// ─── Tahun Pelajaran ──────────────────────────────────────────────────────────

export async function getTahunPelajaran(): Promise<TahunPelajaran[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tahun_pelajaran')
    .select('*')
    .order('tahun_mulai', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as TahunPelajaran[]
}

export async function getActiveTahunPelajaran(): Promise<TahunPelajaran | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tahun_pelajaran')
    .select('*')
    .eq('is_aktif', true)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as TahunPelajaran | null
}

export async function createTahunPelajaran(
  input: CreateTahunPelajaranInput
): Promise<TahunPelajaran> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tahun_pelajaran')
    .insert({ ...input, is_aktif: false })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as TahunPelajaran
}

export async function updateTahunPelajaran(
  id: string,
  input: UpdateTahunPelajaranInput
): Promise<TahunPelajaran> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tahun_pelajaran')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as TahunPelajaran
}

export async function deleteTahunPelajaran(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('tahun_pelajaran')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function setActiveTahunPelajaran(id: string): Promise<void> {
  if (!id || id.trim() === '') {
    throw new Error('ID tahun pelajaran tidak valid')
  }

  const supabase = createClient()

  // 1. Nonaktifkan semua yang sedang aktif (hindari .neq('id', '') — invalid UUID)
  const { error: resetError } = await supabase
    .from('tahun_pelajaran')
    .update({ is_aktif: false })
    .eq('is_aktif', true)

  if (resetError) throw new Error(resetError.message)

  // 2. Aktifkan yang dipilih
  const { error } = await supabase
    .from('tahun_pelajaran')
    .update({ is_aktif: true })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ─── Semester ─────────────────────────────────────────────────────────────────

export async function getSemester(tahunPelajaranId: string): Promise<Semester[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('semester')
    .select('*')
    .eq('tahun_pelajaran_id', tahunPelajaranId)
    .order('nomor_semester', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Semester[]
}

export async function getActiveSemester(): Promise<Semester | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('semester')
    .select('*, tahun_pelajaran(*)')
    .eq('is_aktif', true)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as Semester | null
}

export async function createSemester(
  input: CreateSemesterInput
): Promise<Semester> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('semester')
    .insert({ ...input, is_aktif: false })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Semester
}

export async function updateSemester(
  id: string,
  input: UpdateSemesterInput
): Promise<Semester> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('semester')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Semester
}

export async function deleteSemester(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('semester')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function setActiveSemester(
  id: string,
  tahunPelajaranId: string
): Promise<void> {
  if (!id || id.trim() === '') {
    throw new Error('ID semester tidak valid')
  }
  if (!tahunPelajaranId || tahunPelajaranId.trim() === '') {
    throw new Error('ID tahun pelajaran tidak valid')
  }

  const supabase = createClient()

  // 1. Nonaktifkan SEMUA semester aktif di seluruh sistem (single-active global)
  const { error: resetError } = await supabase
    .from('semester')
    .update({ is_aktif: false })
    .eq('is_aktif', true)

  if (resetError) throw new Error(resetError.message)

  // 2. Aktifkan semester yang dipilih
  const { error } = await supabase
    .from('semester')
    .update({ is_aktif: true })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function getAllSemesters(): Promise<Semester[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('semester')
    .select('*, tahun_pelajaran(*)')
    .order('tanggal_mulai', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Semester[]
}

