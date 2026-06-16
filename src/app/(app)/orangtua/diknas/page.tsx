'use client'

import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Info, Printer } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { DatePicker } from '@/components/shared/date-picker'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { getMataKuliah, getSemesterOptions } from '@/lib/queries/diknas'
import {
  getAnakSaya,
  getCatatanKelakuanAnak,
  getNilaiHarianAnak,
  getNilaiUASAnak,
  getPresensiAnak,
  getRaportAnak,
} from '@/lib/queries/orangtua'

function formatTanggal(tanggal: string): string {
  try {
    return format(parseISO(tanggal), 'dd/MM/yyyy')
  } catch {
    return tanggal
  }
}

export default function OrangTuaDiknasPage() {
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
    queryKey: ['orangtua-anak-list-diknas', profile?.id],
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

  // Global Filters
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('all')
  const [selectedMapelId, setSelectedMapelId] = useState<string>('all')
  const [tanggalDari, setTanggalDari] = useState<Date | undefined>(undefined)
  const [tanggalSampai, setTanggalSampai] = useState<Date | undefined>(undefined)

  const formattedDari = tanggalDari ? format(tanggalDari, 'yyyy-MM-dd') : undefined
  const formattedSampai = tanggalSampai ? format(tanggalSampai, 'yyyy-MM-dd') : undefined

  // Query Semesters
  const { data: semesters = [], isLoading: semestersLoading } = useQuery({
    queryKey: ['orangtua-semesters'],
    queryFn: getSemesterOptions,
  })

  // Set default semester aktif jika ada
  useEffect(() => {
    if (semesters.length > 0 && selectedSemesterId === 'all') {
      const activeSem = semesters.find((s) => s.is_aktif)
      if (activeSem) {
        setSelectedSemesterId(activeSem.id)
      } else {
        setSelectedSemesterId(semesters[0].id)
      }
    }
  }, [semesters, selectedSemesterId])

  // Query Mata Pelajaran sesuai unit anak
  const { data: mapels = [] } = useQuery({
    queryKey: ['orangtua-mapels', activeStudent?.unit],
    queryFn: () => getMataKuliah(activeStudent?.unit || undefined),
    enabled: !!activeStudent?.unit,
  })

  // Reset filter mapel jika berganti anak
  useEffect(() => {
    setSelectedMapelId('all')
  }, [selectedSiswaId])

  // Query Data Kehadiran
  const { data: presensi = [], isLoading: presensiLoading } = useQuery({
    queryKey: [
      'orangtua-presensi',
      selectedSiswaId,
      selectedSemesterId,
      selectedMapelId,
      formattedDari,
      formattedSampai,
    ],
    queryFn: () =>
      getPresensiAnak(selectedSiswaId, {
        semesterId: selectedSemesterId === 'all' ? undefined : selectedSemesterId,
        mapelId: selectedMapelId === 'all' ? undefined : selectedMapelId,
        tanggalDari: formattedDari,
        tanggalSampai: formattedSampai,
      }),
    enabled: !!selectedSiswaId,
  })

  // Query Data Nilai Harian
  const { data: harian = [], isLoading: harianLoading } = useQuery({
    queryKey: ['orangtua-nilai-harian', selectedSiswaId, selectedSemesterId, selectedMapelId],
    queryFn: () =>
      getNilaiHarianAnak(selectedSiswaId, {
        semesterId: selectedSemesterId === 'all' ? undefined : selectedSemesterId,
        mapelId: selectedMapelId === 'all' ? undefined : selectedMapelId,
      }),
    enabled: !!selectedSiswaId,
  })

  // Query Data Nilai UAS
  const { data: uas = [], isLoading: uasLoading } = useQuery({
    queryKey: ['orangtua-nilai-uas', selectedSiswaId, selectedSemesterId, selectedMapelId],
    queryFn: () =>
      getNilaiUASAnak(selectedSiswaId, {
        semesterId: selectedSemesterId === 'all' ? undefined : selectedSemesterId,
        mapelId: selectedMapelId === 'all' ? undefined : selectedMapelId,
      }),
    enabled: !!selectedSiswaId,
  })

  // Query Data Catatan Kelakuan
  const { data: catatan = [], isLoading: catatanLoading } = useQuery({
    queryKey: ['orangtua-catatan', selectedSiswaId, selectedSemesterId],
    queryFn: () =>
      getCatatanKelakuanAnak(selectedSiswaId, {
        semesterId: selectedSemesterId === 'all' ? undefined : selectedSemesterId,
      }),
    enabled: !!selectedSiswaId,
  })

  // Query Laporan Rapor
  const { data: raport = [], isLoading: raportLoading } = useQuery({
    queryKey: ['orangtua-raport', selectedSiswaId, selectedSemesterId],
    queryFn: () => getRaportAnak(selectedSiswaId, selectedSemesterId),
    enabled: !!selectedSiswaId && selectedSemesterId !== 'all',
  })

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
  if (authLoading || anakLoading || semestersLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (anakList.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Akademik Anak" />
        <EmptyState
          title="Belum Terhubung dengan Siswa"
          description="Belum ada data anak yang dihubungkan ke akun ini. Silakan hubungi admin sekolah."
          icon={Info}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Print header (formal, hidden di screen) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-xl font-bold text-center">SEKOLAH QURAN ASY SYAHID — AMANAH Platform</h1>
        <h2 className="text-lg font-semibold text-center mt-1">Laporan Akademik Perkembangan Siswa</h2>
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
          title="Akademik Anak"
          description={`Laporan nilai & presensi akademis dari ${activeStudent?.nama || ''}`}
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
        <CardContent className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          {/* Filter Semester */}
          <div className="space-y-2">
            <Label htmlFor="filter-semester" className="text-xs font-semibold">Semester</Label>
            <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
              <SelectTrigger id="filter-semester">
                <SelectValue placeholder="Pilih Semester" />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((sem) => (
                  <SelectItem key={sem.id} value={sem.id}>
                    Semester {sem.nomor_semester} - T.A. {sem.tahun_pelajaran?.nama || ''} {sem.is_aktif && '(Aktif)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Mapel */}
          <div className="space-y-2">
            <Label htmlFor="filter-mapel" className="text-xs font-semibold">Mata Pelajaran</Label>
            <Select value={selectedMapelId} onValueChange={setSelectedMapelId}>
              <SelectTrigger id="filter-mapel">
                <SelectValue placeholder="Semua Mapel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Mapel</SelectItem>
                {mapels.map((mapel) => (
                  <SelectItem key={mapel.id} value={mapel.id}>
                    {mapel.nama_mapel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tanggal Dari */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Dari Tanggal (Khusus Presensi)</Label>
            <DatePicker value={tanggalDari} onChange={setTanggalDari} placeholder="Pilih tanggal" />
          </div>

          {/* Tanggal Sampai */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Sampai Tanggal (Khusus Presensi)</Label>
            <DatePicker value={tanggalSampai} onChange={setTanggalSampai} placeholder="Pilih tanggal" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="presensi" className="w-full">
        <div className="flex items-center justify-between border-b pb-2 no-print">
          <TabsList>
            <TabsTrigger value="presensi">Presensi</TabsTrigger>
            <TabsTrigger value="harian">Nilai Harian</TabsTrigger>
            <TabsTrigger value="uas">Nilai UAS</TabsTrigger>
            <TabsTrigger value="catatan">Catatan Kelakuan</TabsTrigger>
            <TabsTrigger value="raport">Rekap Rapor</TabsTrigger>
          </TabsList>
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Cetak Laporan
          </Button>
        </div>

        {/* Tab Presensi */}
        <TabsContent value="presensi" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {presensiLoading ? (
                <div className="p-8 flex justify-center"><LoadingSpinner /></div>
              ) : presensi.length === 0 ? (
                <EmptyState
                  title="Presensi Kosong"
                  description="Tidak ada log presensi yang cocok dengan filter."
                  className="py-12"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Mata Pelajaran</TableHead>
                      <TableHead>Status Kehadiran</TableHead>
                      <TableHead>Keterangan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presensi.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{formatTanggal(p.tanggal)}</TableCell>
                        <TableCell>{p.mata_pelajaran?.nama_mapel ?? '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === 'Hadir'
                                ? 'success'
                                : p.status === 'Alpha'
                                ? 'destructive'
                                : 'warning'
                            }
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[var(--text-secondary)]">
                          {p.keterangan || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Nilai Harian */}
        <TabsContent value="harian" className="mt-4">
          <div className="space-y-4">
            <div className="no-print flex items-start gap-3 rounded-lg border border-primary-hover bg-primary-light p-4 text-primary">
              <Info className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-semibold">Informasi Penilaian</h5>
                <p className="text-sm">Nilai yang ditampilkan adalah nilai yang telah diverifikasi secara resmi oleh guru bersangkutan.</p>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                {harianLoading ? (
                  <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                ) : harian.length === 0 ? (
                  <EmptyState
                    title="Nilai Harian Kosong"
                    description="Belum ada data nilai harian yang terverifikasi."
                    className="py-12"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Mata Pelajaran</TableHead>
                        <TableHead>Tugas / Materi</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead>Nilai Asli</TableHead>
                        <TableHead>Remedial</TableHead>
                        <TableHead className="text-right">Nilai Final</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {harian.map((h: any) => (
                        <TableRow key={h.id}>
                          <TableCell>{h.tanggal ? formatTanggal(h.tanggal) : '-'}</TableCell>
                          <TableCell className="font-medium">
                            {h.mata_pelajaran?.nama_mapel ?? '-'}
                          </TableCell>
                          <TableCell>{h.nama_tugas}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{h.tipe_nilai}</Badge>
                          </TableCell>
                          <TableCell className="text-[var(--text-secondary)]">
                            {h.nilai_asli}
                          </TableCell>
                          <TableCell>
                            {h.nilai_remedial !== null ? (
                              <Badge variant="warning">{h.nilai_remedial}</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {h.nilai_final}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Nilai UAS */}
        <TabsContent value="uas" className="mt-4">
          <div className="space-y-4">
            <div className="no-print flex items-start gap-3 rounded-lg border border-primary-hover bg-primary-light p-4 text-primary">
              <Info className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-semibold">Informasi Penilaian</h5>
                <p className="text-sm">Nilai yang ditampilkan adalah nilai yang telah diverifikasi secara resmi oleh guru bersangkutan.</p>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                {uasLoading ? (
                  <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                ) : uas.length === 0 ? (
                  <EmptyState
                    title="Nilai UAS Kosong"
                    description="Belum ada data nilai UAS yang terverifikasi."
                    className="py-12"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mata Pelajaran</TableHead>
                        <TableHead>Nilai Asli</TableHead>
                        <TableHead>Remedial</TableHead>
                        <TableHead className="text-right">Nilai Final</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uas.map((u: any) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            {u.mata_pelajaran?.nama_mapel ?? '-'}
                          </TableCell>
                          <TableCell className="text-[var(--text-secondary)]">
                            {u.nilai_asli}
                          </TableCell>
                          <TableCell>
                            {u.nilai_remedial !== null ? (
                              <Badge variant="warning">{u.nilai_remedial}</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {u.nilai_final}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Catatan Kelakuan */}
        <TabsContent value="catatan" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {catatanLoading ? (
                <div className="p-8 flex justify-center"><LoadingSpinner /></div>
              ) : catatan.length === 0 ? (
                <EmptyState
                  title="Catatan Kelakuan Kosong"
                  description="Tidak ada catatan kelakuan yang tercatat untuk semester ini."
                  className="py-12"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Catatan Evaluasi Guru</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catatan.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.tanggal ? formatTanggal(c.tanggal) : '-'}</TableCell>
                        <TableCell>
                          <Badge variant={c.tipe === 'Baik' ? 'success' : 'destructive'}>
                            {c.tipe}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-pre-wrap">{c.catatan}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Rekap Rapor */}
        <TabsContent value="raport" className="mt-4">
          <div className="space-y-4">
            <div className="no-print flex items-start gap-3 rounded-lg border border-primary-hover bg-primary-light p-4 text-primary">
              <Info className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-semibold">Rekap Nilai Rapor</h5>
                <p className="text-sm">Rekap dihitung berdasarkan rata-rata Nilai Formatif, Sumatif, dan UAS yang telah diapprove.</p>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                {raportLoading ? (
                  <div className="p-8 flex justify-center"><LoadingSpinner /></div>
                ) : raport.length === 0 ? (
                  <EmptyState
                    title="Rekap Rapor Belum Tersedia"
                    description="Pilih semester tertentu terlebih dahulu."
                    className="py-12"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mata Pelajaran</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Rata Formatif</TableHead>
                        <TableHead>Rata Sumatif</TableHead>
                        <TableHead>Nilai UAS</TableHead>
                        <TableHead className="text-right">Estimasi Nilai Rapor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {raport.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-semibold">{r.nama_mapel}</TableCell>
                          <TableCell className="text-xs text-[var(--text-secondary)]">{r.kategori}</TableCell>
                          <TableCell>{r.avg_formatif}</TableCell>
                          <TableCell>{r.avg_sumatif}</TableCell>
                          <TableCell>{r.nilai_uas !== null ? r.nilai_uas : '-'}</TableCell>
                          <TableCell className="text-right font-bold text-primary text-base">
                            {r.nilai_rapor}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
