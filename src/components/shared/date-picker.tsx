'use client'

import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  fromDate?: Date
  toDate?: Date
  defaultMonth?: Date
  modifiers?: Record<string, any>
  modifiersStyles?: Record<string, React.CSSProperties>
  modifiersClassNames?: Record<string, string>
}

function DatePicker({
  value,
  onChange,
  placeholder = 'Pilih tanggal',
  disabled = false,
  minDate,
  maxDate,
  fromDate,
  toDate,
  defaultMonth,
  modifiers,
  modifiersStyles,
  modifiersClassNames,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState<Date | undefined>(value || defaultMonth)

  React.useEffect(() => {
    if (value) {
      setMonth(value)
    } else if (defaultMonth) {
      setMonth(defaultMonth)
    }
  }, [value, defaultMonth])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-[var(--text-tertiary)]'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'dd/MM/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          showOutsideDays={true}
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
          month={month}
          onMonthChange={setMonth}
          startMonth={minDate || fromDate}
          endMonth={maxDate || toDate}
          fromDate={fromDate}
          toDate={toDate}
          defaultMonth={defaultMonth}
          disabled={(date) => {
            const min = minDate || fromDate
            const max = maxDate || toDate
            if (min && date < min) return true
            if (max && date > max) return true
            return false
          }}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          modifiersClassNames={modifiersClassNames}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
