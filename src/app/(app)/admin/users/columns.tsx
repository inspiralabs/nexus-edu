'use client'

import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { Edit2, ShieldAlert, Trash2, UserCheck, UserMinus, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ManageableRole } from '@/lib/queries/users'
import type { Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

export interface AdminUsersColumnsOptions {
  page: number
  pageSize: number
  onRequestApprovalChange: (profile: Profile) => void
  onRequestRoleChange: (profile: Profile, newRole: ManageableRole) => void
  onEdit: (profile: Profile) => void
  onRequestDelete: (profile: Profile) => void
  isActionPending: boolean
}

function formatTanggal(value: string): string {
  try {
    return format(parseISO(value), 'dd/MM/yyyy')
  } catch {
    return format(new Date(value), 'dd/MM/yyyy')
  }
}

function getRoleBadgeVariant(
  role: string
): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'admin':
      return 'secondary'
    case 'user':
      return 'default'
    default:
      return 'outline'
  }
}

export function createAdminUsersColumns(
  options: AdminUsersColumnsOptions
): ColumnDef<Profile>[] {
  const rowOffset = (options.page - 1) * options.pageSize

  return [
    {
      id: 'no',
      header: 'No',
      enableSorting: false,
      cell: ({ row }) => rowOffset + row.index + 1,
    },
    {
      accessorKey: 'nama_lengkap',
      header: 'Nama',
      enableSorting: false,
    },
    {
      accessorKey: 'username',
      header: 'Username',
      enableSorting: false,
      cell: ({ row }) => `@${row.original.username}`,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      enableSorting: false,
      cell: ({ row }) => row.original.email ?? '-',
    },
    {
      accessorKey: 'guru_mapel',
      header: 'Guru Mapel',
      enableSorting: false,
      cell: ({ row }) => row.original.guru_mapel ?? '-',
    },
    {
      accessorKey: 'role',
      header: 'Role',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={getRoleBadgeVariant(row.original.role ?? '')}>
          {row.original.role || 'Belum Ada Role'}
        </Badge>
      ),
    },
    {
      accessorKey: 'is_approved',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => {
        const isApproved = row.original.is_approved === true
        return (
          <Badge variant={isApproved ? 'success' : 'warning'}>
            {isApproved ? 'Aktif' : 'Pending'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Tgl Daftar',
      enableSorting: false,
      cell: ({ row }) => formatTanggal(row.original.created_at),
    },
    {
      id: 'actions',
      header: 'Aksi',
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original

        return (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={
                    item.is_approved
                      ? 'Cabut persetujuan'
                      : 'Setujui dan aktifkan pengguna'
                  }
                  disabled={options.isActionPending}
                  onClick={() => options.onRequestApprovalChange(item)}
                >
                  {item.is_approved ? (
                    <UserX className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {item.is_approved
                  ? 'Cabut Persetujuan/Nonaktifkan Pengguna'
                  : 'Setujui/Aktifkan Pengguna'}
              </TooltipContent>
            </Tooltip>

            {item.role === 'user' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'text-indigo-600 hover:bg-indigo-500/10 hover:text-indigo-600',
                      'dark:text-indigo-400 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300'
                    )}
                    aria-label="Jadikan Admin"
                    disabled={options.isActionPending}
                    onClick={() =>
                      options.onRequestRoleChange(item, 'admin')
                    }
                  >
                    <ShieldAlert className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Jadikan Admin</TooltipContent>
              </Tooltip>
            )}

            {item.role === 'admin' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'text-amber-600 hover:bg-amber-500/10 hover:text-amber-600',
                      'dark:text-amber-400 dark:hover:bg-amber-500/15 dark:hover:text-amber-300'
                    )}
                    aria-label="Kembalikan Jadi User"
                    disabled={options.isActionPending}
                    onClick={() =>
                      options.onRequestRoleChange(item, 'user')
                    }
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Kembalikan Jadi User</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600',
                    'dark:text-emerald-400 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-300'
                  )}
                  aria-label="Edit Data Pengguna"
                  disabled={options.isActionPending}
                  onClick={() => options.onEdit(item)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit Data Pengguna</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Hapus user"
                  disabled={options.isActionPending}
                  onClick={() => options.onRequestDelete(item)}
                >
                  <Trash2 className="h-4 w-4 text-status-red" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Hapus User</TooltipContent>
            </Tooltip>
          </div>
        )
      },
    },
  ]
}
