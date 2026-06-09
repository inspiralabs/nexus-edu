'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getAnalyticsData } from '@/lib/queries/superadmin'

const CHART_PRIMARY = '#2D7A4F'
const CHART_SECONDARY = '#C9A84C'

const UNIT_COLORS: Record<string, string> = {
  SD: CHART_PRIMARY,
  SMP: CHART_SECONDARY,
  SMA: '#DC2626',
  'Tidak Diketahui': '#6B7280',
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

function formatBulanLabel(bulan: string): string {
  const [year, month] = bulan.split('-')
  const monthIndex = Number.parseInt(month, 10) - 1
  if (monthIndex < 0 || monthIndex > 11 || !year) return bulan
  return `${MONTH_LABELS[monthIndex]} ${year}`
}

function ChartSkeleton() {
  return <Skeleton className="h-[300px] w-full" />
}

export default function SuperadminAnalyticsPage() {
  const router = useRouter()
  const { isSuperadmin, isLoading: authLoading } = useAuth()
  const currentYear = new Date().getFullYear()

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - index),
    [currentYear]
  )

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear))

  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      router.replace('/dashboard')
    }
  }, [authLoading, isSuperadmin, router])

  const tahunFilter =
    selectedYear === 'all'
      ? undefined
      : Number.parseInt(selectedYear, 10)

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-analytics', tahunFilter],
    queryFn: () => getAnalyticsData(tahunFilter),
    enabled: isSuperadmin,
  })

  const userTrenData = useMemo(
    () =>
      (data?.userTrenBulanan ?? []).map((item) => ({
        bulan: formatBulanLabel(item.bulan),
        count: item.count,
      })),
    [data?.userTrenBulanan]
  )

  const multiSeriesData = useMemo(() => {
    const bulanSet = new Set<string>()
    for (const item of data?.kedisiplinanTren ?? []) {
      bulanSet.add(item.bulan)
    }
    for (const item of data?.prestasiTren ?? []) {
      bulanSet.add(item.bulan)
    }

    return Array.from(bulanSet)
      .sort((a, b) => a.localeCompare(b))
      .map((bulan) => ({
        bulan: formatBulanLabel(bulan),
        kedisiplinan:
          data?.kedisiplinanTren.find((item) => item.bulan === bulan)
            ?.count ?? 0,
        prestasi:
          data?.prestasiTren.find((item) => item.bulan === bulan)?.count ?? 0,
      }))
  }, [data?.kedisiplinanTren, data?.prestasiTren])

  const unitPieData = useMemo(
    () =>
      (data?.siswaPerUnit ?? []).map((item) => ({
        name: item.unit,
        value: item.count,
      })),
    [data?.siswaPerUnit]
  )

  const topKedisiplinanData = useMemo(
    () =>
      (data?.top10Kedisiplinan ?? []).map((item) => ({
        label: `${item.nama} (${item.kelas})`,
        count: item.count,
      })),
    [data?.top10Kedisiplinan]
  )

  const topPrestasiData = useMemo(
    () =>
      (data?.top10Prestasi ?? []).map((item) => ({
        label: `${item.nama} (${item.kelas})`,
        count: item.count,
      })),
    [data?.top10Prestasi]
  )

  if (authLoading || !isSuperadmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Advanced Analytics" />

      <div className="flex items-center gap-3">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Pilih Tahun" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tahun</SelectItem>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tren User Baru per Bulan</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : userTrenData.length === 0 ? (
              <EmptyState
                title="Tidak ada data"
                description="Belum ada user baru pada filter ini"
                className="py-12"
              />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userTrenData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis
                    dataKey="bulan"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'var(--text-secondary)' }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="User Baru" fill={CHART_PRIMARY} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Kedisiplinan vs Prestasi per Bulan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : multiSeriesData.length === 0 ? (
              <EmptyState
                title="Tidak ada data"
                description="Belum ada entri data pada filter ini"
                className="py-12"
              />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={multiSeriesData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis
                    dataKey="bulan"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'var(--text-secondary)' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="kedisiplinan"
                    name="Kedisiplinan"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                    dot={{ fill: CHART_PRIMARY }}
                  />
                  <Line
                    type="monotone"
                    dataKey="prestasi"
                    name="Prestasi"
                    stroke={CHART_SECONDARY}
                    strokeWidth={2}
                    dot={{ fill: CHART_SECONDARY }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Siswa per Unit</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : unitPieData.length === 0 ? (
              <EmptyState
                title="Tidak ada data"
                description="Belum ada data siswa"
                className="py-12"
              />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={unitPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {unitPieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={UNIT_COLORS[entry.name] ?? CHART_PRIMARY}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top 10 Siswa Kasus Kedisiplinan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : topKedisiplinanData.length === 0 ? (
              <EmptyState
                title="Tidak ada data"
                description="Belum ada kasus kedisiplinan"
                className="py-12"
              />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topKedisiplinanData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis type="number" tick={{ fill: 'var(--text-secondary)' }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Jumlah Kasus" fill={CHART_PRIMARY} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Top 10 Siswa Prestasi Terbanyak
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : topPrestasiData.length === 0 ? (
              <EmptyState
                title="Tidak ada data"
                description="Belum ada data prestasi"
                className="py-12"
              />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topPrestasiData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis type="number" tick={{ fill: 'var(--text-secondary)' }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    name="Jumlah Prestasi"
                    fill={CHART_SECONDARY}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
