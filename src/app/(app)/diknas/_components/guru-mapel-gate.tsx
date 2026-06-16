'use client'

import { useQuery } from '@tanstack/react-query'
import { BookX } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getGuruMapelAccessStatus } from '@/lib/queries/diknas'

interface GuruMapelGateProps {
  children: ReactNode
}

function GuruMapelGate({ children }: GuruMapelGateProps) {
  const { profile, isLoading: authLoading } = useAuth()

  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ['guru-mapel-access'],
    queryFn: getGuruMapelAccessStatus,
    enabled: profile?.role === 'user',
  })

  if (authLoading || (profile?.role === 'user' && accessLoading)) {
    return <Skeleton className="h-64 w-full rounded-xl" />
  }

  if (profile?.role === 'user' && access && !access.hasMapelConfigured) {
    return (
      <EmptyState
        icon={BookX}
        title="Mata pelajaran belum dikonfigurasi"
        description="Akun Anda belum memiliki mata pelajaran yang terhubung. Hubungi Admin untuk mengatur mata pelajaran Anda."
      />
    )
  }

  return <>{children}</>
}

export { GuruMapelGate }
