import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Unit } from '@/lib/supabase/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDivisiLabel(
  namaDivisi?: string | null,
  unit?: Unit | null
): string {
  if (!namaDivisi) return '-'
  return unit ? `${namaDivisi} ${unit}` : namaDivisi
}
