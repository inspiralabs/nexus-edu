'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Trophy,
  X,
} from 'lucide-react'
import { useMemo, useState, useEffect, useCallback } from 'react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getDivisi,
  getKategoriDisiplin,
  getKedisiplinanDashboard,
  type KedisiplinanDashboardFilters,
} from '@/lib/queries/kedisiplinan'
import { getKelasOptionsByUnits } from '@/lib/queries/students'
import type { Unit, StatusKedisiplinan } from '@/lib/supabase/types'
import { cn, formatDivisiLabel } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const CHART_PRIMARY = '#2D7A4F'
const CHART_SECONDARY = '#C9A84C'
const CHART_RED = '#DC2626'
const CHART_YELLOW = '#D97706'
const CHART_GREEN = '#16A34A'

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

interface StatusStatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  iconColorClass: string
  iconBgClass: string
}

function StatusStatCard({
  title,
  value,
  icon: Icon,
  iconColorClass,
  iconBgClass,
}: StatusStatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconBgClass,
            iconColorClass
          )}
        >
          <Icon className="h-5 w-5" />
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

const STATUS_COLORS: Record<string, string> = {
  'Belum Diproses': CHART_RED,
  Pending: CHART_YELLOW,
  'Sudah Diproses': CHART_GREEN,
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

interface FilterOption {
  value: string
  label: string
}

interface FilterMultiSelectProps {
  label: string
  emptyLabel: string
  options: FilterOption[]
  selectedValues: string[]
  onToggle: (value: string) => void
  idPrefix: string
}

function FilterMultiSelect({
  label,
  emptyLabel,
  options,
  selectedValues,
  onToggle,
  idPrefix,
}: FilterMultiSelectProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 min-w-[140px] justify-start font-normal"
        >
          {selectedValues.length > 0
            ? `${label} (${selectedValues.length})`
            : emptyLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {options.length === 0 ? (
            <p className="text-sm text-text-secondary">Tidak ada opsi</p>
          ) : (
            options.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${idPrefix}-${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={() => onToggle(option.value)}
                />
                <Label
                  htmlFor={`${idPrefix}-${option.value}`}
                  className="font-normal"
                >
                  {option.label}
                </Label>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function KedisiplinanDashboardPage() {
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - index),
    [currentYear]
  )

  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear])
  const [selectedUnits, setSelectedUnits] = useState<Unit[]>([...UNITS])
  const [selectedKelas, setSelectedKelas] = useState<string[]>([])
  const [selectedKategori, setSelectedKategori] = useState<string[]>([])
  const [selectedDivisi, setSelectedDivisi] = useState<string[]>([])

  const { data: kategoriList } = useQuery({
    queryKey: ['kategori-disiplin'],
    queryFn: getKategoriDisiplin,
  })

  const { data: divisiList } = useQuery({
    queryKey: ['divisi'],
    queryFn: () => getDivisi(),
  })

  const { data: kelasOptions = [] } = useQuery({
    queryKey: ['kedisiplinan-dashboard-kelas', selectedUnits],
    queryFn: () =>
      getKelasOptionsByUnits(
        selectedUnits.length > 0 ? selectedUnits : undefined
      ),
  })

  const dashboardFilters = useMemo<KedisiplinanDashboardFilters>(
    () => ({
      tahun: selectedYears.length > 0 ? selectedYears : undefined,
      unit: selectedUnits.length > 0 ? selectedUnits : undefined,
      kelas: selectedKelas.length > 0 ? selectedKelas : undefined,
      kategori_id:
        selectedKategori.length > 0 ? selectedKategori : undefined,
      divisi_id: selectedDivisi.length > 0 ? selectedDivisi : undefined,
    }),
    [
      selectedYears,
      selectedUnits,
      selectedKelas,
      selectedKategori,
      selectedDivisi,
    ]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['kedisiplinan-dashboard', dashboardFilters],
    queryFn: () => getKedisiplinanDashboard(dashboardFilters),
  })

  const trenData = useMemo(
    () =>
      (data?.trenBulanan ?? []).map((item) => ({
        bulan: formatBulanLabel(item.bulan),
        count: item.count,
      })),
    [data?.trenBulanan]
  )

  const kategoriChartData = useMemo(
    () => data?.perKategori ?? [],
    [data?.perKategori]
  )

  const divisiChartData = useMemo(
    () => data?.perDivisi ?? [],
    [data?.perDivisi]
  )

  const statusChartData = useMemo(
    () =>
      (data?.perStatus ?? []).map((item) => ({
        name: item.status,
        value: item.count,
      })),
    [data?.perStatus]
  )

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    )
  }

  const toggleUnit = (unit: Unit) => {
    setSelectedUnits((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]
    )
    setSelectedKelas([])
  }

  const toggleKelas = (kelas: string) => {
    setSelectedKelas((prev) =>
      prev.includes(kelas)
        ? prev.filter((k) => k !== kelas)
        : [...prev, kelas]
    )
  }

  const toggleKategori = (id: string) => {
    setSelectedKategori((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    )
  }

  const toggleDivisi = (id: string) => {
    setSelectedDivisi((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Dashboard Kedisiplinan
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter Data</CardTitle>
        </CardHeader>
        <CardContent className="flex w-full flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <FilterMultiSelect
            label="Tahun"
            emptyLabel="Semua Tahun"
            idPrefix="kedisiplinan-year"
            selectedValues={selectedYears.map(String)}
            onToggle={(value) => toggleYear(Number.parseInt(value, 10))}
            options={yearOptions.map((year) => ({
              value: String(year),
              label: String(year),
            }))}
          />

          <FilterMultiSelect
            label="Unit"
            emptyLabel="Semua Unit"
            idPrefix="kedisiplinan-unit"
            selectedValues={selectedUnits}
            onToggle={(value) => toggleUnit(value as Unit)}
            options={UNITS.map((unit) => ({
              value: unit,
              label: unit,
            }))}
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-9 min-w-[140px] justify-start font-normal"
              >
                {selectedKelas.length > 0
                  ? `Kelas (${selectedKelas.length})`
                  : 'Semua Kelas'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {kelasOptions.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    Tidak ada kelas tersedia
                  </p>
                ) : (
                  kelasOptions.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        id={`kedisiplinan-kelas-${option.value}`}
                        checked={selectedKelas.includes(option.value)}
                        onCheckedChange={() => toggleKelas(option.value)}
                      />
                      <Label
                        htmlFor={`kedisiplinan-kelas-${option.value}`}
                        className="font-normal"
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <FilterMultiSelect
            label="Kategori"
            emptyLabel="Semua Kategori"
            idPrefix="kedisiplinan-kategori"
            selectedValues={selectedKategori}
            onToggle={toggleKategori}
            options={(kategoriList ?? []).map((kategori) => ({
              value: kategori.id,
              label: kategori.nama_kategori,
            }))}
          />

          <FilterMultiSelect
            label="Divisi"
            emptyLabel="Semua Divisi"
            idPrefix="kedisiplinan-divisi"
            selectedValues={selectedDivisi}
            onToggle={toggleDivisi}
            options={(divisiList ?? []).map((divisi) => ({
              value: divisi.id,
              label: formatDivisiLabel(divisi.nama_divisi, divisi.unit),
            }))}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            title="Total Kasus"
            value={data?.totalKasus ?? 0}
            icon={ShieldAlert}
            variant="primary"
          />
          <StatusStatCard
            title="Belum Diproses"
            value={data?.belumDiproses ?? 0}
            icon={AlertCircle}
            iconColorClass="text-status-red"
            iconBgClass="bg-status-red-bg"
          />
          <StatusStatCard
            title="Pending"
            value={data?.pending ?? 0}
            icon={Clock}
            iconColorClass="text-status-yellow"
            iconBgClass="bg-status-yellow-bg"
          />
          <StatusStatCard
            title="Sudah Diproses"
            value={data?.sudahDiproses ?? 0}
            icon={CheckCircle2}
            iconColorClass="text-status-green"
            iconBgClass="bg-status-green-bg"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tren Kasus per Bulan</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : trenData.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Tidak ada data untuk filter yang dipilih
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trenData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis
                    dataKey="bulan"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: 'var(--text-secondary)' }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Jumlah Kasus"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                    dot={{ fill: CHART_PRIMARY }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi per Kategori</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : kategoriChartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Tidak ada data untuk filter yang dipilih
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={kategoriChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis
                    dataKey="nama_kategori"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fill: 'var(--text-secondary)' }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Jumlah" fill={CHART_PRIMARY} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi per Divisi</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : divisiChartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Tidak ada data untuk filter yang dipilih
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={divisiChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis
                    dataKey="nama_divisi"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fill: 'var(--text-secondary)' }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Jumlah" fill={CHART_SECONDARY} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton className="h-[280px] w-full" />
            ) : statusChartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Tidak ada data untuk filter yang dipilih
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {statusChartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          STATUS_COLORS[entry.name] ??
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
      </div>
    </div>
  )
}
