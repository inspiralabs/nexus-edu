'use client'

import Image from 'next/image'
import {
  BookOpen,
  CheckCircle,
  GraduationCap,
  Heart,
  ShieldCheck,
  Star,
  UserCog,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { CREATOR_WHATSAPP, INSPIRALABS_URL } from '@/lib/constants'
import type { Role } from '@/lib/supabase/types'

// ─── Guide content per role ──────────────────────────────────────────
interface GuideItem {
  title: string
  steps: string[]
}

const GUIDES: Record<Role, { heading: string; icon: React.ElementType; items: GuideItem[] }> = {
  user: {
    heading: 'Panduan Guru & Musyrif',
    icon: GraduationCap,
    items: [
      {
        title: 'Input Kedisiplinan',
        steps: [
          'Buka menu Kedisiplinan → Data.',
          'Klik tombol "Tambah Data" dan pilih siswa, pasal, serta tindakan.',
          'Tekan simpan. Poin otomatis direkap ke halaman Rekap Poin.',
        ],
      },
      {
        title: 'Input Prestasi',
        steps: [
          'Buka menu Prestasi → Data.',
          'Klik "Tambah Data", pilih tab Siswa atau Guru.',
          'Isi form: Event, Juara, Bidang, Tingkat Kejuaraan.',
          'Poin prestasi akan masuk ke antrian persetujuan di Dashboard Kedisiplinan.',
        ],
      },
      {
        title: 'Input Presensi & Nilai',
        steps: [
          'Buka menu Akademik → Presensi atau Nilai Harian.',
          'Pilih mata pelajaran yang Anda ampu.',
          'Isi status kehadiran atau nilai setiap siswa.',
          'Nilai yang belum di-approve tidak terlihat oleh orang tua.',
        ],
      },
      {
        title: 'Input Mutabaah',
        steps: [
          'Buka menu Kepesantrenan → Input Harian.',
          'Pilih kamar dan tanggal.',
          'Centang atau isi status setiap kegiatan untuk setiap santri.',
          'Pada hari libur, status otomatis terisi "L".',
        ],
      },
    ],
  },
  admin: {
    heading: 'Panduan Administrator',
    icon: UserCog,
    items: [
      {
        title: 'Approve Pengguna Baru',
        steps: [
          'Buka Admin → Kelola User.',
          'Cari pengguna yang statusnya "Menunggu Persetujuan".',
          'Klik ikon centang untuk mengaktifkan atau tolak akun.',
        ],
      },
      {
        title: 'Kelola Data Master',
        steps: [
          'Isi tabel master (Kategori, Divisi, Pasal, Tindakan, Event, Juara, Bidang, Kategori Prestasi) sebelum guru mulai input.',
          'Data master yang kosong akan menyebabkan form tidak bisa disubmit.',
        ],
      },
      {
        title: 'Manajemen Semester & TP',
        steps: [
          'Buka Admin → Semester & TP.',
          'Tambahkan Tahun Pelajaran baru, lalu buat Semester 1 dan Semester 2.',
          'Aktifkan semester yang sedang berjalan dengan toggle "Aktif".',
        ],
      },
      {
        title: 'Setujui Poin Prestasi',
        steps: [
          'Buka Dashboard Kedisiplinan.',
          'Lihat tabel "Antrian Persetujuan Poin".',
          'Klik "Setujui" agar poin masuk ke rekap dan leaderboard.',
        ],
      },
    ],
  },
  superadmin: {
    heading: 'Panduan Super Administrator',
    icon: ShieldCheck,
    items: [
      {
        title: 'System Settings',
        steps: [
          'Buka Superadmin → System Settings.',
          'Ubah konfigurasi global platform sesuai kebutuhan institusi.',
        ],
      },
      {
        title: 'Audit Log',
        steps: [
          'Buka Superadmin → Audit Log.',
          'Setiap aksi CRUD oleh semua user tercatat di sini beserta timestamp dan data before/after.',
        ],
      },
      {
        title: 'Analytics',
        steps: [
          'Buka Superadmin → Analytics untuk melihat statistik penggunaan platform secara keseluruhan.',
        ],
      },
      {
        title: 'Role Management',
        steps: [
          'Buka Superadmin → Role Management.',
          'Ubah role pengguna (user ↔ admin ↔ superadmin ↔ orangtua) jika diperlukan.',
        ],
      },
    ],
  },
  orangtua: {
    heading: 'Panduan Orang Tua',
    icon: Heart,
    items: [
      {
        title: 'Memantau Perkembangan Anak',
        steps: [
          'Setelah login, Anda akan langsung masuk ke Dashboard Orang Tua.',
          'Dashboard menampilkan ringkasan nilai, kehadiran, ibadah, dan prestasi anak Anda.',
        ],
      },
      {
        title: 'Membaca Grafik Nilai',
        steps: [
          'Buka Perkembangan Anak → Akademik.',
          'Grafik menampilkan rata-rata nilai per semester.',
          'Nilai yang belum disetujui guru tidak akan tampil.',
        ],
      },
      {
        title: 'Memantau Mutabaah (Ibadah)',
        steps: [
          'Buka Perkembangan Anak → Mutabaah.',
          'Lihat checklist ibadah harian dan capaian persentase (A-E).',
        ],
      },
      {
        title: 'Memantau Kedisiplinan & Prestasi',
        steps: [
          'Buka Perkembangan Anak → Kedisiplinan untuk melihat rekap poin.',
          'Buka Perkembangan Anak → Prestasi untuk melihat daftar pencapaian anak.',
        ],
      },
    ],
  },
}

const PILLARS = [
  {
    id: 'guru',
    icon: GraduationCap,
    title: 'Untuk Guru',
    desc: 'Manajemen presensi, nilai harian, nilai UAS, dan rekap rapor secara digital dan sistematis.',
  },
  {
    id: 'musyrif',
    icon: BookOpen,
    title: 'Untuk Musyrif',
    desc: 'Catat mutabaah ibadah harian, poin kedisiplinan, dan prestasi santri secara terukur.',
  },
  {
    id: 'orangtua',
    icon: Heart,
    title: 'Untuk Orang Tua',
    desc: 'Pantau nilai, kehadiran, ibadah, dan prestasi anak dari rumah secara real-time.',
  },
]

const NILAI_UTAMA = [
  'Powerful & Digitalized',
  'User-Friendly',
  'Amanah & Akurat',
  'Transparan & Real-time',
]

export default function AboutPage() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'user'
  const guide = GUIDES[role]
  const GuideIcon = guide.icon

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* ─── Header Card ─── */}
      <Card>
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <Image
              src="/SQA.png"
              alt="Logo AMANAH Platform"
              width={140}
              height={44}
              className="h-10 w-auto object-contain"
              priority
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                AMANAH Platform
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Aplikasi Manajemen Anak &amp; Sekolah · Versi 2.0
              </p>
            </div>
          </div>

          {/* Deskripsi */}
          <div className="mt-6 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            <p>
              <strong className="text-slate-800 dark:text-slate-200">AMANAH</strong> adalah platform
              ekosistem digital sekolah terpadu yang hadir sebagai solusi total untuk menjembatani
              komunikasi, transparansi, dan pemantauan perkembangan anak secara real-time. Dirancang
              khusus untuk institusi pendidikan modern dan berasrama (pesantren).
            </p>
            <p>
              Seringkali perkembangan anak di sekolah—baik dari sisi akademis, karakter, maupun
              spiritual—terhambat oleh sekat komunikasi antara pihak sekolah, asrama, dan rumah.
              AMANAH hadir memecahkan masalah tersebut dengan menyatukan tiga pilar utama pendidikan:
              <strong className="text-slate-800 dark:text-slate-200"> Guru, Musyrif, dan Orang Tua</strong> ke
              dalam satu ekosistem informasi yang transparan dan akurat.
            </p>
            <p>
              Dengan AMANAH, manajemen sekolah menjadi lebih efisien, tugas pendidik menjadi lebih
              ringan, dan orang tua dapat memantau buah hati mereka dengan penuh rasa aman.{' '}
              <em>Amanah: Menjaga Kepercayaan, Membangun Masa Depan.</em>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── 3 Pilar ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Tiga Pilar Utama
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon
              return (
                <div
                  key={pillar.id}
                  className="flex flex-col items-center rounded-xl border border-border bg-surface-2/40 p-5 text-center"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {pillar.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {pillar.desc}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Nilai utama */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {NILAI_UTAMA.map((nilai) => (
              <div key={nilai} className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {nilai}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Panduan per Role ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GuideIcon className="h-5 w-5 text-primary" />
            {guide.heading}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {guide.items.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-surface-2/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {item.title}
                  </h3>
                </div>
                <ul className="space-y-1.5 pl-8">
                  {item.steps.map((step, sIdx) => (
                    <li
                      key={sIdx}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                    >
                      <Star className="mt-0.5 h-3 w-3 shrink-0 text-secondary" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Footer About ─── */}
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dikembangkan oleh{' '}
            <a
              href={INSPIRALABS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              InspiraLabs
            </a>{' '}
            &middot;{' '}
            <a
              href={CREATOR_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Unggul Sulaiman, S.Kom
            </a>
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Versi 2.0 &mdash; 2026
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
