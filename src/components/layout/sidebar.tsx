'use client'

import Image from 'next/image'
import {
  Award,
  BarChart2,
  BookOpen,
  ChevronDown,
  Eye,
  FileText,
  Gavel,
  GitBranch,
  Key,
  LayoutDashboard,
  List,
  Megaphone,
  Printer,
  Scale,
  Settings,
  Shield,
  Sliders,
  Tag,
  TrendingUp,
  Trophy,
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
import { useAuth } from '@/hooks/use-auth'
import type { Role } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

type MinRole = Role

interface MenuItemConfig {
  id: string
  label: string
  href?: string
  icon: LucideIcon
  minRole: MinRole
  children?: MenuItemConfig[]
}

const ROLE_LEVEL: Record<Role, number> = {
  user: 0,
  admin: 1,
  superadmin: 2,
}

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
        minRole: 'user',
      },
      {
        id: 'kedisiplinan-divisi',
        label: 'Divisi',
        href: '/kedisiplinan/divisi',
        icon: GitBranch,
        minRole: 'user',
      },
      {
        id: 'kedisiplinan-pasal',
        label: 'Pasal',
        href: '/kedisiplinan/pasal',
        icon: BookOpen,
        minRole: 'user',
      },
      {
        id: 'kedisiplinan-tindakan',
        label: 'Tindakan',
        href: '/kedisiplinan/tindakan',
        icon: Gavel,
        minRole: 'user',
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
        minRole: 'user',
      },
      {
        id: 'prestasi-juara',
        label: 'Juara',
        href: '/prestasi/juara',
        icon: Trophy,
        minRole: 'user',
      },
      {
        id: 'prestasi-bidang',
        label: 'Bidang',
        href: '/prestasi/bidang',
        icon: GitBranch,
        minRole: 'user',
      },
      {
        id: 'prestasi-kategori',
        label: 'Kategori',
        href: '/prestasi/kategori',
        icon: Tag,
        minRole: 'user',
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

const EXACT_MATCH_HREFS = new Set([
  '/dashboard',
  '/kedisiplinan',
  '/prestasi',
  '/superadmin',
])

interface SidebarContextValue {
  isMobileOpen: boolean
  toggleMobile: () => void
  closeMobile: () => void
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
    .filter((item) => hasRoleAccess(userRole, item.minRole))
    .map((item) => ({
      ...item,
      children: item.children
        ? filterMenuByRole(item.children, userRole)
        : undefined,
    }))
}

function getRoleBadgeLabel(role: Role): string {
  switch (role) {
    case 'superadmin':
      return 'Superadmin'
    case 'admin':
      return 'Admin'
    default:
      return 'User'
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
}

function Submenu({ item, pathname, isOpen, onToggle, onNavigate }: SubmenuProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState(0)

  const isChildActive = item.children?.some(
    (child) => child.href && isPathActive(pathname, child.href)
  )
  const isParentActive = isChildActive ?? false

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [isOpen, item.children])

  const Icon = item.icon

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
          isParentActive && 'bg-primary-light font-medium text-primary'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? `${contentHeight}px` : '0px' }}
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
    </div>
  )
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const toggleMobile = useCallback(() => {
    setIsMobileOpen((prev) => !prev)
  }, [])

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      isMobileOpen,
      toggleMobile,
      closeMobile,
    }),
    [isMobileOpen, toggleMobile, closeMobile]
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}

function Sidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()
  const { isMobileOpen, closeMobile } = useSidebar()
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set())

  const visibleMenuItems = useMemo(
    () => filterMenuByRole(menuItems, profile?.role),
    [profile?.role]
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
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-300 md:sticky md:top-0 md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="border-b border-[var(--border)] px-4 py-5">
          <Image
            src="/SQA.png"
            alt="Logo SQA"
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
            priority
          />
          <span className="block pr-[110px] text-[12px] font-medium uppercase tracking-widest text-slate-500 text-center dark:text-slate-400">
            Platform
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]',
                  isActive && 'bg-primary-light font-medium text-primary'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {profile && (
          <div className="border-t border-[var(--border)] px-4 py-4">
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
                  {getRoleBadgeLabel(profile.role)}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

export { Sidebar, SidebarProvider, useSidebar }
