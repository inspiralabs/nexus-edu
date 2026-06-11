'use client'

import Image from 'next/image'
import {
  Award,
  BarChart2,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  Gavel,
  GitBranch,
  Home,
  Info,
  Key,
  LayoutDashboard,
  List,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Scale,
  Settings,
  Shield,
  Sliders,
  Tag,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import type { Role } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const LOCALSTORAGE_KEY = 'amanah-sidebar-collapsed'

type MinRole = Role

interface MenuItemConfig {
  id: string
  label: string
  href?: string
  icon: LucideIcon
  minRole: MinRole
  /** Jika diisi, menu hanya tampil untuk role-role tertentu. Jika kosong, pakai minRole. */
  allowedRoles?: Role[]
  children?: MenuItemConfig[]
}

const ROLE_LEVEL: Record<Role, number> = {
  user: 0,
  admin: 1,
  superadmin: 2,
  orangtua: -1, // role terpisah, tidak masuk hierarki
}

/** Menu umum (untuk user, admin, superadmin) */
const menuItems: MenuItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    minRole: 'user',
  },
  {
    id: 'students',
    label: 'Data Siswa',
    href: '/students',
    icon: Users,
    minRole: 'user',
  },
  {
    id: 'mutabaah',
    label: 'Kepesantrenan',
    icon: BookOpenCheck,
    minRole: 'user',
    children: [
      {
        id: 'mutabaah-dashboard',
        label: 'Dashboard Mutabaah',
        href: '/mutabaah',
        icon: BarChart2,
        minRole: 'user',
      },
      {
        id: 'mutabaah-input',
        label: 'Input Harian',
        href: '/mutabaah/input',
        icon: ClipboardList,
        minRole: 'user',
      },
      {
        id: 'mutabaah-rekap',
        label: 'Rekap Kegiatan',
        href: '/mutabaah/rekap',
        icon: Award,
        minRole: 'user',
      },
      {
        id: 'mutabaah-target',
        label: 'Target & Nilai',
        href: '/mutabaah/target',
        icon: Target,
        minRole: 'admin',
      },
      {
        id: 'mutabaah-kegiatan',
        label: 'Kegiatan',
        href: '/mutabaah/kegiatan',
        icon: List,
        minRole: 'admin',
      },
      {
        id: 'mutabaah-sub-kegiatan',
        label: 'Sub Kegiatan',
        href: '/mutabaah/sub-kegiatan',
        icon: GitBranch,
        minRole: 'admin',
      },
      {
        id: 'admin-kamar',
        label: 'Data Kamar',
        href: '/admin/kamar',
        icon: Home,
        minRole: 'admin',
      },
      {
        id: 'mutabaah-cetak',
        label: 'Cetak Laporan',
        href: '/mutabaah/cetak',
        icon: Printer,
        minRole: 'user',
      },
    ],
  },
  {
    id: 'kedisiplinan',
    label: 'Kedisiplinan',
    icon: Scale,
    minRole: 'user',
    children: [
      {
        id: 'kedisiplinan-dashboard',
        label: 'Dashboard',
        href: '/kedisiplinan',
        icon: BarChart2,
        minRole: 'user',
      },
      {
        id: 'kedisiplinan-data',
        label: 'Data',
        href: '/kedisiplinan/data',
        icon: List,
        minRole: 'user',
      },
      {
        id: 'kedisiplinan-rekap',
        label: 'Rekap Poin',
        href: '/kedisiplinan/rekap',
        icon: Award,
        minRole: 'user',
      },
      {
        id: 'kedisiplinan-kategori',
        label: 'Kategori',
        href: '/kedisiplinan/kategori',
        icon: Tag,
        minRole: 'admin',
      },
      {
        id: 'kedisiplinan-divisi',
        label: 'Divisi',
        href: '/kedisiplinan/divisi',
        icon: GitBranch,
        minRole: 'admin',
      },
      {
        id: 'kedisiplinan-pasal',
        label: 'Pasal',
        href: '/kedisiplinan/pasal',
        icon: BookOpen,
        minRole: 'admin',
      },
      {
        id: 'kedisiplinan-tindakan',
        label: 'Tindakan',
        href: '/kedisiplinan/tindakan',
        icon: Gavel,
        minRole: 'admin',
      },
      {
        id: 'kedisiplinan-cetak',
        label: 'Cetak Laporan',
        href: '/kedisiplinan/cetak',
        icon: Printer,
        minRole: 'user',
      },
    ],
  },
  {
    id: 'prestasi',
    label: 'Prestasi',
    icon: Trophy,
    minRole: 'user',
    children: [
      {
        id: 'prestasi-dashboard',
        label: 'Dashboard',
        href: '/prestasi',
        icon: BarChart2,
        minRole: 'user',
      },
      {
        id: 'prestasi-data',
        label: 'Data',
        href: '/prestasi/data',
        icon: List,
        minRole: 'user',
      },
      {
        id: 'prestasi-event',
        label: 'Event',
        href: '/prestasi/event',
        icon: Tag,
        minRole: 'admin',
      },
      {
        id: 'prestasi-juara',
        label: 'Juara',
        href: '/prestasi/juara',
        icon: Trophy,
        minRole: 'admin',
      },
      {
        id: 'prestasi-bidang',
        label: 'Bidang',
        href: '/prestasi/bidang',
        icon: GitBranch,
        minRole: 'admin',
      },
      {
        id: 'prestasi-kategori',
        label: 'Kategori',
        href: '/prestasi/kategori',
        icon: Tag,
        minRole: 'admin',
      },
      {
        id: 'prestasi-cetak',
        label: 'Cetak Laporan',
        href: '/prestasi/cetak',
        icon: Printer,
        minRole: 'user',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Shield,
    minRole: 'admin',
    children: [
      {
        id: 'admin-overview',
        label: 'Overview',
        href: '/admin/overview',
        icon: Eye,
        minRole: 'admin',
      },
      {
        id: 'admin-users',
        label: 'Kelola User',
        href: '/admin/users',
        icon: UserCog,
        minRole: 'admin',
      },
      {
        id: 'admin-guru',
        label: 'Data Guru',
        href: '/admin/guru',
        icon: UserCheck,
        minRole: 'admin',
      },
      {
        id: 'admin-orangtua',
        label: 'Data Orang Tua',
        href: '/admin/orangtua',
        icon: Users,
        minRole: 'admin',
      },
      {
        id: 'admin-mapel',
        label: 'Mata Pelajaran',
        href: '/admin/mapel',
        icon: BookMarked,
        minRole: 'admin',
      },
      {
        id: 'admin-semester',
        label: 'Semester & TP',
        href: '/admin/semester',
        icon: CalendarDays,
        minRole: 'admin',
      },
      {
        id: 'admin-announcements',
        label: 'Pengumuman',
        href: '/admin/announcements',
        icon: Megaphone,
        minRole: 'admin',
      },
    ],
  },
  {
    id: 'superadmin',
    label: 'Superadmin',
    icon: Settings,
    minRole: 'superadmin',
    children: [
      {
        id: 'superadmin-dashboard',
        label: 'Dashboard',
        href: '/superadmin',
        icon: BarChart2,
        minRole: 'superadmin',
      },
      {
        id: 'superadmin-roles',
        label: 'Role Management',
        href: '/superadmin/roles',
        icon: Key,
        minRole: 'superadmin',
      },
      {
        id: 'superadmin-audit',
        label: 'Audit Log',
        href: '/superadmin/audit',
        icon: FileText,
        minRole: 'superadmin',
      },
      {
        id: 'superadmin-analytics',
        label: 'Analytics',
        href: '/superadmin/analytics',
        icon: TrendingUp,
        minRole: 'superadmin',
      },
      {
        id: 'superadmin-settings',
        label: 'System Settings',
        href: '/superadmin/settings',
        icon: Sliders,
        minRole: 'superadmin',
      },
    ],
  },
]

/** Menu khusus role 'orangtua' */
const menuItemsOrangtua: MenuItemConfig[] = [
  {
    id: 'orangtua-dashboard',
    label: 'Dashboard',
    href: '/orangtua',
    icon: Home,
    minRole: 'orangtua',
    allowedRoles: ['orangtua'],
  },
  {
    id: 'orangtua-anak',
    label: 'Perkembangan Anak',
    icon: Users,
    minRole: 'orangtua',
    allowedRoles: ['orangtua'],
    children: [
      {
        id: 'orangtua-mutabaah',
        label: 'Mutabaah',
        href: '/orangtua/mutabaah',
        icon: BookOpen,
        minRole: 'orangtua',
        allowedRoles: ['orangtua'],
      },
      {
        id: 'orangtua-diknas',
        label: 'Akademik',
        href: '/orangtua/diknas',
        icon: FileText,
        minRole: 'orangtua',
        allowedRoles: ['orangtua'],
      },
      {
        id: 'orangtua-kedisiplinan',
        label: 'Kedisiplinan',
        href: '/orangtua/kedisiplinan',
        icon: Scale,
        minRole: 'orangtua',
        allowedRoles: ['orangtua'],
      },
      {
        id: 'orangtua-prestasi',
        label: 'Prestasi',
        href: '/orangtua/prestasi',
        icon: Trophy,
        minRole: 'orangtua',
        allowedRoles: ['orangtua'],
      },
    ],
  },
]

const EXACT_MATCH_HREFS = new Set([
  '/dashboard',
  '/mutabaah',
  '/kedisiplinan',
  '/prestasi',
  '/superadmin',
  '/orangtua',
])

interface SidebarContextValue {
  isMobileOpen: boolean
  toggleMobile: () => void
  closeMobile: () => void
  isCollapsed: boolean
  toggleCollapsed: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar harus digunakan di dalam SidebarProvider')
  }
  return context
}

function hasRoleAccess(userRole: Role | undefined, minRole: MinRole): boolean {
  if (!userRole) return false
  // Orangtua tidak masuk hierarki user/admin/superadmin
  if (userRole === 'orangtua') return minRole === 'orangtua'
  if (minRole === 'orangtua') return false
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole]
}

function isPathActive(pathname: string, href: string): boolean {
  if (EXACT_MATCH_HREFS.has(href)) {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function filterMenuByRole(
  items: MenuItemConfig[],
  userRole: Role | undefined
): MenuItemConfig[] {
  return items
    .filter((item) => {
      if (item.allowedRoles) {
        return userRole ? item.allowedRoles.includes(userRole) : false
      }
      return hasRoleAccess(userRole, item.minRole)
    })
    .map((item) => ({
      ...item,
      children: item.children
        ? filterMenuByRole(item.children, userRole)
        : undefined,
    }))
}

function getRoleBadgeLabel(role: Role, guruMapel?: string | null): string {
  switch (role) {
    case 'superadmin':
      return 'Superadmin'
    case 'admin':
      return 'Admin'
    case 'orangtua':
      return 'Orang Tua'
    default:
      return guruMapel?.trim() || 'Guru / Musyrif'
  }
}

function getRoleBadgeVariant(
  role: Role
): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'superadmin':
      return 'secondary'
    case 'admin':
      return 'default'
    default:
      return 'outline'
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface SubmenuProps {
  item: MenuItemConfig
  pathname: string
  isOpen: boolean
  onToggle: () => void
  onNavigate: () => void
  isCollapsed: boolean
}

function Submenu({ item, pathname, isOpen, onToggle, onNavigate, isCollapsed }: SubmenuProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [heightStyle, setHeightStyle] = useState<string | number>(isOpen ? 'none' : '0px')
  const isInitial = useRef(true)

  const isChildActive = item.children?.some(
    (child) => child.href && isPathActive(pathname, child.href)
  )
  const isParentActive = isChildActive ?? false

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false
      return
    }

    if (isOpen) {
      if (contentRef.current) {
        const height = contentRef.current.scrollHeight
        setHeightStyle(`${height}px`)
        const timer = setTimeout(() => {
          setHeightStyle('none')
        }, 300)
        return () => clearTimeout(timer)
      }
    } else {
      if (contentRef.current) {
        const height = contentRef.current.scrollHeight
        setHeightStyle(`${height}px`)
        const raf = requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHeightStyle('0px')
          })
        })
        return () => cancelAnimationFrame(raf)
      } else {
        setHeightStyle('0px')
      }
    }
  }, [isOpen])

  const Icon = item.icon

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        title={isCollapsed ? item.label : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
          isParentActive && 'bg-primary-light font-medium text-primary'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span
          className={cn(
            'flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-200',
            isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
          )}
        >
          {item.label}
        </span>
        {!isCollapsed && (
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform duration-300',
              isOpen && 'rotate-180'
            )}
          />
        )}
      </button>

      {!isCollapsed && (
        <div
          className={cn(
            'transition-[max-height] duration-300 ease-in-out',
            heightStyle === 'none' ? '' : 'overflow-hidden'
          )}
          style={{ maxHeight: heightStyle }}
        >
          <div ref={contentRef} className="space-y-0.5 py-1">
            {item.children?.map((child) => {
              if (!child.href) return null
              const ChildIcon = child.icon
              const isActive = isPathActive(pathname, child.href)

              return (
                <Link
                  key={child.id}
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-md py-2 pl-9 pr-3 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
                    isActive &&
                    'bg-primary-light font-medium text-primary'
                  )}
                >
                  <ChildIcon className="h-4 w-4 shrink-0" />
                  <span>{child.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Baca preferensi dari localStorage saat mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALSTORAGE_KEY)
      if (saved !== null) {
        setIsCollapsed(saved === 'true')
      }
    } catch {
      // localStorage mungkin tidak tersedia (SSR / private mode)
    }
  }, [])

  const toggleMobile = useCallback(() => {
    setIsMobileOpen((prev) => !prev)
  }, [])

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(LOCALSTORAGE_KEY, String(next))
      } catch {
        // localStorage mungkin tidak tersedia
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      isMobileOpen,
      toggleMobile,
      closeMobile,
      isCollapsed,
      toggleCollapsed,
    }),
    [isMobileOpen, toggleMobile, closeMobile, isCollapsed, toggleCollapsed]
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}

function Sidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()
  const { isMobileOpen, closeMobile, isCollapsed, toggleCollapsed } = useSidebar()
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set())

  const isOrangtua = profile?.role === 'orangtua'
  const activeMenuItems = isOrangtua ? menuItemsOrangtua : menuItems

  const visibleMenuItems = useMemo(
    () => filterMenuByRole(activeMenuItems, profile?.role),
    [profile?.role, activeMenuItems]
  )

  useEffect(() => {
    const activeParents = new Set<string>()

    visibleMenuItems.forEach((item) => {
      if (
        item.children?.some(
          (child) => child.href && isPathActive(pathname, child.href)
        )
      ) {
        activeParents.add(item.id)
      }
    })

    setOpenMenus((prev) => new Set([...prev, ...activeParents]))
  }, [pathname, visibleMenuItems])

  const toggleSubmenu = (menuId: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev)
      if (next.has(menuId)) {
        next.delete(menuId)
      } else {
        next.add(menuId)
      }
      return next
    })
  }

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobile}
          aria-label="Tutup sidebar"
        />
      )}

      <aside
        data-sidebar="true"
        className={cn(
          'sidebar-container no-print fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200 ease-in-out md:sticky md:top-0 md:translate-x-0',
          isCollapsed ? 'w-14' : 'w-60',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header sidebar */}
        <div className={cn('flex items-center border-b border-[var(--border)] px-3 py-4', isCollapsed ? 'justify-center' : 'justify-between')}>
          {!isCollapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <Image
                src="/SQA.png"
                alt="Logo AMANAH"
                width={100}
                height={32}
                className="h-7 w-auto object-contain"
                priority
              />
              <span className="block text-[11px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Platform
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="h-8 w-8 shrink-0"
            aria-label={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            title={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pt-4 pb-16">
          {visibleMenuItems.map((item) => {
            if (item.children && item.children.length > 0) {
              return (
                <Submenu
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  isOpen={openMenus.has(item.id)}
                  onToggle={() => toggleSubmenu(item.id)}
                  onNavigate={closeMobile}
                  isCollapsed={isCollapsed}
                />
              )
            }

            if (!item.href) return null

            const Icon = item.icon
            const isActive = isPathActive(pathname, item.href)

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={closeMobile}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
                  isActive && 'bg-primary-light font-medium text-primary'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span
                  className={cn(
                    'whitespace-nowrap overflow-hidden transition-all duration-200',
                    isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {profile && (
          <div className={cn('border-t border-[var(--border)] px-3 py-4', isCollapsed && 'flex justify-center')}>
            {isCollapsed ? (
              <Avatar className="h-8 w-8" title={profile.nama_lengkap}>
                {profile.avatar_url && (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.nama_lengkap}
                  />
                )}
                <AvatarFallback>
                  {getInitials(profile.nama_lengkap)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  {profile.avatar_url && (
                    <AvatarImage
                      src={profile.avatar_url}
                      alt={profile.nama_lengkap}
                    />
                  )}
                  <AvatarFallback>
                    {getInitials(profile.nama_lengkap)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {profile.nama_lengkap}
                  </p>
                  <Badge
                    variant={getRoleBadgeVariant(profile.role)}
                    className="mt-1"
                  >
                    {getRoleBadgeLabel(profile.role, profile.guru_mapel)}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  )
}

export { Sidebar, SidebarProvider, useSidebar }
