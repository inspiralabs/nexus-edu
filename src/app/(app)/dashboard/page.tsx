'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  LayoutDashboard,
  ShieldAlert,
  Trophy,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getKedisiplinanStatusCount,
  getKedisiplinanTopKategori,
  getPrestasiByUnit,
  getRecentKedisiplinan,
  getStudentCounts,
  getStudentsByClass,
} from '@/lib/queries/dashboard'
import type {
  Kedisiplinan,
  StatusKedisiplinan,
  Student,
  Unit,
} from '@/lib/supabase/types'

const CHART_PRIMARY = '#2D7A4F'
const CHART_SECONDARY = '#C9A84C'
const CHART_RED = '#DC2626'
const CHART_YELLOW = '#D97706'
const CHART_GREEN = '#16A34A'

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

const STATUS_COLORS: Record<StatusKedisiplinan, string> = {
  'Belum Diproses': CHART_RED,
  Pending: CHART_YELLOW,
  'Sudah Diproses': CHART_GREEN,
}

const STATUS_BADGE_VARIANT: Record<
  StatusKedisiplinan,
  'destructive' | 'warning' | 'success'
> = {
  'Belum Diproses': 'destructive',
  Pending: 'warning',
  'Sudah Diproses': 'success',
}

function getRelatedStudent(kedisiplinan: Kedisiplinan): Student | null {
  const student = kedisiplinan.students
  if (!student) return null
  if (Array.isArray(student)) return student[0] ?? null
  return student
}

function getRelatedKategori(kedisiplinan: Kedisiplinan): string {
  const kategori = kedisiplinan.kategori_disiplin
  if (!kategori) return '-'
  if (Array.isArray(kategori)) return kategori[0]?.nama_kategori ?? '-'
  return kategori.nama_kategori
}

function formatTanggal(tanggal: string): string {
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return format(new Date(tanggal), 'dd/MM/yyyy')
  }
}

function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
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

function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className ?? 'h-[300px] w-full'} />
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

function StudentsByClassChart({ unit }: { unit: Unit }) {
  const { data, isLoading } = useQuery({
    queryKey: ['students-by-class', unit, 'active'],
    queryFn: () => getStudentsByClass(unit),
  })

  const chartData = useMemo(
    () =>
      (data ?? []).map((item) => ({
        kelas: item.kelas,
        'Laki-laki': item.laki,
        Perempuan: item.perempuan,
      })),
    [data]
  )

  if (isLoading) {
    return <ChartSkeleton />
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)]" />
        <XAxis dataKey="kelas" tick={{ fill: 'var(--text-secondary)' }} />
        <YAxis tick={{ fill: 'var(--text-secondary)' }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Laki-laki" fill={CHART_PRIMARY} />
        <Bar dataKey="Perempuan" fill={CHART_SECONDARY} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function DashboardPage() {
  const [activeUnit, setActiveUnit] = useState<Unit>('SD')

  const { data: studentCounts, isLoading: isLoadingCounts } = useQuery({
    queryKey: ['student-counts', 'active'],
    queryFn: getStudentCounts,
  })

  const { data: statusCounts, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['kedisiplinan-status-count'],
    queryFn: getKedisiplinanStatusCount,
  })

  const { data: topKategori, isLoading: isLoadingTopKategori } = useQuery({
    queryKey: ['kedisiplinan-top-kategori'],
    queryFn: () => getKedisiplinanTopKategori(5),
  })

  const { data: prestasiByUnit, isLoading: isLoadingPrestasi } = useQuery({
    queryKey: ['prestasi-by-unit'],
    queryFn: getPrestasiByUnit,
  })

  const { data: recentKedisiplinan, isLoading: isLoadingRecent } = useQuery({
    queryKey: ['recent-kedisiplinan'],
    queryFn: () => getRecentKedisiplinan(5),
  })

  const pieData = useMemo(
    () =>
      (statusCounts ?? []).map((item) => ({
        name: item.status,
        value: item.count,
      })),
    [statusCounts]
  )

  const prestasiChartData = useMemo(
    () =>
      (prestasiByUnit ?? []).map((item) => ({
        unit: item.unit,
        count: item.count,
      })),
    [prestasiByUnit]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Ringkasan
        </h2>
      </div>

      {/* Section 1 — Summary Cards */}
      {isLoadingCounts ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            title="Siswa SD"
            value={studentCounts?.sd ?? 0}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Siswa SMP"
            value={studentCounts?.smp ?? 0}
            icon={Users}
            variant="default"
          />
          <StatCard
            title="Siswa SMA"
            value={studentCounts?.sma ?? 0}
            icon={Users}
            variant="secondary"
          />
          <StatCard
            title="Total Siswa"
            value={studentCounts?.total ?? 0}
            icon={Users}
            variant="primary"
          />
        </div>
      )}

      {/* Section 2 — Grafik Siswa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Distribusi Siswa per Kelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeUnit}
            onValueChange={(value) => setActiveUnit(value as Unit)}
          >
            <TabsList>
              {UNITS.map((unit) => (
                <TabsTrigger key={unit} value={unit}>
                  {unit}
                </TabsTrigger>
              ))}
            </TabsList>
            {UNITS.map((unit) => (
              <TabsContent key={unit} value={unit} className="mt-4">
                <StudentsByClassChart unit={unit} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Section 3 — Kedisiplinan */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-secondary" />
              Status Kedisiplinan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStatus ? (
              <ChartSkeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          STATUS_COLORS[entry.name as StatusKedisiplinan] ??
                          CHART_PRIMARY
                        }
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
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Top Kategori Kedisiplinan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTopKategori ? (
              <ChartSkeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  layout="vertical"
                  data={topKategori ?? []}
                  margin={{ left: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis type="number" tick={{ fill: 'var(--text-secondary)' }} />
                  <YAxis
                    type="category"
                    dataKey="nama_kategori"
                    width={120}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART_PRIMARY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 4 — Grafik Prestasi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-secondary" />
            Prestasi per Unit Sekolah
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPrestasi ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={prestasiChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--border)]"
                />
                <XAxis dataKey="unit" tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fill: 'var(--text-secondary)' }} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_SECONDARY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Section 5 — Recent Kedisiplinan */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Aktivitas Terbaru</CardTitle>
          <Link
            href="/kedisiplinan/data"
            className="text-sm text-primary hover:underline"
          >
            Lihat Semua →
          </Link>
        </CardHeader>
        <CardContent>
          {isLoadingRecent ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentKedisiplinan ?? []).map((item) => {
                  const student = getRelatedStudent(item)
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{formatTanggal(item.tanggal)}</TableCell>
                      <TableCell>{student?.nama ?? '-'}</TableCell>
                      <TableCell>{student?.kelas?.nama_kelas || '-'}</TableCell>
                      <TableCell>{getRelatedKategori(item)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE_VARIANT[item.status]}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
