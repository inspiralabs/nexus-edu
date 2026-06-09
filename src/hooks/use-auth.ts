'use client'

import { useAuthContext } from '@/components/providers/auth-provider'

export function useAuth() {
  const { profile, isLoading, logout, refreshProfile } = useAuthContext()

  return {
    profile,
    isLoading,
    logout,
    refreshProfile,
    isUser: profile?.role === 'user',
    isAdmin:
      profile?.role === 'admin' || profile?.role === 'superadmin',
    isSuperadmin: profile?.role === 'superadmin',
  }
}
