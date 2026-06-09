'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Clock,
  ShieldAlert,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { StatCard } from '@/components/shared/stat-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import {
  approveUser,
  getAdminStats,
  getPendingUsers,
  getRecentAuditLog,
} from '@/lib/queries/admin'
import type { AuditLog, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

function formatTanggal(value: string): string {
  try {
    return format(parseISO(value), 'dd/MM/yyyy HH:mm')
  } catch {
    return format(new Date(value), 'dd/MM/yyyy HH:mm')
  }
}

function formatTanggalDaftar(value: string): string {
  try {
    return format(parseISO(value), 'dd/MM/yyyy')
  } catch {
    return format(new Date(value), 'dd/MM/yyyy')
  }
}

function getAuditUserName(entry: AuditLog): string {
  const profile = entry.profiles
  if (!profile) return '-'
  if (Array.isArray(profile)) {
    return profile[0]?.nama_lengkap ?? '-'
  }
  return profile.nama_lengkap ?? '-'
}

function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="flex items-center gap-4 p-6">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PendingStatCard({
  title,
  value,
}: {
  title: string
  value: number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            'bg-status-yellow-bg text-status-yellow'
          )}
        >
          <Clock className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-[var(--text-secondary)]">{title}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function PendingRow({
  user,
  onApprove,
  isApproving,
}: {
  user: Profile
  onApprove: (profileId: string) => void
  isApproving: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-[var(--text-primary)]">
          {user.nama_lengkap}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          @{user.username}
          {user.guru_mapel ? ` · ${user.guru_mapel}` : ''}
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">
          Daftar: {formatTanggalDaftar(user.created_at)}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => onApprove(user.id)}
        isLoading={isApproving}
      >
        <UserCheck className="mr-2 h-4 w-4" />
        Setujui
      </Button>
    </div>
  )
}

export default function AdminOverviewPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAdmin, isLoading: authLoading, profile } = useAuth()

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/dashboard')
    }
  }, [authLoading, isAdmin, router])

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
    enabled: isAdmin,
  })

  const { data: pendingUsers = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['admin-pending-users'],
    queryFn: getPendingUsers,
    enabled: isAdmin,
  })

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ['admin-recent-audit'],
    queryFn: () => getRecentAuditLog(5),
    enabled: isAdmin,
  })

  const invalidateAdminQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    queryClient.invalidateQueries({ queryKey: ['admin-pending-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-recent-audit'] })
    queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
  }

  const approveMutation = useMutation({
    mutationFn: (profileId: string) => {
      const userId = profile?.user_id
      if (!userId) throw new Error('Sesi tidak valid')
      return approveUser(profileId, userId)
    },
    onSuccess: () => {
      invalidateAdminQueries()
      toast({
        title: 'Berhasil',
        description: 'User berhasil disetujui',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  if (authLoading || !isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Admin Overview
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Ringkasan statistik dan aktivitas terbaru platform
        </p>
      </div>

      {statsLoading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total User"
            value={stats?.totalUsers ?? 0}
            icon={Users}
            variant="primary"
          />
          <PendingStatCard
            title="User Pending"
            value={stats?.pendingUsers ?? 0}
          />
          <StatCard
            title="Total Siswa"
            value={stats?.totalStudents ?? 0}
            icon={Users}
          />
          <StatCard
            title="Total Kedisiplinan"
            value={stats?.totalKedisiplinan ?? 0}
            icon={ShieldAlert}
          />
          <StatCard
            title="Total Prestasi"
            value={stats?.totalPrestasi ?? 0}
            icon={Trophy}
            variant="secondary"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : pendingUsers.length === 0 ? (
            <EmptyState
              title="Tidak ada user pending"
              description="Semua pendaftaran sudah diproses."
            />
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <PendingRow
                  key={user.id}
                  user={user}
                  onApprove={(profileId) =>
                    approveMutation.mutate(profileId)
                  }
                  isApproving={
                    approveMutation.isPending &&
                    approveMutation.variables === user.id
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-[var(--border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Tabel</TableHead>
                  <TableHead>Record ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 5 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48">
                      <EmptyState
                        title="Belum ada aktivitas"
                        description="Log audit akan muncul di sini."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatTanggal(entry.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getAuditUserName(entry)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.action ?? '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.table_name ?? '-'}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate font-mono text-xs">
                        {entry.record_id ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
