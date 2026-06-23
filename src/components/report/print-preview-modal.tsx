'use client'

// src/components/report/print-preview-modal.tsx
// Modal Print Preview untuk Laporan Hasil Belajar Siswa

import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { Loader2, Printer, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { ReportPeriod, SiswaReport } from '@/lib/queries/report'

interface PrintPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  report: SiswaReport | null
  isLoading: boolean
  period: ReportPeriod
  tahunAjaran?: string
  semester?: { nomor_semester: number; tahun_pelajaran?: any } | null
}

function formatPeriodLabel(period: ReportPeriod, tahunAjaran?: string): string {
  if (period.type === 'month') {
    const date = new Date(period.year, period.month - 1, 1)
    return format(date, 'MMMM yyyy', { locale: idLocale })
  }
  return tahunAjaran ? `Semester (${tahunAjaran})` : 'Per Semester'
}

function formatTanggal(value: string | null): string {
  if (!value) return '-'
  try {
    return format(parseISO(value), 'dd/MM/yyyy')
  } catch {
    return value
  }
}

export function PrintContent({
  report,
  period,
  tahunAjaran,
  semester,
}: {
  report: SiswaReport
  period: ReportPeriod
  tahunAjaran?: string
  semester?: { nomor_semester: number; tahun_pelajaran?: any } | null
}) {
  const today = format(new Date(), 'dd MMMM yyyy', { locale: idLocale })
  const periodLabel = formatPeriodLabel(period, tahunAjaran)

  const sekolahNama =
    report.unit === 'SD'
      ? 'SD Quran Asy Syahid'
      : report.unit === 'SMP'
      ? 'SMP Quran Asy Syahid'
      : 'SMA Quran Asy Syahid'

  return (
    <div className="print-content font-[Arial,sans-serif] text-black text-sm leading-relaxed">
      {/* ── Kop Surat ── */}
      <div className="text-center border-b-2 border-black pb-3 mb-4">
        <h1 className="text-base font-bold uppercase tracking-wide">{sekolahNama}</h1>
        <p className="text-xs">Pondok Pesantren Quran Asy Syahid</p>
        <p className="text-xs">Jl. Raya Cikaret No.1, Bogor, Jawa Barat</p>
        <h2 className="mt-2 text-sm font-bold uppercase">
          LAPORAN HASIL BELAJAR SISWA
        </h2>
        <p className="text-xs font-medium">Periode: {periodLabel}</p>
      </div>

      {/* ── Identitas Siswa ── */}
      <div className="grid grid-cols-2 gap-x-6 mb-4 text-xs">
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="w-28 shrink-0 font-semibold">Nama Siswa</span>
            <span>: {report.nama}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-28 shrink-0 font-semibold">NISN</span>
            <span>: {report.nomorInduk ?? '-'}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-28 shrink-0 font-semibold">Kelas</span>
            <span>: {report.kelasNama}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="w-28 shrink-0 font-semibold">Unit</span>
            <span>: {report.unit}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-28 shrink-0 font-semibold">Kamar</span>
            <span>: {report.kamar ?? '-'}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-28 shrink-0 font-semibold">Tahun Ajaran</span>
            <span>
              : {tahunAjaran ?? '-'}
              {semester ? ` (Semester ${semester.nomor_semester})` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabel Nilai ── */}
      <section className="mb-4" style={{ pageBreakInside: 'avoid' }}>
        <h3 className="font-bold text-xs uppercase border-b border-black pb-1 mb-2">
          A. Rekapitulasi Nilai
        </h3>
        {report.nilaiPerMapel.length === 0 ? (
          <p className="text-xs italic text-gray-500">Belum ada data nilai.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-2 py-1 text-center w-8">No</th>
                <th className="border border-gray-400 px-2 py-1 text-left">Mata Pelajaran</th>
                <th className="border border-gray-400 px-2 py-1 text-center w-20 font-bold">Nilai Akhir</th>
                <th className="border border-gray-400 px-2 py-1 text-left">Tujuan Pembelajaran</th>
              </tr>
            </thead>
            <tbody>
              {report.nilaiPerMapel.map((m, idx) => (
                <tr key={m.mapelId} style={{ pageBreakInside: 'avoid' }}>
                  <td className="border border-gray-400 px-2 py-1 text-center">{idx + 1}</td>
                  <td className="border border-gray-400 px-2 py-1 font-medium">{m.namaMapel}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center font-bold">
                    {m.nilaiAkhir !== null ? m.nilaiAkhir.toFixed(1) : '-'}
                  </td>
                  <td className="border border-gray-400 px-2 py-1 text-xs text-gray-700">
                    {m.tujuanPembelajaran}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Tabel Absensi ── */}
      <section className="mb-4" style={{ pageBreakInside: 'avoid' }}>
        <h3 className="font-bold text-xs uppercase border-b border-black pb-1 mb-2">
          B. Rekap Kehadiran
        </h3>
        <table className="border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-1 text-center">Hadir</th>
              <th className="border border-gray-400 px-3 py-1 text-center">Sakit</th>
              <th className="border border-gray-400 px-3 py-1 text-center">Izin</th>
              <th className="border border-gray-400 px-3 py-1 text-center">Tanpa Keterangan</th>
              <th className="border border-gray-400 px-3 py-1 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 px-3 py-1 text-center">{report.absensi.hadir}</td>
              <td className="border border-gray-400 px-3 py-1 text-center">{report.absensi.sakit}</td>
              <td className="border border-gray-400 px-3 py-1 text-center">{report.absensi.izin}</td>
              <td className="border border-gray-400 px-3 py-1 text-center">{report.absensi.alpha}</td>
              <td className="border border-gray-400 px-3 py-1 text-center font-bold">{report.absensi.total}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Kedisiplinan ── */}
      <section className="mb-4" style={{ pageBreakInside: 'avoid' }}>
        <h3 className="font-bold text-xs uppercase border-b border-black pb-1 mb-2">
          C. Catatan Kedisiplinan
        </h3>
        {report.kedisiplinan.length === 0 ? (
          <p className="text-xs italic text-gray-500">Tidak ada catatan kedisiplinan pada periode ini.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-2 py-1 text-center w-8">No</th>
                <th className="border border-gray-400 px-2 py-1 text-center w-24">Tanggal</th>
                <th className="border border-gray-400 px-2 py-1 text-left">Kategori</th>
                <th className="border border-gray-400 px-2 py-1 text-left">Pasal</th>
                <th className="border border-gray-400 px-2 py-1 text-center w-14">Poin</th>
              </tr>
            </thead>
            <tbody>
              {report.kedisiplinan.map((k, idx) => (
                <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                  <td className="border border-gray-400 px-2 py-1 text-center">{idx + 1}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{formatTanggal(k.tanggal)}</td>
                  <td className="border border-gray-400 px-2 py-1">{k.kategori}</td>
                  <td className="border border-gray-400 px-2 py-1">{k.pasal}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{k.poin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Prestasi ── */}
      <section className="mb-6" style={{ pageBreakInside: 'avoid' }}>
        <h3 className="font-bold text-xs uppercase border-b border-black pb-1 mb-2">
          D. Daftar Prestasi
        </h3>
        {report.prestasi.length === 0 ? (
          <p className="text-xs italic text-gray-500">Tidak ada prestasi pada periode ini.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-2 py-1 text-center w-8">No</th>
                <th className="border border-gray-400 px-2 py-1 text-center w-24">Tanggal</th>
                <th className="border border-gray-400 px-2 py-1 text-left">Nama Event</th>
                <th className="border border-gray-400 px-2 py-1 text-center w-24">Juara</th>
                <th className="border border-gray-400 px-2 py-1 text-left">Tingkat</th>
              </tr>
            </thead>
            <tbody>
              {report.prestasi.map((p, idx) => (
                <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
                  <td className="border border-gray-400 px-2 py-1 text-center">{idx + 1}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{formatTanggal(p.waktu)}</td>
                  <td className="border border-gray-400 px-2 py-1">{p.namaEvent}</td>
                  <td className="border border-gray-400 px-2 py-1 text-center">{p.juara}</td>
                  <td className="border border-gray-400 px-2 py-1">{p.tingkat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Blok Tanda Tangan ── */}
      <section style={{ pageBreakInside: 'avoid' }}>
        <div className="grid grid-cols-3 gap-4 text-xs mt-8">
          {/* Kiri: Orang Tua */}
          <div className="text-center">
            <p className="font-semibold">Orang Tua Murid</p>
            <div className="h-16 mt-2" />
            <p className="border-t border-black pt-1 font-medium">(............................)</p>
          </div>

          {/* Tengah: Kepala Sekolah */}
          <div className="text-center">
            <p className="font-semibold">Kepala Sekolah</p>
            <div className="h-16 mt-2" />
            <p className="border-t border-black pt-1 font-medium">(............................)</p>
          </div>

          {/* Kanan: Wali Kelas */}
          <div className="text-right">
            <p>Bogor, {today}</p>
            <p className="font-semibold mt-1">Wali Kelas</p>
            <div className="h-16 mt-2" />
            <p className="border-t border-black pt-1 font-medium text-center">(............................)</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export function PrintPreviewModal({
  isOpen,
  onClose,
  report,
  isLoading,
  period,
  tahunAjaran,
  semester,
}: PrintPreviewModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handlePrint = () => {
    window.print()
  }

  if (!isOpen) return null

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          body > *:not(#print-portal) { display: none !important; }
          #print-portal { display: block !important; position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; }
          .no-print { display: none !important; }
          .print-content { padding: 12mm; font-size: 10pt; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          section { page-break-inside: avoid; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>

      {/* ── Backdrop ── */}
      <div
        id="print-portal"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        aria-modal="true"
        role="dialog"
        aria-label="Print Preview Laporan"
      >
        {/* ── Modal Container ── */}
        <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* ── Toolbar (no-print) ── */}
          <div className="no-print flex items-center justify-between px-6 py-4 border-b bg-[var(--surface)] sticky top-0 z-10">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Preview Laporan — {report?.nama ?? '...'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {report ? formatPeriodLabel(period, tahunAjaran) : 'Memuat data...'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handlePrint}
                disabled={isLoading || !report}
                size="sm"
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Cetak
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Tutup modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── Content ── */}
          <div ref={printRef} className="p-8 min-h-[600px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 text-[var(--text-secondary)]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Memuat data laporan...</p>
              </div>
            ) : report ? (
              <PrintContent report={report} period={period} tahunAjaran={tahunAjaran} semester={semester} />
            ) : (
              <div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">
                <p className="text-sm">Tidak ada data laporan tersedia.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
