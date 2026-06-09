'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import { Download, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable } from '@/components/shared/data-table'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { getAllProfiles } from '@/lib/queries/admin'
import { createClient } from '@/lib/supabase/client'
import type {
  AuditAction,
  AuditLog,
  Profile,
} from '@/lib/supabase/types'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const

const AUDIT_ACTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE_USER',
  'CHANGE_ROLE',
  'LOGIN',
  'LOGOUT',
]

const AUDIT_TABLE_WHITELIST = [
  'profiles',
  'students',
  'kedisiplinan',
  'prestasi',
  'kategori_disiplin',
  'divisi',
  'pasal',
  'tindakan',
  'kategori_prestasi',
  'event',
  'juara',
  'bidang',
  'announcements',
  'audit_log',
] as const

type AuditTableRow = AuditLog & { id: string }

type Relation<T> = T | T[] | null | undefined

interface AuditLogProfileRelation {
  nama_lengkap: string
  username: string
}

interface AuditLogRow {
  id: string
  user_id: string | null
  action: AuditLog['action']
  table_name: string | null
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  profiles: Relation<AuditLogProfileRelation>
}

interface FetchAuditLogParams {
  userId?: string
  action?: string
  tableName?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

interface JsonViewTarget {
  title: string
  data: Record<string, unknown> | null
}

function unwrapRelation<T>(relation: Relation<T>): T | null {
  if (!relation) return null
  if (Array.isArray(relation)) return relation[0] ?? null
  return relation
}

function normalizeAuditLogRow(row: AuditLogRow): AuditLog {
  const profile = unwrapRelation(row.profiles)

  return {
    id: row.id,
    user_id: row.user_id,
    action: row.action,
    table_name: row.table_name,
    record_id: row.record_id,
    old_data: row.old_data,
    new_data: row.new_data,
    created_at: row.created_at,
    profiles: profile
      ? ({
          nama_lengkap: profile.nama_lengkap,
          username: profile.username,
        } as Profile)
      : undefined,
  }
}

function getAuditUserName(entry: AuditLog): string {
  const profile = entry.profiles
  if (!profile) return '-'
  if (Array.isArray(profile)) {
    return profile[0]?.nama_lengkap ?? '-'
  }
  return profile.nama_lengkap ?? '-'
}

function getActionBadgeVariant(
  action: AuditAction | null
): 'success' | 'default' | 'destructive' | 'secondary' | 'warning' | 'outline' {
  switch (action) {
    case 'CREATE':
      return 'success'
    case 'UPDATE':
      return 'default'
    case 'DELETE':
      return 'destructive'
    case 'APPROVE_USER':
      return 'secondary'
    case 'CHANGE_ROLE':
      return 'warning'
    default:
      return 'outline'
  }
}

function formatTanggal(value: string): string {
  try {
    return format(parseISO(value), 'dd/MM/yyyy HH:mm')
  } catch {
    return format(new Date(value), 'dd/MM/yyyy HH:mm')
  }
}

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

async function fetchAuditLogPage(
  params: FetchAuditLogParams
): Promise<{ data: AuditLog[]; total: number }> {
  const supabase = createClient()
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let countQuery = supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })

  let dataQuery = supabase
    .from('audit_log')
    .select('*, profiles(nama_lengkap, username)')

  if (params.userId) {
    countQuery = countQuery.eq('user_id', params.userId)
    dataQuery = dataQuery.eq('user_id', params.userId)
  }

  if (params.action) {
    countQuery = countQuery.eq('action', params.action)
    dataQuery = dataQuery.eq('action', params.action)
  }

  if (params.tableName) {
    countQuery = countQuery.eq('table_name', params.tableName)
    dataQuery = dataQuery.eq('table_name', params.tableName)
  }

  if (params.dateFrom) {
    const fromIso = `${params.dateFrom}T00:00:00.000Z`
    countQuery = countQuery.gte('created_at', fromIso)
    dataQuery = dataQuery.gte('created_at', fromIso)
  }

  if (params.dateTo) {
    const toIso = `${params.dateTo}T23:59:59.999Z`
    countQuery = countQuery.lte('created_at', toIso)
    dataQuery = dataQuery.lte('created_at', toIso)
  }

  const { count, error: countError } = await countQuery
  if (countError) throw new Error(countError.message)

  const { data, error } = await dataQuery
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  return {
    data: ((data ?? []) as AuditLogRow[]).map(normalizeAuditLogRow),
    total: count ?? 0,
  }
}

async function fetchAllAuditLogForExport(
  params: Omit<FetchAuditLogParams, 'page' | 'pageSize'>
): Promise<AuditLog[]> {
  const supabase = createClient()

  let dataQuery = supabase
    .from('audit_log')
    .select('*, profiles(nama_lengkap, username)')

  if (params.userId) {
    dataQuery = dataQuery.eq('user_id', params.userId)
  }

  if (params.action) {
    dataQuery = dataQuery.eq('action', params.action)
  }

  if (params.tableName) {
    dataQuery = dataQuery.eq('table_name', params.tableName)
  }

  if (params.dateFrom) {
    dataQuery = dataQuery.gte('created_at', `${params.dateFrom}T00:00:00.000Z`)
  }

  if (params.dateTo) {
    dataQuery = dataQuery.lte('created_at', `${params.dateTo}T23:59:59.999Z`)
  }

  const { data, error } = await dataQuery.order('created_at', {
    ascending: false,
  })

  if (error) throw new Error(error.message)

  return ((data ?? []) as AuditLogRow[]).map(normalizeAuditLogRow)
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function SuperadminAuditPage() {
  const router = useRouter()
  const { isSuperadmin, isLoading: authLoading } = useAuth()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [userFilter, setUserFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [tableFilter, setTableFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [jsonViewTarget, setJsonViewTarget] = useState<JsonViewTarget | null>(
    null
  )

  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      router.replace('/dashboard')
    }
  }, [authLoading, isSuperadmin, router])

  useEffect(() => {
    setPage(1)
  }, [userFilter, actionFilter, tableFilter, dateFrom, dateTo])

  const queryFilters = useMemo(
    () => ({
      userId: userFilter === 'all' ? undefined : userFilter,
      action: actionFilter === 'all' ? undefined : actionFilter,
      tableName: tableFilter === 'all' ? undefined : tableFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize,
    }),
    [userFilter, actionFilter, tableFilter, dateFrom, dateTo, page, pageSize]
  )

  const exportFilters = useMemo(
    () => ({
      userId: userFilter === 'all' ? undefined : userFilter,
      action: actionFilter === 'all' ? undefined : actionFilter,
      tableName: tableFilter === 'all' ? undefined : tableFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [userFilter, actionFilter, tableFilter, dateFrom, dateTo]
  )

  const { data: profilesResult } = useQuery({
    queryKey: ['superadmin-audit-profiles'],
    queryFn: () => getAllProfiles({ pageSize: 500 }),
    enabled: isSuperadmin,
  })

  const { data: auditResult, isLoading } = useQuery({
    queryKey: ['superadmin-audit-log', queryFilters],
    queryFn: () => fetchAuditLogPage(queryFilters),
    enabled: isSuperadmin,
  })

  const exportMutation = useMutation({
    mutationFn: () => fetchAllAuditLogForExport(exportFilters),
    onSuccess: (rows) => {
      const headers = [
        'ID',
        'Tanggal',
        'User',
        'Action',
        'Tabel',
        'Record ID',
      ]
      const csvRows = rows.map((row) =>
        [
          escapeCsvValue(row.id),
          escapeCsvValue(formatTanggal(row.created_at)),
          escapeCsvValue(getAuditUserName(row)),
          escapeCsvValue(row.action ?? ''),
          escapeCsvValue(row.table_name ?? ''),
          escapeCsvValue(row.record_id ?? ''),
        ].join(',')
      )
      const csv = [headers.join(','), ...csvRows].join('\n')
      downloadCsv(`audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv)
      toast({
        title: 'Berhasil',
        description: `${rows.length} baris audit log diekspor`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Gagal',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const tableData = useMemo<AuditTableRow[]>(
    () =>
      (auditResult?.data ?? []).map((row) => ({
        ...row,
        id: row.id,
      })),
    [auditResult?.data]
  )

  const columns = useMemo<ColumnDef<AuditTableRow>[]>(() => {
    const rowOffset = (page - 1) * pageSize

    return [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => rowOffset + row.index + 1,
      },
      {
        accessorKey: 'created_at',
        header: 'Tanggal',
        enableSorting: false,
        cell: ({ row }) => formatTanggal(row.original.created_at),
      },
      {
        id: 'user',
        header: 'User',
        enableSorting: false,
        cell: ({ row }) => getAuditUserName(row.original),
      },
      {
        accessorKey: 'action',
        header: 'Action',
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={getActionBadgeVariant(row.original.action)}>
            {row.original.action ?? '-'}
          </Badge>
        ),
      },
      {
        accessorKey: 'table_name',
        header: 'Tabel',
        enableSorting: false,
        cell: ({ row }) => row.original.table_name ?? '-',
      },
      {
        accessorKey: 'record_id',
        header: 'Record ID',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.record_id ?? '-'}
          </span>
        ),
      },
      {
        id: 'old_data',
        header: 'Old Data',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.old_data ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setJsonViewTarget({
                  title: 'Old Data',
                  data: row.original.old_data,
                })
              }
            >
              <Eye className="mr-1 h-3 w-3" />
              Lihat
            </Button>
          ) : (
            '-'
          ),
      },
      {
        id: 'new_data',
        header: 'New Data',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.new_data ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setJsonViewTarget({
                  title: 'New Data',
                  data: row.original.new_data,
                })
              }
            >
              <Eye className="mr-1 h-3 w-3" />
              Lihat
            </Button>
          ) : (
            '-'
          ),
      },
    ]
  }, [page, pageSize])

  const handleSortChange = useCallback(() => {
    // Default sort handled server-side
  }, [])

  if (authLoading || !isSuperadmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="audit-user-filter">User</Label>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger id="audit-user-filter" className="w-full lg:w-[200px]">
              <SelectValue placeholder="Semua User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua User</SelectItem>
              {(profilesResult?.data ?? [])
                .filter((item) => item.user_id)
                .map((item) => (
                  <SelectItem key={item.id} value={item.user_id!}>
                    {item.nama_lengkap}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audit-action-filter">Action</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger
              id="audit-action-filter"
              className="w-full lg:w-[180px]"
            >
              <SelectValue placeholder="Semua Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Action</SelectItem>
              {AUDIT_ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audit-table-filter">Tabel</Label>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger
              id="audit-table-filter"
              className="w-full lg:w-[180px]"
            >
              <SelectValue placeholder="Semua Tabel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tabel</SelectItem>
              {AUDIT_TABLE_WHITELIST.map((table) => (
                <SelectItem key={table} value={table}>
                  {table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audit-date-from">Tanggal Dari</Label>
          <Input
            id="audit-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full lg:w-[180px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="audit-date-to">Tanggal Sampai</Label>
          <Input
            id="audit-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full lg:w-[180px]"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="no-print"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={tableData}
        pagination={{
          page,
          pageSize,
          total: auditResult?.total ?? 0,
        }}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onSortChange={handleSortChange}
        isLoading={isLoading}
      />

      <Dialog
        open={jsonViewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setJsonViewTarget(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{jsonViewTarget?.title ?? 'Data JSON'}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-96 overflow-auto rounded-md bg-surface-2 p-3 text-xs text-text-primary">
            {JSON.stringify(jsonViewTarget?.data ?? {}, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
