'use client'

import { useQuery } from '@tanstack/react-query'
import { Award, Calendar, Globe, Trophy } from 'lucide-react'
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
import { createClient } from '@/lib/supabase/client'
import { getKelasOptionsByUnits } from '@/lib/queries/students'
import {
  getPrestasiDashboard,
  TINGKAT_KEJUARAAN,
  type PrestasiDashboardFilters,
} from '@/lib/queries/prestasi'
import type {
  JenisJuara,
  Juara,
  KategoriPrestasi,
  TingkatKejuaraan,
  Unit,
} from '@/lib/supabase/types'

const CHART_PRIMARY = '#2D7A4F'
const CHART_SECONDARY = '#C9A84C'

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

const JENIS_JUARA_COLORS: Record<string, string> = {
  Individu: CHART_PRIMARY,
  Kelompok: CHART_SECONDARY,
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

async function fetchJuaraList(): Promise<Juara[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('juara')
    .select('*')
    .order('nama_juara', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Juara[]
}

async function fetchKategoriPrestasiList(): Promise<KategoriPrestasi[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('kategori_prestasi')
    .select('*')
    .order('nama_kategori', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as KategoriPrestasi[]
}

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

export default function PrestasiDashboardPage() {
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - index),
    [currentYear]
  )

  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear])
  const [selectedUnits, setSelectedUnits] = useState<Unit[]>([...UNITS])
  const [selectedKelas, setSelectedKelas] = useState<string[]>([])
  const [selectedJuara, setSelectedJuara] = useState<string[]>([])
  const [selectedTingkat, setSelectedTingkat] = useState<TingkatKejuaraan[]>(
    []
  )
  const [selectedKategori, setSelectedKategori] = useState<string[]>([])

  const { data: juaraList } = useQuery({
    queryKey: ['juara-list'],
    queryFn: fetchJuaraList,
  })

  const { data: kategoriList } = useQuery({
    queryKey: ['kategori-prestasi-list'],
    queryFn: fetchKategoriPrestasiList,
  })

  const { data: kelasOptions = [] } = useQuery({
    queryKey: ['prestasi-dashboard-kelas', selectedUnits],
    queryFn: () =>
      getKelasOptionsByUnits(
        selectedUnits.length > 0 ? selectedUnits : undefined
      ),
  })

  const dashboardFilters = useMemo<PrestasiDashboardFilters>(
    () => ({
      tahun: selectedYears.length > 0 ? selectedYears : undefined,
      unit: selectedUnits.length > 0 ? selectedUnits : undefined,
      kelas: selectedKelas.length > 0 ? selectedKelas : undefined,
      juara_id: selectedJuara.length > 0 ? selectedJuara : undefined,
      kategori_id:
        selectedKategori.length > 0 ? selectedKategori : undefined,
      tingkat_kejuaraan:
        selectedTingkat.length > 0 ? selectedTingkat : undefined,
    }),
    [
      selectedYears,
      selectedUnits,
      selectedKelas,
      selectedJuara,
      selectedKategori,
      selectedTingkat,
    ]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['prestasi-dashboard', dashboardFilters],
    queryFn: () => getPrestasiDashboard(dashboardFilters),
  })

  const trenData = useMemo(
    () =>
      (data?.trenBulanan ?? []).map((item) => ({
        bulan: formatBulanLabel(item.bulan),
        count: item.count,
      })),
    [data?.trenBulanan]
  )

  const tingkatChartData = useMemo(
    () => data?.perTingkat ?? [],
    [data?.perTingkat]
  )

  const bidangChartData = useMemo(
    () => data?.perBidang ?? [],
    [data?.perBidang]
  )

  const jenisJuaraChartData = useMemo(
    () =>
      (data?.individuVsKelompok ?? []).map((item) => ({
        name: item.jenis_juara,
        value: item.count,
      })),
    [data?.individuVsKelompok]
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

  const toggleJuara = (id: string) => {
    setSelectedJuara((prev) =>
      prev.includes(id) ? prev.filter((j) => j !== id) : [...prev, id]
    )
  }

  const toggleTingkat = (tingkat: TingkatKejuaraan) => {
    setSelectedTingkat((prev) =>
      prev.includes(tingkat)
        ? prev.filter((t) => t !== tingkat)
        : [...prev, tingkat]
    )
  }

  const toggleKategori = (id: string) => {
    setSelectedKategori((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-secondary" />
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Dashboard Prestasi
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
            idPrefix="prestasi-year"
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
            idPrefix="prestasi-unit"
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
                        id={`prestasi-kelas-${option.value}`}
                        checked={selectedKelas.includes(option.value)}
                        onCheckedChange={() => toggleKelas(option.value)}
                      />
                      <Label
                        htmlFor={`prestasi-kelas-${option.value}`}
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
            label="Juara"
            emptyLabel="Semua Juara"
            idPrefix="prestasi-juara"
            selectedValues={selectedJuara}
            onToggle={toggleJuara}
            options={(juaraList ?? []).map((juara) => ({
              value: juara.id,
              label: juara.nama_juara,
            }))}
          />

          <FilterMultiSelect
            label="Tingkat"
            emptyLabel="Semua Tingkat"
            idPrefix="prestasi-tingkat"
            selectedValues={selectedTingkat}
            onToggle={(value) => toggleTingkat(value as TingkatKejuaraan)}
            options={TINGKAT_KEJUARAAN.map((tingkat) => ({
              value: tingkat,
              label: tingkat,
            }))}
          />

          <FilterMultiSelect
            label="Kategori"
            emptyLabel="Semua Kategori"
            idPrefix="prestasi-kategori"
            selectedValues={selectedKategori}
            onToggle={toggleKategori}
            options={(kategoriList ?? []).map((kategori) => ({
              value: kategori.id,
              label: kategori.nama_kategori,
            }))}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            title="Total Prestasi"
            value={data?.totalPrestasi ?? 0}
            icon={Trophy}
            variant="secondary"
          />
          <StatCard
            title="Bulan Ini"
            value={data?.thisMonth ?? 0}
            icon={Calendar}
            variant="primary"
          />
          <StatCard
            title="Juara 1"
            value={data?.juara1 ?? 0}
            icon={Award}
            variant="default"
          />
          <StatCard
            title="Nasional+"
            value={data?.nasionalPlus ?? 0}
            icon={Globe}
            variant="primary"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tren Prestasi per Bulan</CardTitle>
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
                    name="Jumlah Prestasi"
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
            <CardTitle className="text-base">
              Distribusi per Tingkat Kejuaraan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : tingkatChartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Tidak ada data untuk filter yang dipilih
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tingkatChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis
                    dataKey="tingkat_kejuaraan"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={80}
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
            <CardTitle className="text-base">Distribusi per Bidang</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : bidangChartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Tidak ada data untuk filter yang dipilih
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={bidangChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-[var(--border)]"
                  />
                  <XAxis
                    dataKey="nama_bidang"
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
            <CardTitle className="text-base">Individu vs Kelompok</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton className="h-[280px] w-full" />
            ) : jenisJuaraChartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
                Tidak ada data untuk filter yang dipilih
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={jenisJuaraChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {jenisJuaraChartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          JENIS_JUARA_COLORS[entry.name] ??
                          JENIS_JUARA_COLORS[entry.name as JenisJuara] ??
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
