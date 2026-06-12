'use client'

import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { CalendarDays, Moon, TrendingUp, Users } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import {
  getKamar,
  getKamarByMusyrif,
  getMutabaahDashboardStats,
  getKehadiranPerKegiatan,
  getTrendKehadiranHarian,
} from '@/lib/queries/mutabaah'

// ─── Halaman Dashboard Mutabaah ───────────────────────────────────────────────

export default function DashboardMutabaahPage() {
  const { profile, isAdmin } = useAuth()

  const now = new Date()
  const defaultBulan = format(now, 'yyyy-MM')

  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  const [selectedKamar, setSelectedKamar] = useState<string>('all')
  const [selectedBulan, setSelectedBulan] = useState<string>(defaultBulan)

  // ── Generate pilihan bulan (12 bulan terakhir) ──
  const bulanOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return {
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy', { locale: idLocale }),
    }
  })

  // ── Query Kamar ──
  const { data: kamarList = [], isLoading: loadingKamar } = useQuery({
    queryKey: ['kamar-dashboard', profile?.id, isAdmin],
    queryFn: async () => {
      if (!profile) return []
      if (isAdmin) return getKamar()
      const musyrifKamar = await getKamarByMusyrif(profile.id)
      if (musyrifKamar.length > 0) return musyrifKamar
      return getKamar()
    },
    enabled: !!profile,
  })

  const filteredKamarList = useMemo(() => {
    if (selectedUnit === 'all') return kamarList
    return kamarList.filter((k) => k.unit === selectedUnit)
  }, [kamarList, selectedUnit])

  useEffect(() => {
    if (selectedKamar !== 'all') {
      const exists = filteredKamarList.some((k) => k.nama_kamar === selectedKamar)
      if (!exists) setSelectedKamar('all')
    }
  }, [filteredKamarList, selectedKamar])

  const kamarFilter = selectedKamar === 'all' ? undefined : selectedKamar

  // ── Query Stats ──
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['mutabaah-dashboard-stats', kamarFilter, selectedBulan, selectedUnit],
    queryFn: () => getMutabaahDashboardStats(kamarFilter, selectedBulan, selectedUnit),
  })

  // ── Query Kehadiran Per Kegiatan ──
  const { data: kehadiranPerKegiatan = [], isLoading: loadingBar } = useQuery({
    queryKey: ['mutabaah-kehadiran-per-kegiatan', kamarFilter, selectedBulan, selectedUnit],
    queryFn: () => getKehadiranPerKegiatan(kamarFilter, selectedBulan, 5, selectedUnit),
  })

  // ── Query Tren Harian ──
  const { data: trendHarian = [], isLoading: loadingLine } = useQuery({
    queryKey: ['mutabaah-trend-harian', kamarFilter, selectedBulan, selectedUnit],
    queryFn: () => getTrendKehadiranHarian(kamarFilter, selectedBulan, selectedUnit),
  })

  // Format data untuk chart
  const barData = kehadiranPerKegiatan.map((item) => ({
    name: item.nama_kegiatan.length > 16 ? item.nama_kegiatan.slice(0, 16) + '…' : item.nama_kegiatan,
    fullName: item.nama_kegiatan,
    hadir: item.total_hadir,
    persen: item.persentase,
  }))

  const lineData = trendHarian.map((item) => ({
    tgl: format(new Date(item.tanggal), 'd'),
    persen: item.persentase_hadir,
    hadir: item.total_hadir,
    total: item.total_siswa,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Mutabaah"
        description="Ringkasan kehadiran kegiatan kepesantrenan"
      />

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 no-print">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Unit</label>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger id="select-unit-dashboard" className="w-48">
              <SelectValue placeholder="Semua Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Unit</SelectItem>
              <SelectItem value="SD">SD</SelectItem>
              <SelectItem value="SMP">SMP</SelectItem>
              <SelectItem value="SMA">SMA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Kamar</label>
          <Select value={selectedKamar} onValueChange={setSelectedKamar}>
            <SelectTrigger id="select-kamar-dashboard" className="w-48">
              <SelectValue placeholder="Semua Kamar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kamar</SelectItem>
              {filteredKamarList.map((k) => (
                <SelectItem key={k.id} value={k.nama_kamar}>{k.nama_kamar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Bulan</label>
          <Select value={selectedBulan} onValueChange={setSelectedBulan}>
            <SelectTrigger id="select-bulan-dashboard" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bulanOptions.map((b) => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {loadingStats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Siswa Aktif"
            value={stats?.totalSiswaAktif ?? 0}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Rata-rata Kehadiran"
            value={`${stats?.rataRataKehadiran ?? 0}%`}
            icon={TrendingUp}
            variant="secondary"
            description="Bulan ini, kegiatan non-libur"
          />
          <StatCard
            title="Hari Dicatat"
            value={stats?.totalHariDicatat ?? 0}
            icon={CalendarDays}
            description="Hari yang memiliki data mutabaah"
          />
          <StatCard
            title="Hari Libur"
            value={stats?.hariLiburBulanIni ?? 0}
            icon={Moon}
            description="Hari libur dalam bulan ini"
          />
        </div>
      )}

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* BarChart: Kehadiran Per Kegiatan */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
              Kehadiran per Kegiatan (Top 5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBar ? (
              <Skeleton className="h-56 w-full" />
            ) : barData.length === 0 ? (
              <EmptyState
                title="Belum ada data"
                description="Tidak ada data kehadiran untuk periode ini"
              />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                    formatter={(value: unknown, name: unknown) => {
                      const labels: Record<string, string> = { hadir: 'Total Hadir', persen: 'Persentase (%)' }
                      const nameStr = String(name)
                      return [value as number, labels[nameStr] ?? nameStr]
                    }}
                    labelFormatter={(label, payload) => {
                      const fullName = payload?.[0]?.payload?.fullName ?? label
                      return fullName
                    }}
                  />
                  <Bar dataKey="hadir" fill="#1e5d7e" radius={[4, 4, 0, 0]} name="hadir" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* LineChart: Tren Kehadiran Harian */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
              Tren Kehadiran Harian (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLine ? (
              <Skeleton className="h-56 w-full" />
            ) : lineData.length === 0 ? (
              <EmptyState
                title="Belum ada data"
                description="Tidak ada data tren kehadiran untuk periode ini"
              />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="tgl"
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                    label={{ value: 'Tanggal', position: 'insideBottom', offset: -4, fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                    formatter={(value: unknown) => [`${value as number}%`, 'Kehadiran']}
                    labelFormatter={(label) => `Tanggal ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="persen"
                    stroke="#1e5d7e"
                    strokeWidth={2}
                    dot={{ fill: '#1e5d7e', r: 3 }}
                    activeDot={{ r: 5 }}
                    name="persen"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
