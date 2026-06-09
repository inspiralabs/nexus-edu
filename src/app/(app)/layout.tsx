'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Sidebar, SidebarProvider, useSidebar } from '@/components/layout/sidebar'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { useAuth } from '@/hooks/use-auth'

const PATH_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/students': 'Data Siswa',
  '/kedisiplinan': 'Dashboard Kedisiplinan',
  '/kedisiplinan/data': 'Data Kedisiplinan',
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
  '/admin/overview': 'Admin Overview',
  '/admin/users': 'Kelola User',
  '/admin/announcements': 'Pengumuman',
  '/superadmin': 'Super Dashboard',
  '/superadmin/roles': 'Role Management',
  '/superadmin/audit': 'Audit Log',
  '/superadmin/analytics': 'Analytics',
  '/superadmin/settings': 'System Settings',
  '/account': 'Akun Saya',
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
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <Header
          title={getPageTitle(pathname)}
          onMobileMenuToggle={toggleMobile}
        />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <main className="flex-1 p-6">{children}</main>
          <footer className="mt-auto border-t border-border bg-background/50 px-6 py-4 text-center md:text-right">
            <p className="text-xs font-medium text-slate-500">
              &copy;2026 InspiraLabs &middot; Unggul Sulaiman, S.Kom
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
