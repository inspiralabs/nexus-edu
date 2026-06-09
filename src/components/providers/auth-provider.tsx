'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/types'

interface AuthContextType {
  profile: Profile | null
  isLoading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext harus digunakan di dalam AuthProvider')
  }
  return context
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        setProfile(null)
        return
      }

      setProfile(data)
    },
    [supabase]
  )

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    router.push('/login')
  }, [router, supabase])

  useEffect(() => {
    const initSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await fetchProfile(user.id)
      } else {
        setProfile(null)
      }

      setIsLoading(false)
    }

    initSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile, supabase])

  const value = useMemo(
    () => ({
      profile,
      isLoading,
      logout,
    }),
    [profile, isLoading, logout]
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export { AuthProvider, useAuthContext }
