'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar, SidebarProvider, useSidebar } from '@/components/layout/sidebar'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { useAuth } from '@/hooks/use-auth'
import { CREATOR_WHATSAPP, INSPIRALABS_URL } from '@/lib/constants'

const PATH_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/students': 'Data Siswa',
  '/kedisiplinan': 'Dashboard Kedisiplinan',
  '/kedisiplinan/data': 'Data Kedisiplinan',
  '/kedisiplinan/rekap': 'Rekap Poin & Leaderboard',
  '/kedisiplinan/kategori': 'Kategori Disiplin',
  '/kedisiplinan/divisi': 'Divisi',
  '/kedisiplinan/pasal': 'Pasal',
  '/kedisiplinan/tindakan': 'Tindakan',
  '/kedisiplinan/cetak': 'Cetak Laporan Kedisiplinan',
  '/prestasi': 'Dashboard Prestasi',
  '/prestasi/data': 'Data Prestasi',
  '/prestasi/event': 'Event',
  '/prestasi/juara': 'Juara',
  '/prestasi/bidang': 'Bidang',
  '/prestasi/kategori': 'Kategori Prestasi',
  '/prestasi/cetak': 'Cetak Laporan Prestasi',
  '/diknas': 'Dashboard Akademik',
  '/diknas/presensi': 'Presensi',
  '/diknas/nilai-harian': 'Nilai Harian',
  '/diknas/nilai-uas': 'Nilai UAS',
  '/diknas/rekap-nilai': 'Rekap Nilai Rapor',
  '/diknas/bank-soal': 'Bank Soal',
  '/diknas/catatan': 'Catatan Kelakuan',
  '/admin/overview': 'Admin Overview',
  '/admin/users': 'Kelola User',
  '/admin/guru': 'Data Guru',
  '/admin/orangtua': 'Data Orang Tua',
  '/admin/mapel': 'Mata Pelajaran',
  '/admin/kamar': 'Data Kamar',
  '/admin/semester': 'Semester & Tahun Pelajaran',
  '/admin/announcements': 'Pengumuman',
  '/superadmin': 'Super Dashboard',
  '/superadmin/roles': 'Role Management',
  '/superadmin/audit': 'Audit Log',
  '/superadmin/analytics': 'Analytics',
  '/superadmin/settings': 'System Settings',
  '/account': 'Akun Saya',
  '/about': 'Tentang AMANAH',
  '/orangtua': 'Dashboard Orang Tua',
  '/orangtua/mutabaah': 'Mutabaah Anak',
  '/orangtua/diknas': 'Akademik Anak',
  '/orangtua/kedisiplinan': 'Kedisiplinan Anak',
  '/orangtua/prestasi': 'Prestasi Anak',
}


function getPageTitle(pathname: string): string {
  return PATH_TITLES[pathname] ?? 'Halaman'
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, isLoading } = useAuth()
  const { toggleMobile } = useSidebar()

  useEffect(() => {
    if (!isLoading && !profile) {
      router.replace('/login')
    }
  }, [isLoading, profile, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Sidebar />
      {/* flex-1 membuat area konten mengisi sisa ruang otomatis sesuai lebar sidebar */}
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden min-w-0">
        <Header
          title={getPageTitle(pathname)}
          onMobileMenuToggle={toggleMobile}
        />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <main className="flex-1 p-6">{children}</main>
          <footer className="mt-auto border-t border-border bg-[var(--surface)] px-6 py-4 text-center md:text-right">
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              &copy;2026{' '}
              <a
                href={INSPIRALABS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                InspiraLabs
              </a>{' '}
              &middot;{' '}
              <a
                href={CREATOR_WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Unggul Sulaiman, S.Kom
              </a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SidebarProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SidebarProvider>
  )
}
