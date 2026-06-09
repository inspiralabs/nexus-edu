'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ChangeEvent, useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import {
  exportTableAsCSV,
  getSystemConfig,
  saveSystemConfig,
} from '@/lib/queries/superadmin'
import { createClient } from '@/lib/supabase/client'

const EXPORTABLE_TABLES = [
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
] as const

const DEFAULT_CONFIG = `{
  "appName": "SQA Platform",
  "tagline": "School Quality Assurance",
  "footerText": "© Nawa Inspira Digital"
}`

const CLEAR_DATA_TABLES = ['kedisiplinan', 'prestasi', 'students'] as const

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export default function SuperadminSettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isSuperadmin, isLoading: authLoading } = useAuth()

  const [configContent, setConfigContent] = useState(DEFAULT_CONFIG)
  const [selectedTable, setSelectedTable] = useState<string>(
    EXPORTABLE_TABLES[0]
  )
  const [isDangerOpen, setIsDangerOpen] = useState(false)
  const [dangerConfirmText, setDangerConfirmText] = useState('')

  const isDevelopment = process.env.NODE_ENV === 'development'

  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      router.replace('/dashboard')
    }
  }, [authLoading, isSuperadmin, router])

  const { data: systemConfig, isLoading: configLoading } = useQuery({
    queryKey: ['superadmin-system-config'],
    queryFn: getSystemConfig,
    enabled: isSuperadmin,
  })

  useEffect(() => {
    if (systemConfig?.content) {
      setConfigContent(systemConfig.content)
    }
  }, [systemConfig?.content])

  const saveConfigMutation = useMutation({
    mutationFn: (content: string) => saveSystemConfig(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-system-config'] })
      toast({
        title: 'Berhasil',
        description: 'Konfigurasi sistem berhasil disimpan',
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

  const exportTableMutation = useMutation({
    mutationFn: (tableName: string) => exportTableAsCSV(tableName),
    onSuccess: (csv, tableName) => {
      downloadCsv(`${tableName}-${new Date().toISOString().split('T')[0]}.csv`, csv)
      toast({
        title: 'Berhasil',
        description: `Data ${tableName} berhasil diekspor`,
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

  const exportAllMutation = useMutation({
    mutationFn: async () => {
      for (const table of EXPORTABLE_TABLES) {
        const csv = await exportTableAsCSV(table)
        downloadCsv(
          `${table}-${new Date().toISOString().split('T')[0]}.csv`,
          csv
        )
        await delay(400)
      }
    },
    onSuccess: () => {
      toast({
        title: 'Berhasil',
        description: 'Semua tabel berhasil diekspor (unduhan terpisah)',
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

  const clearDataMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()

      for (const table of CLEAR_DATA_TABLES) {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')

        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      setIsDangerOpen(false)
      setDangerConfirmText('')
      toast({
        title: 'Berhasil',
        description: 'Data test berhasil dihapus',
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

  const isExporting =
    exportTableMutation.isPending || exportAllMutation.isPending

  if (authLoading || !isSuperadmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="System Settings" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">App Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">
            Konfigurasi aplikasi disimpan sebagai JSON (App Name, Tagline,
            Footer Text).
          </p>
          {configLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <textarea
              value={configContent}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setConfigContent(event.target.value)
              }
              rows={10}
              className={cn(
                'flex min-h-[160px] w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-text-primary',
                'placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
              placeholder={DEFAULT_CONFIG}
            />
          )}
          <Button
            type="button"
            onClick={() => saveConfigMutation.mutate(configContent)}
            isLoading={saveConfigMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Simpan Konfigurasi
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:flex-1">
              <Label htmlFor="export-table">Pilih Tabel</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger id="export-table">
                  <SelectValue placeholder="Pilih tabel" />
                </SelectTrigger>
                <SelectContent>
                  {EXPORTABLE_TABLES.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isExporting}
              onClick={() => exportTableMutation.mutate(selectedTable)}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isExporting}
              onClick={() => exportAllMutation.mutate()}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Semua
            </Button>
          </div>
          <p className="text-xs text-text-tertiary">
            Export Semua akan mengunduh setiap tabel sebagai file CSV terpisah
            (tanpa ZIP).
          </p>
        </CardContent>
      </Card>

      {isDevelopment && (
        <Card className="border border-status-red">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-status-red">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-text-secondary">
              Hapus semua data test dari tabel students, kedisiplinan, dan
              prestasi. Hanya tersedia di environment development.
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setIsDangerOpen(true)}
            >
              Hapus Semua Data Test
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={isDangerOpen}
        onOpenChange={(open) => {
          setIsDangerOpen(open)
          if (!open) setDangerConfirmText('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Semua Data Test</DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus semua data di tabel students,
              kedisiplinan, dan prestasi. Ketik HAPUS untuk mengonfirmasi.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={dangerConfirmText}
            onChange={(event) => setDangerConfirmText(event.target.value)}
            placeholder="Ketik HAPUS"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDangerOpen(false)
                setDangerConfirmText('')
              }}
              disabled={clearDataMutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                dangerConfirmText !== 'HAPUS' || clearDataMutation.isPending
              }
              isLoading={clearDataMutation.isPending}
              onClick={() => clearDataMutation.mutate()}
            >
              Hapus Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
