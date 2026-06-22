'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Trophy, Info, Printer } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  getPrestasiAnak,
} from '@/lib/queries/orangtua'

const CHART_PRIMARY = '#1e5d7e'

function formatTanggal(tanggal: string): string {
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return tanggal
  }
}

export default function OrangTuaPrestasiPage() {
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
    queryKey: ['orangtua-anak-list-prestasi', profile?.id],
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

  // Query Data Prestasi
  const { data: prestasi = [], isLoading: prestasiLoading } = useQuery({
    queryKey: ['orangtua-prestasi', selectedSiswaId, formattedDari, formattedSampai],
    queryFn: () =>
      getPrestasiAnak(selectedSiswaId, {
        tanggalDari: formattedDari,
        tanggalSampai: formattedSampai,
      }),
    enabled: !!selectedSiswaId,
  })

  // Process data for tournament levels Bar Chart
  const chartData = useMemo(() => {
    const levels = [
      'Tingkat Sekolah',
      'Tingkat Lokal',
      'Tingkat Kecamatan',
      'Tingkat Kabupaten/Kota',
      'Tingkat Provinsi',
      'Tingkat Regional',
      'Tingkat Nasional',
      'Tingkat Internasional',
    ]
    const counts: Record<string, number> = {}
    levels.forEach((lvl) => {
      counts[lvl] = 0
    })

    prestasi.forEach((item: any) => {
      const lvl = item.tingkat_kejuaraan
      if (lvl && counts[lvl] !== undefined) {
        counts[lvl]++
      }
    })

    return levels.map((name) => ({
      name: name.replace('Tingkat ', ''),
      'Jumlah Prestasi': counts[name],
    }))
  }, [prestasi])

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
        <PageHeader title="Prestasi Anak" />
        <EmptyState
          title="Belum Terhubung dengan Siswa"
          description="Belum ada data anak yang dihubungkan ke akun ini. Silakan hubungi admin sekolah."
          icon={Trophy}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Print header (formal, hidden di screen) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-xl font-bold text-center">SEKOLAH QURAN ASY SYAHID — AMANAH Platform</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Laporan Pencapaian Prestasi Siswa</h2>
        <div className="grid grid-cols-2 mt-4 text-sm gap-2">
          <p><strong>Nama Siswa:</strong> {activeStudent?.nama}</p>
          <p><strong>Kelas:</strong> {activeStudent?.kelas?.nama_kelas || '-'} ({activeStudent?.unit})</p>
          <p><strong>Tanggal Cetak:</strong> {format(new Date(), 'dd/MM/yyyy')}</p>
          <p><strong>Dicetak Oleh:</strong> {profile?.nama_lengkap ?? 'Orang Tua'}</p>
        </div>
      </div>

      {/* Screen Header dengan Selector Anak */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <PageHeader
          title="Prestasi Anak"
          description={`Rekap prestasi dan penghargaan yang diraih oleh ${activeStudent?.nama || ''}`}
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
                    {siswa.nama} ({siswa.kelas?.nama_kelas || '-'})
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

      {/* Bar Chart Tren Tingkat Kejuaraan */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Distribusi Berdasarkan Tingkat Kejuaraan</CardTitle>
        </CardHeader>
        <CardContent>
          {prestasiLoading ? (
            <div className="h-[250px] flex items-center justify-center"><LoadingSpinner /></div>
          ) : prestasi.length === 0 ? (
            <EmptyState
              title="Tidak Ada Data Grafik"
              description="Grafik sebaran prestasi kosong."
              className="py-12"
            />
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)]" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)' }} />
                  <Tooltip />
                  <Bar dataKey="Jumlah Prestasi" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table List of Achievements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between no-print">
          <CardTitle className="text-base font-semibold">Histori Penghargaan & Prestasi</CardTitle>
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Cetak Laporan
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {prestasiLoading ? (
            <div className="p-8 flex justify-center"><LoadingSpinner /></div>
          ) : prestasi.length === 0 ? (
            <EmptyState
              title="Histori Prestasi Kosong"
              description="Belum ada data prestasi yang tercatat."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Nama Event</TableHead>
                  <TableHead>Juara / Kategori</TableHead>
                  <TableHead>Tingkat</TableHead>
                  <TableHead>Bidang</TableHead>
                  <TableHead className="text-right">Kategori Prestasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestasi.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{formatTanggal(p.waktu)}</TableCell>
                    <TableCell className="font-semibold">
                      {p.event?.nama_event ?? p.nama_event ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">
                        {p.juara?.nama_juara ?? p.nama_juara ?? '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{p.tingkat_kejuaraan ?? '-'}</TableCell>
                    <TableCell className="text-xs text-[var(--text-secondary)]">
                      {p.bidang?.nama_bidang ?? '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {p.kategori_prestasi?.nama_kategori ?? '-'}
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
