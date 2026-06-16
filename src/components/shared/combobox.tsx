'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { cn } from '@/lib/utils'

interface ComboboxProps {
  options: { value: string; label: string }[]
  value?: string
  onSelect: (value: string, label: string) => void
  onSearch: (query: string) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  /** Pesan yang ditampilkan saat data kosong. Default: "Tidak ada data" */
  emptyMessage?: string
}

function Combobox({
  options,
  value,
  onSelect,
  onSearch,
  placeholder = 'Pilih...',
  disabled = false,
  isLoading = false,
  emptyMessage = 'Tidak ada data',
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-[var(--text-tertiary)]'
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Cari..."
            onValueChange={onSearch}
          />
          <CommandList>
            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            )}

            {/* Empty state — pengecekan manual karena CommandEmpty tidak berfungsi saat shouldFilter=false */}
            {!isLoading && options.length === 0 && (
              <div className="py-6 text-center text-sm text-[var(--text-secondary)] dark:text-zinc-400">
                {emptyMessage}
              </div>
            )}

            {/* Daftar hasil */}
            {!isLoading && options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    forceMount
                    onSelect={() => {
                      onSelect(option.value, option.label)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox }
