'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { DatePicker } from '@/components/shared/date-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { getPrestasi, TINGKAT_KEJUARAAN } from '@/lib/queries/prestasi'
import { createClient } from '@/lib/supabase/client'
import type {
  Juara,
  KategoriPrestasi,
  TingkatKejuaraan,
  Unit,
} from '@/lib/supabase/types'

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

interface CetakFilters {
  tanggalDari: Date | undefined
  tanggalSampai: Date | undefined
  unit: 'all' | Unit
  juara_id: string
  tingkat_kejuaraan: 'all' | TingkatKejuaraan
  kategori_id: string
}

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

function formatTanggal(tanggal: string | null): string {
  if (!tanggal) return '-'
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return tanggal
  }
}

export default function CetakPrestasiPage() {
  const { profile } = useAuth()
  const todayLabel = format(new Date(), 'dd/MM/yyyy')

  const [filters, setFilters] = useState<CetakFilters>({
    tanggalDari: undefined,
    tanggalSampai: undefined,
    unit: 'all',
    juara_id: 'all',
    tingkat_kejuaraan: 'all',
    kategori_id: 'all',
  })

  const queryFilters = useMemo(
    () => ({
      tanggalDari: filters.tanggalDari
        ? format(filters.tanggalDari, 'yyyy-MM-dd')
        : undefined,
      tanggalSampai: filters.tanggalSampai
        ? format(filters.tanggalSampai, 'yyyy-MM-dd')
        : undefined,
      unit: filters.unit !== 'all' ? [filters.unit] : undefined,
      juara_id:
        filters.juara_id !== 'all' ? [filters.juara_id] : undefined,
      tingkat_kejuaraan:
        filters.tingkat_kejuaraan !== 'all'
          ? [filters.tingkat_kejuaraan]
          : undefined,
      kategori_id:
        filters.kategori_id !== 'all' ? [filters.kategori_id] : undefined,
      page: 1,
      pageSize: 1000,
      sortField: 'waktu',
      sortDirection: 'desc' as const,
    }),
    [filters]
  )

  const { data: juaraList = [] } = useQuery({
    queryKey: ['juara-list'],
    queryFn: fetchJuaraList,
  })

  const { data: kategoriList = [] } = useQuery({
    queryKey: ['kategori-prestasi-list'],
    queryFn: fetchKategoriPrestasiList,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['prestasi-cetak', queryFilters],
    queryFn: async () => {
      const { tanggalDari, tanggalSampai, ...prestasiFilters } = queryFilters
      const result = await getPrestasi(prestasiFilters)
      const filtered = (result.data ?? []).filter((row) => {
        if (!row.waktu) return false
        if (tanggalDari && row.waktu < tanggalDari) return false
        if (tanggalSampai && row.waktu > tanggalSampai) return false
        return true
      })
      return { ...result, data: filtered, total: filtered.length }
    },
  })

  const rows = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="print:hidden no-print">
        <PageHeader
          title="Cetak Laporan Prestasi"
          actions={
            <Button type="button" onClick={() => window.print()} className="no-print">
              <Printer className="mr-2 h-4 w-4" />
              Cetak
            </Button>
          }
        />

        <Card className="no-print">
          <CardHeader className="no-print">
            <CardTitle className="text-base">Filter Laporan</CardTitle>
          </CardHeader>
          <CardContent className="no-print">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Tanggal Dari</Label>
                <DatePicker
                  value={filters.tanggalDari}
                  onChange={(date) =>
                    setFilters((prev) => ({ ...prev, tanggalDari: date }))
                  }
                  placeholder="Pilih tanggal dari"
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Sampai</Label>
                <DatePicker
                  value={filters.tanggalSampai}
                  onChange={(date) =>
                    setFilters((prev) => ({ ...prev, tanggalSampai: date }))
                  }
                  placeholder="Pilih tanggal sampai"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={filters.unit}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      unit: value as CetakFilters['unit'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Unit</SelectItem>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Juara</Label>
                <Select
                  value={filters.juara_id}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, juara_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Juara" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Juara</SelectItem>
                    {juaraList.map((juara) => (
                      <SelectItem key={juara.id} value={juara.id}>
                        {juara.nama_juara}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tingkat Kejuaraan</Label>
                <Select
                  value={filters.tingkat_kejuaraan}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      tingkat_kejuaraan:
                        value as CetakFilters['tingkat_kejuaraan'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Tingkat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tingkat</SelectItem>
                    {TINGKAT_KEJUARAAN.map((tingkat) => (
                      <SelectItem key={tingkat} value={tingkat}>
                        {tingkat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={filters.kategori_id}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, kategori_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {kategoriList.map((kategori) => (
                      <SelectItem key={kategori.id} value={kategori.id}>
                        {kategori.nama_kategori}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="print-header hidden text-center print:block">
        <h1 className="text-lg font-bold uppercase">
          Sekolah Quran Asy Syahid
        </h1>
        <h2 className="mt-1 text-base font-semibold uppercase">
          LAPORAN DATA PRESTASI
        </h2>
        <p className="mt-2 text-sm">Tanggal Cetak: {todayLabel}</p>
        <p className="text-sm">
          Dicetak Oleh: {profile?.nama_lengkap ?? '-'}
        </p>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardHeader className="print:hidden no-print">
          <CardTitle className="text-base">
            Preview Laporan ({rows.length} data)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 print:p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--text-secondary)]">
              Tidak ada data untuk filter yang dipilih
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="print:border print:border-[#333]">
                <TableHeader>
                  <TableRow className="print:border-[#333]">
                    <TableHead className="print:border print:border-[#333]">
                      No
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Unit
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Nama Siswa
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Kelas
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Event
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Tempat
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Waktu
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Juara
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Jenis Juara
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Bidang
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Kategori
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Tingkat
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id} className="print:border-[#333]">
                      <TableCell className="print:border print:border-[#333]">
                        {index + 1}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.unit ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.students?.nama ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.students?.kelas ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.event?.nama_event ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.tempat ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {formatTanggal(row.waktu)}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.juara?.nama_juara ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.jenis_juara ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.bidang?.nama_bidang ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.kategori_prestasi?.nama_kategori ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.tingkat_kejuaraan ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
