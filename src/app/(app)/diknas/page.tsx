'use client'

import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { BookOpen, CheckCircle, ClipboardList, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
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
  getActiveSemesterDiknas,
  getKelasOptions,
  getRaportSiswa,
} from '@/lib/queries/diknas'
import { useAuth } from '@/hooks/use-auth'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Unit } from '@/lib/supabase/types'

// ─── Tipe ─────────────────────────────────────────────────────────────────────

interface MonthlyTrend {
  bulan: string
  hadir: number
  total: number
}

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

// ─── Komponen ─────────────────────────────────────────────────────────────────

export default function DiknasDashboardPage() {
  const { profile } = useAuth()
  const bulanIni = format(new Date(), 'yyyy-MM')
  const bulanLalu = format(subMonths(new Date(), 1), 'yyyy-MM')
  const duaBulanLalu = format(subMonths(new Date(), 2), 'yyyy-MM')

  // Top 10 rankings state
  const [rankingUnit, setRankingUnit] = useState<Unit>('SD')
  const [rankingKelas, setRankingKelas] = useState('all')

  const { data: activeSemester } = useQuery({
    queryKey: ['active-semester-diknas'],
    queryFn: getActiveSemesterDiknas,
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['diknas-dashboard-stats', activeSemester?.id],
    queryFn: () => getDiknasDashboardStats(activeSemester?.id),
  })

  // Fetch kelas list for ranking filter
  const { data: rankingKelasList = [] } = useQuery({
    queryKey: ['kelas-options-ranking', rankingUnit],
    queryFn: () => getKelasOptions(rankingUnit),
  })

  // Fetch ranking data
  const { data: rankingData = [], isLoading: rankingLoading } = useQuery({
    queryKey: ['ranking-raport-uas', activeSemester?.id, rankingUnit, rankingKelas],
    queryFn: () =>
      activeSemester?.id
        ? getRaportSiswa({
            semesterId: activeSemester.id,
            unit: rankingUnit,
            kelas: rankingKelas !== 'all' ? rankingKelas : undefined,
          })
        : Promise.resolve([]),
    enabled: Boolean(activeSemester?.id),
  })

  const topUAS = useMemo(() => {
    return [...rankingData]
      .filter((s) => s.nilai_uas !== null)
      .sort((a, b) => (b.nilai_uas ?? 0) - (a.nilai_uas ?? 0))
      .slice(0, 10)
  }, [rankingData])

  const topRaport = useMemo(() => {
    return [...rankingData]
      .sort((a, b) => b.nilai_rapor - a.nilai_rapor)
      .slice(0, 10)
  }, [rankingData])

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

      {/* Top 10 Rankings */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Top 10 Rankings</h2>
          
          <div className="flex items-center gap-3">
            <Tabs
              value={rankingUnit}
              onValueChange={(v) => {
                setRankingUnit(v as Unit)
                setRankingKelas('all')
              }}
            >
              <TabsList>
                {UNITS.map((u) => <TabsTrigger key={u} value={u}>{u}</TabsTrigger>)}
              </TabsList>
            </Tabs>

            {profile?.role !== 'user' && (
              <Select value={rankingKelas} onValueChange={setRankingKelas}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {rankingKelasList.map((k: string) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {rankingLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top 10 UAS */}
            <Card className="border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[var(--text-primary)] flex items-center justify-between">
                  <span>Top 10 Nilai UAS</span>
                  <span className="text-xs font-normal text-[var(--text-secondary)]">UAS</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-2">
                {topUAS.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-secondary)] py-8">Belum ada data nilai UAS.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--text-secondary)]">
                          <th className="pb-2 w-12 text-center">Rank</th>
                          <th className="pb-2">Nama</th>
                          <th className="pb-2 w-16">Kelas</th>
                          <th className="pb-2 w-16 text-right">Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topUAS.map((s, idx) => (
                          <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)]/50">
                            <td className="py-2.5 text-center">
                              {idx < 3 ? (
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                                  idx === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                  idx === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                }`}>
                                  {idx + 1}
                                </span>
                              ) : (
                                <span className="text-[var(--text-secondary)] text-xs">{idx + 1}</span>
                              )}
                            </td>
                            <td className="py-2.5 font-medium text-[var(--text-primary)] truncate max-w-[150px]">{s.nama}</td>
                            <td className="py-2.5 text-[var(--text-secondary)]">{s.kelas}</td>
                            <td className="py-2.5 text-right font-semibold text-primary">{s.nilai_uas?.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top 10 Rapor */}
            <Card className="border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[var(--text-primary)] flex items-center justify-between">
                  <span>Top 10 Nilai Rapor</span>
                  <span className="text-xs font-normal text-[var(--text-secondary)]">Rapor</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-2">
                {topRaport.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-secondary)] py-8">Belum ada data nilai Rapor.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-xs font-medium text-[var(--text-secondary)]">
                          <th className="pb-2 w-12 text-center">Rank</th>
                          <th className="pb-2">Nama</th>
                          <th className="pb-2 w-16">Kelas</th>
                          <th className="pb-2 w-16 text-right">Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topRaport.map((s, idx) => (
                          <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)]/50">
                            <td className="py-2.5 text-center">
                              {idx < 3 ? (
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                                  idx === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                  idx === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                }`}>
                                  {idx + 1}
                                </span>
                              ) : (
                                <span className="text-[var(--text-secondary)] text-xs">{idx + 1}</span>
                              )}
                            </td>
                            <td className="py-2.5 font-medium text-[var(--text-primary)] truncate max-w-[150px]">{s.nama}</td>
                            <td className="py-2.5 text-[var(--text-secondary)]">{s.kelas}</td>
                            <td className="py-2.5 text-right font-semibold text-green-600 dark:text-green-400">{s.nilai_rapor.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

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
