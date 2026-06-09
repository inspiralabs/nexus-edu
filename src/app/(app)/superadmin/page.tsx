'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import {
  Bell,
  BookOpen,
  Building2,
  Calendar,
  GraduationCap,
  ShieldAlert,
  Trophy,
  Users,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { StatCard } from '@/components/shared/stat-card'
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
import { useAuth } from '@/hooks/use-auth'
import {
  getActivityLast7Days,
  getSystemStats,
  getTopActiveUsers,
} from '@/lib/queries/superadmin'

const CHART_PRIMARY = '#2D7A4F'

function formatChartDate(value: string): string {
  try {
    return format(parseISO(value), 'dd MMM', { locale: idLocale })
  } catch {
    return value
  }
}

function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
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

export default function SuperadminDashboardPage() {
  const router = useRouter()
  const { isSuperadmin, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      router.replace('/dashboard')
    }
  }, [authLoading, isSuperadmin, router])

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['superadmin-system-stats'],
    queryFn: getSystemStats,
    enabled: isSuperadmin,
  })

  const { data: activityData = [], isLoading: activityLoading } = useQuery({
    queryKey: ['superadmin-activity-7-days'],
    queryFn: getActivityLast7Days,
    enabled: isSuperadmin,
  })

  const { data: topUsers = [], isLoading: topUsersLoading } = useQuery({
    queryKey: ['superadmin-top-active-users'],
    queryFn: () => getTopActiveUsers(5),
    enabled: isSuperadmin,
  })

  const chartData = activityData.map((item) => ({
    tanggal: formatChartDate(item.date),
    count: item.count,
  }))

  if (authLoading || !isSuperadmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Super Dashboard" />

      {statsLoading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Profiles"
            value={stats?.profiles ?? 0}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Students"
            value={stats?.students ?? 0}
            icon={GraduationCap}
            variant="secondary"
          />
          <StatCard
            title="Kedisiplinan"
            value={stats?.kedisiplinan ?? 0}
            icon={ShieldAlert}
            variant="default"
          />
          <StatCard
            title="Prestasi"
            value={stats?.prestasi ?? 0}
            icon={Trophy}
            variant="secondary"
          />
          <StatCard
            title="Kategori Disiplin"
            value={stats?.kategoriDisiplin ?? 0}
            icon={BookOpen}
            variant="default"
          />
          <StatCard
            title="Divisi"
            value={stats?.divisi ?? 0}
            icon={Building2}
            variant="default"
          />
          <StatCard
            title="Event"
            value={stats?.event ?? 0}
            icon={Calendar}
            variant="primary"
          />
          <StatCard
            title="Announcements"
            value={stats?.announcements ?? 0}
            icon={Bell}
            variant="default"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktivitas 7 Hari</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : chartData.length === 0 ? (
              <EmptyState
                title="Belum ada aktivitas"
                description="Tidak ada aksi audit log dalam 7 hari terakhir"
                className="py-12"
              />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis
                    dataKey="tanggal"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'var(--text-secondary)' }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Jumlah Aksi"
                    fill={CHART_PRIMARY}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            {topUsersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : topUsers.length === 0 ? (
              <EmptyState
                title="Belum ada data"
                description="Tidak ada aktivitas pengguna tercatat"
                className="py-12"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="text-right">Jumlah Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topUsers.map((user, index) => (
                    <TableRow key={`${user.nama_lengkap}-${index}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{user.nama_lengkap}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {user.action_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
