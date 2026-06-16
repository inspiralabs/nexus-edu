'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { BookOpen, Info, Printer } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/layout/page-header'
import { DatePicker } from '@/components/shared/date-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  getAnakSaya,
  getKegiatanList,
  getMutabaahAnak,
} from '@/lib/queries/orangtua'

const CHART_PRIMARY = '#1e5d7e'
const CHART_SECONDARY = '#437793'

function formatTanggal(tanggal: string): string {
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return tanggal
  }
}

export default function OrangTuaMutabaahPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isLoading: authLoading } = useAuth()

  // Guard: Hanya role 'orangtua' yang boleh masuk
  useEffect(() => {
    if (!authLoading && profile && profile.role !== 'orangtua') {
      router.replace('/dashboard')
    }
  }, [profile, authLoading, router])

  // Query daftar anak
  const { data: anakList = [], isLoading: anakLoading } = useQuery({
    queryKey: ['orangtua-anak-list-mutabaah', profile?.id],
    queryFn: () => getAnakSaya(profile?.id || ''),
    enabled: !!profile?.id && profile.role === 'orangtua',
  })

  // State anak terpilih
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>('')

  useEffect(() => {
    if (anakList.length > 0 && !selectedSiswaId) {
      const urlSiswaId = searchParams.get('siswaId')
      const matched = anakList.find((s) => s.id === urlSiswaId)
      if (matched) {
        setSelectedSiswaId(matched.id)
      } else {
        setSelectedSiswaId(anakList[0].id)
      }
    }
  }, [anakList, selectedSiswaId, searchParams])

  const activeStudent = anakList.find((s) => s.id === selectedSiswaId) || anakList[0]

  // Filters
  const [selectedKegiatanId, setSelectedKegiatanId] = useState<string>('all')
  const [tanggalDari, setTanggalDari] = useState<Date | undefined>(undefined)
  const [tanggalSampai, setTanggalSampai] = useState<Date | undefined>(undefined)

  const formattedDari = tanggalDari ? format(tanggalDari, 'yyyy-MM-dd') : undefined
  const formattedSampai = tanggalSampai ? format(tanggalSampai, 'yyyy-MM-dd') : undefined

  // Reset filter kegiatan jika berganti anak
  useEffect(() => {
    setSelectedKegiatanId('all')
  }, [selectedSiswaId])

  // Query Kegiatan Options
  const { data: kegiatans = [] } = useQuery({
    queryKey: ['orangtua-kegiatan-options'],
    queryFn: getKegiatanList,
  })

  // Query Data Mutabaah
  const { data: mutabaah = [], isLoading: mutabaahLoading } = useQuery({
    queryKey: [
      'orangtua-mutabaah',
      selectedSiswaId,
      selectedKegiatanId,
      formattedDari,
      formattedSampai,
    ],
    queryFn: () =>
      getMutabaahAnak(selectedSiswaId, {
        kegiatanId: selectedKegiatanId === 'all' ? undefined : selectedKegiatanId,
        tanggalDari: formattedDari,
        tanggalSampai: formattedSampai,
      }),
    enabled: !!selectedSiswaId,
  })

  // Process data for Chart
  const chartData = useMemo(() => {
    const counts: Record<string, { hadir: number; total: number }> = {}
    mutabaah.forEach((item: any) => {
      const name = item.kegiatan?.nama_kegiatan || 'Lainnya'
      if (!counts[name]) {
        counts[name] = { hadir: 0, total: 0 }
      }
      counts[name].total++
      if (item.status === 'Hadir') {
        counts[name].hadir++
      }
    })
    return Object.entries(counts).map(([name, data]) => ({
      name,
      'Terlaksana': data.hadir,
      'Total Catatan': data.total,
    }))
  }, [mutabaah])

  // Handler pergantian anak
  const handleSiswaChange = (id: string) => {
    setSelectedSiswaId(id)
    const params = new URLSearchParams(window.location.search)
    params.set('siswaId', id)
    router.push(`${window.location.pathname}?${params.toString()}`)
  }

  // Print function
  const handlePrint = () => {
    window.print()
  }

  // Loading state umum
  if (authLoading || anakLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (anakList.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mutabaah Anak" />
        <EmptyState
          title="Belum Terhubung dengan Siswa"
          description="Belum ada data anak yang dihubungkan ke akun ini. Silakan hubungi admin sekolah."
          icon={BookOpen}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Print header (formal, hidden di screen) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-xl font-bold text-center">SEKOLAH QURAN ASY SYAHID — AMANAH Platform</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Laporan Mutabaah Yaumiyah (Ibadah Harian)</h2>
        <div className="grid grid-cols-2 mt-4 text-sm gap-2">
          <p><strong>Nama Siswa:</strong> {activeStudent?.nama}</p>
          <p><strong>Kelas:</strong> {activeStudent?.kelas} ({activeStudent?.unit})</p>
          <p><strong>Tanggal Cetak:</strong> {format(new Date(), 'dd/MM/yyyy')}</p>
          <p><strong>Dicetak Oleh:</strong> {profile?.nama_lengkap ?? 'Orang Tua'}</p>
        </div>
      </div>

      {/* Screen Header dengan Selector Anak */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <PageHeader
          title="Mutabaah Anak"
          description={`Evaluasi amalan ibadah harian santri ${activeStudent?.nama || ''}`}
        />
        
        {anakList.length > 1 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap">
              Lihat data:
            </span>
            <Select value={selectedSiswaId} onValueChange={handleSiswaChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Pilih Anak" />
              </SelectTrigger>
              <SelectContent>
                {anakList.map((siswa) => (
                  <SelectItem key={siswa.id} value={siswa.id}>
                    {siswa.nama} ({siswa.kelas})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Filter panel */}
      <Card className="no-print bg-[var(--surface-2)] border-[var(--border)]">
        <CardContent className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-3 items-end">
          {/* Filter Kegiatan */}
          <div className="space-y-2">
            <Label htmlFor="filter-kegiatan" className="text-xs font-semibold">Kegiatan</Label>
            <Select value={selectedKegiatanId} onValueChange={setSelectedKegiatanId}>
              <SelectTrigger id="filter-kegiatan">
                <SelectValue placeholder="Semua Kegiatan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kegiatan</SelectItem>
                {kegiatans.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.nama_kegiatan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tanggal Dari */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Dari Tanggal</Label>
            <DatePicker value={tanggalDari} onChange={setTanggalDari} placeholder="Pilih tanggal" />
          </div>

          {/* Tanggal Sampai */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Sampai Tanggal</Label>
            <DatePicker value={tanggalSampai} onChange={setTanggalSampai} placeholder="Pilih tanggal" />
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Chart Summary */}
        <Card className="xl:col-span-1 no-print">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Grafik Capaian Kegiatan</CardTitle>
          </CardHeader>
          <CardContent>
            {mutabaahLoading ? (
              <div className="h-[300px] flex items-center justify-center"><LoadingSpinner /></div>
            ) : chartData.length === 0 ? (
              <EmptyState
                title="Tidak Ada Data Grafik"
                description="Grafik akan tampil jika terdapat rekaman kegiatan."
                className="py-12"
              />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)]" />
                    <XAxis type="number" tick={{ fill: 'var(--text-secondary)' }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Terlaksana" fill={CHART_PRIMARY} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Total Catatan" fill={CHART_SECONDARY} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table Records */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between no-print">
            <CardTitle className="text-base font-semibold">Histori Mutabaah Yaumiyah</CardTitle>
            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
              <Printer className="h-4 w-4" />
              Cetak
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {mutabaahLoading ? (
              <div className="p-8 flex justify-center"><LoadingSpinner /></div>
            ) : mutabaah.length === 0 ? (
              <EmptyState
                title="Histori Mutabaah Kosong"
                description="Belum ada data checklist mutabaah dari sekolah asrama."
                className="py-12"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kegiatan</TableHead>
                    <TableHead>Sub Kegiatan</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mutabaah.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{formatTanggal(m.tanggal)}</TableCell>
                      <TableCell>{m.kegiatan?.nama_kegiatan ?? '-'}</TableCell>
                      <TableCell>{m.sub_kegiatan?.nama_sub ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={m.status === 'Hadir' ? 'success' : 'destructive'}>
                          {m.status}
                        </Badge>
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
