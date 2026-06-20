'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Gavel, Info, Printer } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  getKedisiplinanAnak,
} from '@/lib/queries/orangtua'

const CHART_RED = '#DC2626'
const CHART_YELLOW = '#D97706'
const CHART_GREEN = '#16A34A'

const STATUS_COLORS: Record<string, string> = {
  'Belum Diproses': CHART_RED,
  Pending: CHART_YELLOW,
  'Sudah Diproses': CHART_GREEN,
}

const STATUS_BADGE_VARIANT: Record<
  string,
  'destructive' | 'warning' | 'success'
> = {
  'Belum Diproses': 'destructive',
  Pending: 'warning',
  'Sudah Diproses': 'success',
}

function formatTanggal(tanggal: string): string {
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return tanggal
  }
}

export default function OrangTuaKedisiplinanPage() {
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
    queryKey: ['orangtua-anak-list-disiplin', profile?.id],
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

  // Date Filters
  const [tanggalDari, setTanggalDari] = useState<Date | undefined>(undefined)
  const [tanggalSampai, setTanggalSampai] = useState<Date | undefined>(undefined)

  const formattedDari = tanggalDari ? format(tanggalDari, 'yyyy-MM-dd') : undefined
  const formattedSampai = tanggalSampai ? format(tanggalSampai, 'yyyy-MM-dd') : undefined

  // Query Data Kedisiplinan
  const { data: kedisiplinan = [], isLoading: kedisiplinanLoading } = useQuery({
    queryKey: ['orangtua-kedisiplinan', selectedSiswaId, formattedDari, formattedSampai],
    queryFn: () =>
      getKedisiplinanAnak(selectedSiswaId, {
        tanggalDari: formattedDari,
        tanggalSampai: formattedSampai,
      }),
    enabled: !!selectedSiswaId,
  })

  // Perhitungan total poin berdasarkan kategori (HANYA status = 'Sudah Diproses')
  const totalPoinPrestasi = useMemo(() => {
    return kedisiplinan
      .filter((k: any) => k.status === 'Sudah Diproses' && k.kategori_disiplin?.nama_kategori?.toLowerCase().includes('prestasi'))
      .reduce((sum: number, k: any) => sum + (k.pasal?.poin ?? 0), 0)
  }, [kedisiplinan])

  const totalPoinPelanggaran = useMemo(() => {
    return kedisiplinan
      .filter((k: any) => k.status === 'Sudah Diproses' && (k.kategori_disiplin?.nama_kategori?.toLowerCase().includes('pelanggaran') || !k.kategori_disiplin?.nama_kategori?.toLowerCase().includes('prestasi')))
      .reduce((sum: number, k: any) => sum + (k.pasal?.poin ?? 0), 0)
  }, [kedisiplinan])

  // Data untuk Grafik Perbandingan Prestasi vs Pelanggaran
  const comparisonData = useMemo(() => {
    return [
      {
        name: 'Prestasi',
        Poin: totalPoinPrestasi,
        fill: CHART_GREEN,
      },
      {
        name: 'Pelanggaran',
        Poin: totalPoinPelanggaran,
        fill: CHART_RED,
      },
    ]
  }, [totalPoinPrestasi, totalPoinPelanggaran])

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
        <PageHeader title="Kedisiplinan Anak" />
        <EmptyState
          title="Belum Terhubung dengan Siswa"
          description="Belum ada data anak yang dihubungkan ke akun ini. Silakan hubungi admin sekolah."
          icon={Gavel}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Print header (formal, hidden di screen) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-xl font-bold text-center">SEKOLAH QURAN ASY SYAHID — AMANAH Platform</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Laporan Catatan Kedisiplinan & Pelanggaran Siswa</h2>
        <div className="grid grid-cols-2 mt-4 text-sm gap-2">
          <p><strong>Nama Siswa:</strong> {activeStudent?.nama}</p>
          <p><strong>Kelas:</strong> {activeStudent?.kelas} ({activeStudent?.unit})</p>
          <p><strong>Tanggal Cetak:</strong> {format(new Date(), 'dd/MM/yyyy')}</p>
          <p><strong>Dicetak Oleh:</strong> {profile?.nama_lengkap ?? 'Orang Tua'}</p>
          <p><strong>Total Poin Prestasi:</strong> {totalPoinPrestasi} Poin</p>
          <p><strong>Total Poin Pelanggaran Aktif:</strong> {totalPoinPelanggaran} Poin</p>
        </div>
      </div>

      {/* Screen Header dengan Selector Anak */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <PageHeader
          title="Kedisiplinan Anak"
          description={`Histori kedisiplinan, poin prestasi, dan poin pelanggaran dari ${activeStudent?.nama || ''}`}
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
        <CardContent className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2 items-end">
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

      {/* Stats Cards & Chart Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Total Poin Prestasi Card */}
        <Card className="flex flex-col justify-center items-center p-6 text-center border-t-4 border-status-green">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[var(--text-secondary)] uppercase">
              Total Poin Prestasi
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-2">
            <span className="text-4xl font-extrabold text-green-600">
              {totalPoinPrestasi}
            </span>
            <p className="text-[10px] text-[var(--text-tertiary)] italic mt-2">
              *Hanya poin status &apos;Sudah Diproses&apos; yang diakumulasikan
            </p>
          </CardContent>
        </Card>

        {/* Total Poin Pelanggaran Card */}
        <Card className="flex flex-col justify-center items-center p-6 text-center border-t-4 border-status-red">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[var(--text-secondary)] uppercase">
              Total Poin Pelanggaran Aktif
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-2">
            <span className="text-4xl font-extrabold text-red-600">
              {totalPoinPelanggaran}
            </span>
            <p className="text-[10px] text-[var(--text-tertiary)] italic mt-2">
              *Hanya poin status &apos;Sudah Diproses&apos; yang diakumulasikan
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Chart */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Perbandingan Prestasi vs Pelanggaran
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          {kedisiplinanLoading ? (
            <div className="h-[240px] flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : totalPoinPrestasi === 0 && totalPoinPelanggaran === 0 ? (
            <EmptyState
              title="Tidak Ada Data Poin"
              description="Belum ada data poin prestasi maupun pelanggaran untuk perbandingan."
              className="py-12"
            />
          ) : (
            <div className="h-[240px] w-full max-w-md">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)]" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="Poin" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histori Pelanggaran Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between no-print">
          <CardTitle className="text-base font-semibold">Histori Kasus Kedisiplinan</CardTitle>
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Cetak Laporan
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {kedisiplinanLoading ? (
            <div className="p-8 flex justify-center"><LoadingSpinner /></div>
          ) : kedisiplinan.length === 0 ? (
            <EmptyState
              title="Histori Kedisiplinan Kosong"
              description="Tidak ada log catatan pelanggaran kedisiplinan santri."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Pasal Pelanggaran</TableHead>
                  <TableHead>Poin</TableHead>
                  <TableHead>Tindakan Disiplin</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kedisiplinan.map((k: any) => (
                  <TableRow key={k.id}>
                    <TableCell className="whitespace-nowrap">{formatTanggal(k.tanggal)}</TableCell>
                    <TableCell className="font-semibold">
                      {k.kategori_disiplin?.nama_kategori ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm">{k.pasal?.nama_pasal ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{k.pasal?.poin ?? 0} Poin</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-[var(--text-secondary)]">
                      {k.tindakan?.nama_tindakan ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={STATUS_BADGE_VARIANT[k.status] ?? 'outline'}>
                        {k.status}
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
  )
}
