'use client'

import { LogOut, Menu, Moon, Sun, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/components/providers/theme-provider'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  title: string
  onMobileMenuToggle: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Header({ title, onMobileMenuToggle }: HeaderProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { theme, setTheme } = useTheme()
  const { profile } = useAuth()

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [router, supabase])

  return (
    <header
      data-header="true"
      className="app-header no-print sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMobileMenuToggle}
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h1>

      <div className="flex-1" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle tema"
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>

      {profile && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Menu profil"
            >
              <Avatar className="h-8 w-8">
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
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {profile.nama_lengkap}
              </p>
              {profile.email && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {profile.email}
                </p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/account')}>
              <User className="h-4 w-4" />
              Akun Saya
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="text-status-red"
              onClick={() => void handleLogout()}
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}

export { Header }
