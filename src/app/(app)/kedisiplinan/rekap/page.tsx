'use client'

import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Eye, Medal, Search, ShieldAlert, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useDebounce } from '@/hooks/use-debounce'
import {
  getDetailSiswa,
  getKelasOptions,
  getRekapPoin,
  getTahunOptions,
  getTop10Leaderboard,
  type RekapPoinSiswa,
} from '@/lib/queries/rekap-poin'
import type { Unit } from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const
const UNITS: Unit[] = ['SD', 'SMP', 'SMA']

type RekapTableRow = RekapPoinSiswa & { id: string }

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

function LeaderboardList({
  items,
  type,
  onDetail,
}: {
  items: RekapPoinSiswa[]
  type: 'prestasi' | 'pelanggaran'
  onDetail: (siswaId: string) => void
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Belum ada data"
        description={`Tidak ada siswa dengan poin ${type} pada filter ini`}
        className="py-8"
      />
    )
  }

  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item.siswa_id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface dark:bg-zinc-900/50 px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 dark:bg-zinc-800 text-xs font-bold text-text-secondary dark:text-zinc-200">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary dark:text-zinc-100">
                {item.nama}
              </p>
              <p className="text-xs text-text-secondary dark:text-zinc-400">{item.kelas}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={
                type === 'prestasi'
                  ? 'text-sm font-bold text-status-green'
                  : 'text-sm font-bold text-status-red'
              }
            >
              {type === 'prestasi'
                ? `+${item.total_poin_prestasi}`
                : item.total_poin_pelanggaran}{' '}
              poin
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-text-secondary hover:text-text-primary"
              aria-label={`Detail ${item.nama}`}
              onClick={() => onDetail(item.siswa_id)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function RekapPoinPage() {
  const [activeUnit, setActiveUnit] = useState<Unit>('SD')
  const [search, setSearch] = useState('')
  const [selectedKelas, setSelectedKelas] = useState<string[]>([])
  const [selectedTahun, setSelectedTahun] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedSiswaId, setSelectedSiswaId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'pelanggaran' | 'prestasi'>(
    'pelanggaran'
  )

  const debouncedSearch = useDebounce(search, 300)
  const tahunFilter =
    selectedTahun !== 'all' ? Number.parseInt(selectedTahun, 10) : undefined

  const filterOptions = useMemo(
    () => ({
      unit: activeUnit,
      kelas: selectedKelas.length > 0 ? selectedKelas : undefined,
      search: debouncedSearch || undefined,
      tahun: tahunFilter,
    }),
    [activeUnit, selectedKelas, debouncedSearch, tahunFilter]
  )

  const { data: kelasOptions = [] } = useQuery({
    queryKey: ['rekap-kelas-options', activeUnit],
    queryFn: () => getKelasOptions(activeUnit),
  })

  const { data: tahunOptions = [] } = useQuery({
    queryKey: ['rekap-tahun-options'],
    queryFn: getTahunOptions,
  })

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['rekap-leaderboard', filterOptions],
    queryFn: () => getTop10Leaderboard(filterOptions),
  })

  const { data: rekapResult, isLoading: rekapLoading } = useQuery({
    queryKey: ['rekap-poin', filterOptions, page, pageSize],
    queryFn: () =>
      getRekapPoin({
        ...filterOptions,
        page,
        pageSize,
      }),
  })

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['rekap-detail', selectedSiswaId, tahunFilter],
    queryFn: () => getDetailSiswa(selectedSiswaId!, tahunFilter),
    enabled: selectedSiswaId !== null,
  })

  const filteredDetailData = useMemo(() => {
    if (!detailData) return null
    return {
      ...detailData,
      riwayat_pelanggaran: detailData.riwayat_pelanggaran.filter(
        (item) => item.status === 'Sudah Diproses'
      ),
      riwayat_prestasi: detailData.riwayat_prestasi.filter(
        (item) => item.status === 'Sudah Diproses'
      ),
    }
  }, [detailData])

  const tableData = useMemo<RekapTableRow[]>(
    () =>
      (rekapResult?.data ?? []).map((row) => ({
        ...row,
        id: row.siswa_id,
      })),
    [rekapResult?.data]
  )

  const toggleKelas = (kelas: string) => {
    setSelectedKelas((prev) =>
      prev.includes(kelas)
        ? prev.filter((k) => k !== kelas)
        : [...prev, kelas]
    )
    setPage(1)
  }

  const handleUnitChange = (unit: Unit) => {
    setActiveUnit(unit)
    setPage(1)
    setSelectedKelas([])
  }

  const openDetail = (siswaId: string) => {
    setDetailTab('pelanggaran')
    setSelectedSiswaId(siswaId)
  }

  const columns = useMemo<ColumnDef<RekapTableRow>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      {
        accessorKey: 'nama',
        header: 'Nama Siswa',
        cell: ({ row }) => row.original.nama,
      },
      {
        accessorKey: 'kelas',
        header: 'Kelas',
        cell: ({ row }) => row.original.kelas,
      },
      {
        accessorKey: 'total_poin_pelanggaran',
        header: 'Poin Pelanggaran',
        cell: ({ row }) => (
          <span className="font-semibold text-status-red">
            {row.original.total_poin_pelanggaran}
          </span>
        ),
      },
      {
        accessorKey: 'total_poin_prestasi',
        header: 'Poin Prestasi',
        cell: ({ row }) => (
          <span className="font-semibold text-status-green">
            +{row.original.total_poin_prestasi}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => openDetail(row.original.siswa_id)}
          >
            <Eye className="h-4 w-4" />
            Detail
          </Button>
        ),
      },
    ],
    [page, pageSize]
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Rekap Poin & Leaderboard" />

      <Tabs
        value={activeUnit}
        onValueChange={(value) => handleUnitChange(value as Unit)}
      >
        <TabsList>
          {UNITS.map((unit) => (
            <TabsTrigger key={unit} value={unit}>
              {unit}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter Data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              placeholder="Cari nama siswa..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="min-w-[160px]">
                Kelas
                {selectedKelas.length > 0
                  ? ` (${selectedKelas.length})`
                  : ''}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="space-y-2">
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
                        id={`kelas-${option.value}`}
                        checked={selectedKelas.includes(option.value)}
                        onCheckedChange={() => toggleKelas(option.value)}
                      />
                      <Label
                        htmlFor={`kelas-${option.value}`}
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

          <Select
            value={selectedTahun}
            onValueChange={(value) => {
              setSelectedTahun(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Semua Tahun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tahun</SelectItem>
              {tahunOptions.map((tahun) => (
                <SelectItem key={tahun} value={String(tahun)}>
                  {tahun}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-5 w-5 text-status-green" />
            <CardTitle className="text-base">Top 10 Prestasi</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardLoading ? (
              <LeaderboardSkeleton />
            ) : (
              <LeaderboardList
                items={leaderboard?.topPrestasi ?? []}
                type="prestasi"
                onDetail={openDetail}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-status-red" />
            <CardTitle className="text-base">Top 10 Pelanggaran</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboardLoading ? (
              <LeaderboardSkeleton />
            ) : (
              <LeaderboardList
                items={leaderboard?.topPelanggaran ?? []}
                type="pelanggaran"
                onDetail={openDetail}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Medal className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Rekap Poin Siswa</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={tableData}
            pagination={{
              page,
              pageSize,
              total: rekapResult?.total ?? 0,
            }}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            onSortChange={() => { }}
            isLoading={rekapLoading}
          />
        </CardContent>
      </Card>

      <Sheet
        open={selectedSiswaId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSiswaId(null)
        }}
      >
        <SheetContent className="overflow-y-auto dark:bg-zinc-900 dark:border-zinc-800">
          <SheetHeader>
            <SheetTitle asChild>
              <div className="text-lg font-semibold text-text-primary dark:text-zinc-200">
                {detailLoading ? (
                  <Skeleton className="h-6 w-48" />
                ) : (
                  (filteredDetailData?.siswa.nama ?? 'Detail Siswa')
                )}
              </div>
            </SheetTitle>
            <SheetDescription asChild>
              <span className="block mt-1 text-sm text-text-secondary dark:text-zinc-400">
                {detailLoading ? (
                  <Skeleton className="mt-1 h-4 w-32" />
                ) : (
                  `${filteredDetailData?.siswa.kelas} · Unit ${filteredDetailData?.siswa.unit}`
                )}
              </span>
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            {detailLoading || !filteredDetailData ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border dark:bg-zinc-900/40 p-3 text-center">
                    <p className="text-xs text-text-secondary dark:text-zinc-300">Pelanggaran</p>
                    <p className="text-lg font-bold text-status-red">
                      {filteredDetailData.total_poin_pelanggaran}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border dark:bg-zinc-900/40 p-3 text-center">
                    <p className="text-xs text-text-secondary dark:text-zinc-300">Prestasi</p>
                    <p className="text-lg font-bold text-status-green">
                      +{filteredDetailData.total_poin_prestasi}
                    </p>
                  </div>
                </div>

                <Tabs
                  value={detailTab}
                  onValueChange={(value) =>
                    setDetailTab(value as 'pelanggaran' | 'prestasi')
                  }
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="pelanggaran" className="flex-1 dark:text-zinc-300">
                      Pelanggaran ({filteredDetailData.riwayat_pelanggaran.length})
                    </TabsTrigger>
                    <TabsTrigger value="prestasi" className="flex-1 dark:text-zinc-300">
                      Prestasi ({filteredDetailData.riwayat_prestasi.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pelanggaran" className="mt-4">
                    {filteredDetailData.riwayat_pelanggaran.length === 0 ? (
                      <EmptyState
                        title="Tidak ada riwayat pelanggaran"
                        description="Siswa ini belum memiliki catatan pelanggaran"
                      />
                    ) : (
                      <div className="space-y-2 ">
                        {filteredDetailData.riwayat_pelanggaran.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-3 dark:bg-zinc-900/20"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-tight text-text-primary dark:text-zinc-200">
                                {item.nama_pasal}
                              </p>
                              <p className="mt-0.5 text-xs text-text-secondary dark:text-zinc-400">
                                {item.nama_kategori}
                              </p>
                              <p className="mt-1 text-xs text-text-tertiary">
                                {format(new Date(item.tanggal), 'dd MMM yyyy', {
                                  locale: idLocale,
                                })}
                              </p>
                              <Badge variant="destructive" className="mt-1.5 text-xs">
                                {item.status}
                              </Badge>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-sm font-bold text-status-red">
                                {item.poin}
                              </span>
                              <p className="text-xs text-text-tertiary">poin</p>
                            </div>
                          </div>
                        ))}

                        <Separator className="my-2" />
                        <div className="flex items-center justify-between px-1 py-2">
                          <span className="text-sm font-semibold text-text-primary dark:text-zinc-200">
                            Total Poin Pelanggaran
                          </span>
                          <span className="text-base font-bold text-status-red">
                            {filteredDetailData.total_poin_pelanggaran} poin
                          </span>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="prestasi" className="mt-4">
                    {filteredDetailData.riwayat_prestasi.length === 0 ? (
                      <EmptyState
                        title="Tidak ada riwayat prestasi"
                        description="Siswa ini belum memiliki catatan prestasi"
                      />
                    ) : (
                      <div className="space-y-2">
                        {filteredDetailData.riwayat_prestasi.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface dark:bg-zinc-900/20 p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-tight text-text-primary dark:text-zinc-400">
                                {item.nama_pasal}
                              </p>
                              <p className="mt-0.5 text-xs text-text-secondary dark:text-zinc-400">
                                {item.nama_kategori}
                              </p>
                              <p className="mt-1 text-xs text-text-tertiary">
                                {format(new Date(item.tanggal), 'dd MMM yyyy', {
                                  locale: idLocale,
                                })}
                              </p>
                              <Badge
                                variant="success"
                                className="mt-1.5 border-status-green/20 bg-status-green-bg text-xs text-status-green"
                              >
                                Prestasi Diakui
                              </Badge>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-sm font-bold text-status-green">
                                +{item.poin}
                              </span>
                              <p className="text-xs text-text-tertiary">poin</p>
                            </div>
                          </div>
                        ))}

                        <Separator className="my-2" />
                        <div className="flex items-center justify-between px-1 py-2">
                          <span className="text-sm font-semibold text-text-primary dark:text-zinc-200">
                            Total Poin Prestasi
                          </span>
                          <span className="text-base font-bold text-status-green">
                            {filteredDetailData.total_poin_prestasi} poin
                          </span>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  )
}
