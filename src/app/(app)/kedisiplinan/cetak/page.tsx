'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { DatePicker } from '@/components/shared/date-picker'
import { Badge } from '@/components/ui/badge'
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
import {
  getDivisi,
  getKategoriDisiplin,
  getKedisiplinan,
} from '@/lib/queries/kedisiplinan'
import type { Pasal, StatusKedisiplinan, Unit } from '@/lib/supabase/types'
import { formatDivisiLabel } from '@/lib/utils'

const UNITS: Unit[] = ['SD', 'SMP', 'SMA']
const STATUS_OPTIONS: StatusKedisiplinan[] = [
  'Belum Diproses',
  'Pending',
  'Sudah Diproses',
]

interface CetakFilters {
  tanggalDari: Date | undefined
  tanggalSampai: Date | undefined
  unit: 'all' | Unit
  kategori_id: string
  divisi_id: string
  status: 'all' | StatusKedisiplinan
}

function formatTanggal(tanggal: string): string {
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return tanggal
  }
}

function getStatusVariant(
  status: StatusKedisiplinan
): 'destructive' | 'warning' | 'success' {
  if (status === 'Belum Diproses') return 'destructive'
  if (status === 'Pending') return 'warning'
  return 'success'
}

function formatPasalLabel(pasal: Pasal): string {
  return `${pasal.nama_pasal} (${pasal.poin})`
}

export default function CetakKedisiplinanPage() {
  const { profile } = useAuth()
  const todayLabel = format(new Date(), 'dd/MM/yyyy')

  const [filters, setFilters] = useState<CetakFilters>({
    tanggalDari: undefined,
    tanggalSampai: undefined,
    unit: 'all',
    kategori_id: 'all',
    divisi_id: 'all',
    status: 'all',
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
      kategori_id:
        filters.kategori_id !== 'all' ? [filters.kategori_id] : undefined,
      divisi_id:
        filters.divisi_id !== 'all' ? [filters.divisi_id] : undefined,
      status: filters.status !== 'all' ? [filters.status] : undefined,
      page: 1,
      pageSize: 1000,
      sortField: 'tanggal',
      sortDirection: 'desc' as const,
    }),
    [filters]
  )

  const { data: kategoriList = [] } = useQuery({
    queryKey: ['kategori-disiplin'],
    queryFn: getKategoriDisiplin,
  })

  const { data: divisiList = [] } = useQuery({
    queryKey: ['divisi'],
    queryFn: () => getDivisi(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['kedisiplinan-cetak', queryFilters],
    queryFn: () => getKedisiplinan(queryFilters),
  })

  const rows = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Cetak Laporan Kedisiplinan"
          actions={
            <Button type="button" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Cetak
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filter Laporan</CardTitle>
          </CardHeader>
          <CardContent>
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
              <div className="space-y-2">
                <Label>Divisi</Label>
                <Select
                  value={filters.divisi_id}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, divisi_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Divisi</SelectItem>
                    {divisiList.map((divisi) => (
                      <SelectItem key={divisi.id} value={divisi.id}>
                        {formatDivisiLabel(divisi.nama_divisi, divisi.unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      status: value as CetakFilters['status'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="hidden text-center print:block">
        <h1 className="text-lg font-bold uppercase">
          Sekolah Quran Asy Syahid
        </h1>
        <h2 className="mt-1 text-base font-semibold">
          Laporan Data Kedisiplinan
        </h2>
        <p className="mt-2 text-sm">
          Tanggal Cetak: {todayLabel}
        </p>
        <p className="text-sm">
          Dicetak Oleh: {profile?.nama_lengkap ?? '-'}
        </p>
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardHeader className="print:hidden">
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
                      Tanggal
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Diberikan Oleh
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Nama Siswa
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Kelas
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Kategori
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Divisi
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Pasal
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Tindakan
                    </TableHead>
                    <TableHead className="print:border print:border-[#333]">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className="print:border-[#333]"
                    >
                      <TableCell className="print:border print:border-[#333]">
                        {index + 1}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {formatTanggal(row.tanggal)}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.diberikan_oleh}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.students?.nama ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.students?.kelas ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.kategori_disiplin?.nama_kategori ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {formatDivisiLabel(
                          row.divisi?.nama_divisi,
                          row.divisi?.unit
                        )}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.pasal ? formatPasalLabel(row.pasal) : '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333] print:text-black">
                        {row.tindakan?.nama_tindakan ?? '-'}
                      </TableCell>
                      <TableCell className="print:border print:border-[#333]">
                        <span className="print:hidden">
                          <Badge variant={getStatusVariant(row.status)}>
                            {row.status}
                          </Badge>
                        </span>
                        <span className="hidden print:inline print:text-black">
                          {row.status}
                        </span>
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
