'use client'

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/empty-state'

interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[]
  data: T[]
  pagination: { page: number; pageSize: number; total: number }
  pageSizeOptions: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onSortChange: (field: string, direction: 'asc' | 'desc') => void
  selectedRows?: string[]
  onSelectRows?: (ids: string[]) => void
  isLoading?: boolean
}

const SKELETON_ROW_COUNT = 5

function DataTable<T extends { id: string }>({
  columns,
  data,
  pagination,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  selectedRows,
  onSelectRows,
  isLoading = false,
}: DataTableProps<T>) {
  const [sortField, setSortField] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc')

  const selectColumn = React.useMemo<ColumnDef<T> | null>(() => {
    if (!onSelectRows) return null

    return {
      id: 'select',
      header: () => {
        const pageIds = data.map((row) => row.id)
        const allSelected =
          pageIds.length > 0 &&
          pageIds.every((id) => selectedRows?.includes(id))
        const someSelected = pageIds.some((id) => selectedRows?.includes(id))

        return (
          <Checkbox
            checked={
              allSelected ? true : someSelected ? 'indeterminate' : false
            }
            onCheckedChange={(checked) => {
              if (checked) {
                onSelectRows([
                  ...new Set([...(selectedRows ?? []), ...pageIds]),
                ])
              } else {
                onSelectRows(
                  (selectedRows ?? []).filter((id) => !pageIds.includes(id))
                )
              }
            }}
            aria-label="Pilih semua"
          />
        )
      },
      cell: ({ row }) => (
        <Checkbox
          checked={selectedRows?.includes(row.original.id)}
          onCheckedChange={(checked) => {
            const id = row.original.id
            if (checked) {
              onSelectRows([...(selectedRows ?? []), id])
            } else {
              onSelectRows((selectedRows ?? []).filter((rowId) => rowId !== id))
            }
          }}
          aria-label="Pilih baris"
        />
      ),
      enableSorting: false,
    }
  }, [data, onSelectRows, selectedRows])

  const tableColumns = React.useMemo(() => {
    if (selectColumn) {
      return [selectColumn, ...columns]
    }
    return columns
  }, [columns, selectColumn])

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(pagination.total / pagination.pageSize),
  })

  const columnCount = tableColumns.length
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
  const startItem =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const endItem = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total
  )

  const handleSort = (field: string) => {
    const newDirection: 'asc' | 'desc' =
      sortField === field && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortField(field)
    setSortDirection(newDirection)
    onSortChange(field, newDirection)
  }

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-[var(--text-tertiary)]" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 text-primary" />
    }
    return <ArrowDown className="h-4 w-4 text-primary" />
  }

  const isColumnSortable = (columnId: string) => {
    if (columnId === 'select') return false
    const column = table.getColumn(columnId)
    return column?.columnDef.enableSorting !== false
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id
                  const sortable = isColumnSortable(columnId)

                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-[var(--text-primary)]"
                          onClick={() => handleSort(columnId)}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {renderSortIcon(columnId)}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {Array.from({ length: columnCount }).map((__, cellIndex) => (
                    <TableCell key={`skeleton-cell-${cellIndex}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-48">
                  <EmptyState
                    title="Tidak ada data"
                    description="Belum ada data yang ditampilkan."
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={
                    selectedRows?.includes(row.original.id)
                      ? 'selected'
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          Menampilkan {startItem}-{endItem} dari {pagination.total} data
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Ukuran" />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || isLoading}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= totalPages || isLoading}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export { DataTable }
export type { DataTableProps }
