'use client'

import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { BookOpen, CheckCircle, ClipboardList, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getDiknasDashboardStats,
  getKehadiranPerKelas,
} from '@/lib/queries/diknas'
import { getActiveSemesterDiknas } from '@/lib/queries/diknas'

// ─── Tipe ─────────────────────────────────────────────────────────────────────

interface MonthlyTrend {
  bulan: string
  hadir: number
  total: number
}

// ─── Komponen ─────────────────────────────────────────────────────────────────

export default function DiknasDashboardPage() {
  const bulanIni = format(new Date(), 'yyyy-MM')
  const bulanLalu = format(subMonths(new Date(), 1), 'yyyy-MM')
  const duaBulanLalu = format(subMonths(new Date(), 2), 'yyyy-MM')

  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester-diknas'],
    queryFn: getActiveSemesterDiknas,
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['diknas-dashboard-stats', activeSemester?.id],
    queryFn: () => getDiknasDashboardStats(activeSemester?.id),
  })

  const { data: kehadiranBulanIni = [], isLoading: kehadiranLoading } =
    useQuery({
      queryKey: ['kehadiran-per-kelas', bulanIni],
      queryFn: () => getKehadiranPerKelas(bulanIni),
    })

  const { data: kehadiranBulanLalu = [] } = useQuery({
    queryKey: ['kehadiran-per-kelas', bulanLalu],
    queryFn: () => getKehadiranPerKelas(bulanLalu),
  })

  const { data: kehadiranDuaBulanLalu = [] } = useQuery({
    queryKey: ['kehadiran-per-kelas', duaBulanLalu],
    queryFn: () => getKehadiranPerKelas(duaBulanLalu),
  })

  // Tren bulanan untuk LineChart
  const trendData = useMemo((): MonthlyTrend[] => {
    const summarize = (
      data: { hadir: number; total: number }[],
      bulan: string
    ) => {
      const totalHadir = data.reduce((s, d) => s + d.hadir, 0)
      const totalAll = data.reduce((s, d) => s + d.total, 0)
      return { bulan, hadir: totalHadir, total: totalAll }
    }

    return [
      summarize(kehadiranDuaBulanLalu, duaBulanLalu),
      summarize(kehadiranBulanLalu, bulanLalu),
      summarize(kehadiranBulanIni, bulanIni),
    ]
  }, [kehadiranBulanIni, kehadiranBulanLalu, kehadiranDuaBulanLalu, bulanIni, bulanLalu, duaBulanLalu])

  const semesterLabel = activeSemester
    ? `Semester ${activeSemester.nomor_semester} — ${activeSemester.tahun_pelajaran?.nama ?? ''}`
    : 'Tidak ada semester aktif'

  return (
    <div className="space-y-6">
      {/* Semester aktif */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="text-sm text-[var(--text-secondary)]">
          Semester Aktif:{' '}
          <span className="font-semibold text-[var(--text-primary)]">
            {semesterLabel}
          </span>
        </p>
      </div>

      {/* Stat Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Presensi Bulan Ini"
            value={stats?.totalPresensiMonthly ?? 0}
            icon={ClipboardList}
            description="Total entri presensi"
          />
          <StatCard
            title="Rata-rata Kehadiran"
            value={`${stats?.rataKehadiran ?? 0}%`}
            icon={CheckCircle}
            description="Persentase hadir bulan ini"
          />
          <StatCard
            title="Catatan Kelakuan"
            value={stats?.totalCatatanKelakuan ?? 0}
            icon={BookOpen}
            description="Total semester ini"
          />
          <StatCard
            title="Semester"
            value={activeSemester?.nomor_semester ?? '-'}
            icon={TrendingUp}
            description={activeSemester?.tahun_pelajaran?.nama ?? 'Belum ada semester aktif'}
          />        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar Chart — Kehadiran per kelas bulan ini */}
        <Card className="border-[var(--border)] bg-[var(--surface)]">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
              Kehadiran per Kelas (Bulan Ini)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kehadiranLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : kehadiranBulanIni.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-[var(--text-secondary)]">
                Belum ada data presensi bulan ini
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={kehadiranBulanIni}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="kelas"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="hadir"
                    name="Hadir"
                    fill="#1e5d7e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="total"
                    name="Total"
                    fill="#437793"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Line Chart — Tren kehadiran 3 bulan */}
        <Card className="border-[var(--border)] bg-[var(--surface)]">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
              Tren Kehadiran (3 Bulan Terakhir)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={trendData}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="bulan"
                  tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="hadir"
                  name="Hadir"
                  stroke="#1e5d7e"
                  strokeWidth={2}
                  dot={{ fill: '#1e5d7e', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#437793"
                  strokeWidth={2}
                  dot={{ fill: '#437793', r: 4 }}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Info navigasi */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Presensi', href: '/diknas/presensi', icon: '📋' },
          { label: 'Nilai Harian', href: '/diknas/nilai-harian', icon: '📝' },
          { label: 'Nilai UAS', href: '/diknas/nilai-uas', icon: '📊' },
          { label: 'Bank Soal', href: '/diknas/bank-soal', icon: '🗂️' },
          { label: 'Catatan Kelakuan', href: '/diknas/catatan', icon: '📓' },
          { label: 'Rekap Nilai', href: '/diknas/rekap-nilai', icon: '🏆' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center transition-all duration-200 hover:border-primary hover:bg-[var(--primary-light)] hover:shadow-md"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {item.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
