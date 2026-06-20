'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Award,
  BookOpen,
  ClipboardList,
  GraduationCap,
  ShieldAlert,
  Trophy,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  getAnakSaya,
  getDashboardOrangTua,
  getNilaiHarianAnak,
  getPrestasiAnak,
  getMutabaahAnak,
} from '@/lib/queries/orangtua'
import type { Student } from '@/lib/supabase/types'

function formatTanggal(tanggal: string): string {
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return tanggal
  }
}

export default function OrangTuaDashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isLoading: authLoading } = useAuth()

  // Guard: Hanya role 'orangtua' yang boleh masuk
  useEffect(() => {
    if (!authLoading && profile && profile.role !== 'orangtua') {
      router.replace('/dashboard')
    }
  }, [profile, authLoading, router])

  // Query daftar anak yang dihubungkan ke orangtua
  const { data: anakList = [], isLoading: anakLoading } = useQuery({
    queryKey: ['orangtua-anak-list', profile?.id],
    queryFn: () => getAnakSaya(profile?.id || ''),
    enabled: !!profile?.id && profile.role === 'orangtua',
  })

  // State untuk menyimpan anak yang sedang dipilih
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>('')

  // Set default anak pertama jika list sudah terisi dan belum ada yang terpilih
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

  // Handler pergantian anak
  const handleSiswaChange = (id: string) => {
    setSelectedSiswaId(id)
    const params = new URLSearchParams(window.location.search)
    params.set('siswaId', id)
    router.push(`${window.location.pathname}?${params.toString()}`)
  }

  // Query dashboard rekap data anak
  const { data: rekap, isLoading: rekapLoading } = useQuery({
    queryKey: ['orangtua-rekap', selectedSiswaId],
    queryFn: () => getDashboardOrangTua(selectedSiswaId),
    enabled: !!selectedSiswaId,
  })

  // Query preview 3 nilai harian terbaru
  const { data: recentNilai = [], isLoading: nilaiLoading } = useQuery({
    queryKey: ['orangtua-recent-nilai', selectedSiswaId],
    queryFn: () => getNilaiHarianAnak(selectedSiswaId),
    enabled: !!selectedSiswaId,
  })

  // Query preview 3 prestasi terbaru
  const { data: recentPrestasi = [], isLoading: prestasiLoading } = useQuery({
    queryKey: ['orangtua-recent-prestasi', selectedSiswaId],
    queryFn: () => getPrestasiAnak(selectedSiswaId),
    enabled: !!selectedSiswaId,
  })

  // Query preview 5 mutabaah terbaru
  const { data: recentMutabaah = [], isLoading: mutabaahLoading } = useQuery({
    queryKey: ['orangtua-recent-mutabaah', selectedSiswaId],
    queryFn: () => getMutabaahAnak(selectedSiswaId),
    enabled: !!selectedSiswaId,
  })

  // Loading state umum
  if (authLoading || anakLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Empty state jika belum ada anak yang dihubungkan
  if (anakList.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard Orang Tua" />
        <EmptyState
          title="Belum Terhubung dengan Siswa"
          description="Belum ada data anak yang dihubungkan ke akun ini. Silakan hubungi admin sekolah untuk mengaitkan profil anak Anda."
          icon={GraduationCap}
        />
      </div>
    )
  }

  const activeStudent = anakList.find((s) => s.id === selectedSiswaId) || anakList[0]

  return (
    <div className="space-y-6">
      {/* Header dengan Selector Anak */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Dashboard Orang Tua"
          description={`Memantau perkembangan akademis & karakter ${activeStudent?.nama || ''}`}
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

      {/* Stats Section */}
      {rekapLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Kehadiran (Bulan Ini)"
            value={`${rekap?.kehadiranBulanIni ?? 0}%`}
            icon={ClipboardList}
            variant="primary"
          />
          <StatCard
            title="Rata-rata Nilai"
            value={rekap?.rataNilai ?? 0}
            icon={GraduationCap}
            variant="secondary"
          />
          <StatCard
            title="Total Poin Prestasi"
            value={rekap?.totalPoinPrestasi ?? 0}
            icon={Trophy}
            variant="primary"
          />
          <StatCard
            title="Total Poin Pelanggaran"
            value={rekap?.totalPoinPelanggaran ?? 0}
            icon={ShieldAlert}
            variant="default"
          />
          <StatCard
            title="Capaian Mutabaah"
            value={`${rekap?.skorMutabaah ?? 0}%`}
            icon={BookOpen}
            variant="secondary"
          />
        </div>
      )}

      {/* Previews / Aktivitas Terbaru */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        
        {/* Preview Nilai Harian (Terbaru) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Nilai Akademik Terbaru (Disetujui)
            </CardTitle>
            <Badge variant="outline">Maks. 3 data</Badge>
          </CardHeader>
          <CardContent>
            {nilaiLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recentNilai.length === 0 ? (
              <EmptyState
                title="Belum ada nilai terverifikasi"
                description="Nilai harian yang telah diverifikasi guru belum tersedia."
                className="py-8"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mata Pelajaran</TableHead>
                    <TableHead>Tugas / Materi</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Nilai Akhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentNilai.slice(0, 3).map((n: any) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">
                        {n.mata_pelajaran?.nama_mapel ?? '-'}
                      </TableCell>
                      <TableCell>{n.nama_tugas}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{n.tipe_nilai}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {n.nilai_final}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Preview Prestasi Terbaru */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Prestasi Terbaru</CardTitle>
            <Badge variant="outline">Maks. 3 data</Badge>
          </CardHeader>
          <CardContent>
            {prestasiLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recentPrestasi.length === 0 ? (
              <EmptyState
                title="Belum ada prestasi"
                description="Prestasi belum tercatat untuk siswa ini."
                className="py-8"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama Event</TableHead>
                    <TableHead>Juara</TableHead>
                    <TableHead>Tingkat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPrestasi.slice(0, 3).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatTanggal(p.waktu)}</TableCell>
                      <TableCell className="font-medium">
                        {p.event?.nama_event ?? p.nama_event ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">
                          {p.juara?.nama_juara ?? p.nama_juara ?? '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--text-secondary)]">
                        {p.tingkat_kejuaraan ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Preview Mutabaah Harian (Terbaru) */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Aktivitas Mutabaah Terakhir</CardTitle>
            <Badge variant="outline">Maks. 5 data</Badge>
          </CardHeader>
          <CardContent>
            {mutabaahLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recentMutabaah.length === 0 ? (
              <EmptyState
                title="Belum ada mutabaah harian"
                description="Log ibadah harian belum diinput oleh pembina asrama."
                className="py-8"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kegiatan</TableHead>
                    <TableHead>Sub Kegiatan</TableHead>
                    <TableHead className="text-right">Status Kehadiran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMutabaah.slice(0, 5).map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>{formatTanggal(m.tanggal)}</TableCell>
                      <TableCell className="font-medium">
                        {m.kegiatan?.nama_kegiatan ?? '-'}
                      </TableCell>
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
