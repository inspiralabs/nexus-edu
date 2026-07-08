'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Activity,
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
  Line,
  LineChart,
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
  getDashboardMetrics,
  getKedisiplinanStatusCount,
  getRecentDashboardActivities,
  getPrestasiTrendByUnit,
  getKedisiplinanTopKategori,
  getStudentsByClass,
} from '@/lib/queries/dashboard'
import type { Unit } from '@/lib/supabase/types'

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const EMPTY_TOP_KATEGORI: { nama_kategori: string; count: number }[] = []
const EMPTY_PRESTASI_TREND: {
  bulan: string
  SD: number
  SMP: number
  SMA: number
}[] = []
const EMPTY_AKTIVITAS: {
  id: string
  tipe: 'Presensi' | 'Kedisiplinan' | 'Prestasi'
  created_at: string
  tanggal: string
  nama: string
  kelas: string
  deskripsi: string
  status: string
}[] = []

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
        <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)' }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Laki-laki" fill="#1e5d7e" />
        <Bar dataKey="Perempuan" fill="#437793" />
      </BarChart>
    </ResponsiveContainer>
  )
}

function getStatusBadgeClass(status: string): string {
  const value = status.toLowerCase()
  if (
    value.includes('belum diproses') ||
    value.includes('butuh tindakan') ||
    value.includes('alpa') ||
    value.includes('alpha')
  ) {
    return 'bg-[var(--status-red-bg)] text-[var(--status-red)]'
  }
  if (
    value.includes('sakit') ||
    value.includes('izin') ||
    value.includes('sedang diproses') ||
    value.includes('pending')
  ) {
    return 'bg-[var(--status-yellow-bg)] text-[var(--status-yellow)]'
  }
  return 'bg-[var(--status-green-bg)] text-[var(--status-green)]'
}

export default function DashboardPage() {
  const [activeUnit, setActiveUnit] = useState<Unit>('SD')

  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: getDashboardMetrics,
  })

  const { data: topKategori = EMPTY_TOP_KATEGORI, isLoading: isLoadingTopKategori } = useQuery({
    queryKey: ['kedisiplinan-top-kategori'],
    queryFn: () => getKedisiplinanTopKategori(5),
  })

  const { data: statusCounts = [], isLoading: isLoadingStatus } = useQuery({
    queryKey: ['kedisiplinan-status-count'],
    queryFn: getKedisiplinanStatusCount,
  })

  const { data: prestasiTrend = EMPTY_PRESTASI_TREND, isLoading: isLoadingPrestasiTrend } = useQuery({
    queryKey: ['prestasi-trend-by-unit'],
    queryFn: () => getPrestasiTrendByUnit(6),
  })

  const { data: recentActivities = EMPTY_AKTIVITAS, isLoading: isLoadingActivities } = useQuery({
    queryKey: ['dashboard-activities'],
    queryFn: () => getRecentDashboardActivities(12),
  })

  const pieData = useMemo(() => {
    const belum = statusCounts
      .filter((item) => item.status !== 'Sudah Diproses')
      .reduce((acc, item) => acc + item.count, 0)
    const selesai = statusCounts
      .filter((item) => item.status === 'Sudah Diproses')
      .reduce((acc, item) => acc + item.count, 0)
    return [
      { name: 'Belum Diproses', value: belum, color: '#D97706' },
      { name: 'Sudah Diproses', value: selesai, color: '#16A34A' },
    ]
  }, [statusCounts])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Ringkasan
        </h2>
      </div>

      {/* Baris 1 — Metriks Utama */}
      {isLoadingMetrics ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            title="Total Siswa (Aktif)"
            value={metrics?.totalSiswaAktif ?? 0}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Presensi Hari Ini"
            value={`${metrics?.presensiHariIni.persentase ?? 0}%`}
            description={`${metrics?.presensiHariIni.hadir ?? 0} / ${metrics?.presensiHariIni.total ?? 0} siswa hadir`}
            icon={LayoutDashboard}
            variant="secondary"
          />
          <StatCard
            title="Total Pelanggaran Aktif"
            value={metrics?.totalPelanggaranAktifBulanIni ?? 0}
            description="Belum selesai diproses bulan ini"
            icon={ShieldAlert}
            variant="default"
          />
          <StatCard
            title="Total Prestasi"
            value={metrics?.totalPrestasiBerjalan ?? 0}
            description="Semester/tahun berjalan"
            icon={Trophy}
            variant="primary"
          />
        </div>
      )}

      {/* Baris 2 — Grafik Analitik */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-secondary" />
                Tren Prestasi per Unit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingPrestasiTrend ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prestasiTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-[var(--border)]"
                    />
                    <XAxis dataKey="bulan" tick={{ fill: 'var(--text-secondary)' }} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="SD" stroke="#1e5d7e" strokeWidth={2} />
                    <Line type="monotone" dataKey="SMP" stroke="#437793" strokeWidth={2} />
                    <Line type="monotone" dataKey="SMA" stroke="#16A34A" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-secondary" />
              Rasio Kedisiplinan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingStatus || isLoadingMetrics ? (
              <ChartSkeleton className="h-[260px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
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
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <text
                    x="50%"
                    y="48%"
                    textAnchor="middle"
                    className="fill-[var(--text-primary)] text-sm font-semibold"
                  >
                    {metrics?.totalPelanggaranAktifBulanIni ?? 0}
                  </text>
                  <text
                    x="50%"
                    y="56%"
                    textAnchor="middle"
                    className="fill-[var(--text-secondary)] text-[11px]"
                  >
                    Kasus Aktif
                  </text>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}

            {isLoadingTopKategori ? (
              <ChartSkeleton className="h-[260px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  layout="vertical"
                  data={topKategori}
                  margin={{ left: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: 'var(--text-secondary)' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="nama_kategori"
                    width={120}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1e5d7e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Baris 3 — Aktivitas & Log Terbaru */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Aktivitas Terbaru (Realtime Corner)
          </CardTitle>
          <Link
            href="/kedisiplinan/data"
            className="text-sm text-primary hover:underline"
          >
            Lihat Semua →
          </Link>
        </CardHeader>
        <CardContent>
          {isLoadingActivities ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modul</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Aktivitas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivities.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-[var(--text-secondary)]"
                    >
                      Belum ada aktivitas terbaru.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentActivities.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium">
                          {item.tipe}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatTanggal(item.tanggal)}</TableCell>
                      <TableCell>{item.nama}</TableCell>
                      <TableCell>{item.kelas}</TableCell>
                      <TableCell>{item.deskripsi}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeClass(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
