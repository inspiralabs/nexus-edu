'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import {
  DayPicker,
  getDefaultClassNames,
  type DayPickerProps,
} from 'react-day-picker'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CalendarProps = DayPickerProps & {
  fromDate?: Date
  toDate?: Date
  defaultMonth?: Date
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fromDate,
  toDate,
  defaultMonth,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  const disabledMatchers = React.useMemo(() => {
    const matchers: any[] = []
    if (props.disabled) {
      if (Array.isArray(props.disabled)) {
        matchers.push(...props.disabled)
      } else {
        matchers.push(props.disabled)
      }
    }
    if (fromDate) {
      matchers.push({ before: fromDate })
    }
    if (toDate) {
      matchers.push({ after: toDate })
    }
    return matchers.length > 0 ? matchers : undefined
  }, [props.disabled, fromDate, toDate])

  const resolvedMonth = props.month || defaultMonth

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      startMonth={props.startMonth}
      endMonth={props.endMonth}
      disabled={disabledMatchers}
      month={resolvedMonth}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn(
          'flex flex-col gap-2 sm:flex-row',
          defaultClassNames.months
        ),
        month: cn('flex flex-col gap-4', defaultClassNames.month),
        month_caption: cn(
          'relative flex w-full items-center justify-center pt-1',
          defaultClassNames.month_caption
        ),
        caption_label: cn(
          'text-sm font-medium text-[var(--text-primary)]',
          defaultClassNames.caption_label
        ),
        nav: cn(
          'flex items-center gap-1',
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
          defaultClassNames.button_next
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'w-9 rounded-md text-[0.8rem] font-normal text-[var(--text-secondary)]',
          defaultClassNames.weekday
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        day: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 h-9 w-9',
          defaultClassNames.day
        ),
        day_button: cn(
          'h-9 w-9 rounded-md p-0 font-normal text-[var(--text-primary)] hover:bg-[var(--surface-2)] aria-selected:opacity-100',
          defaultClassNames.day_button
        ),
        selected: cn(
          'rounded-md bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white',
          defaultClassNames.selected
        ),
        today: cn('font-semibold text-primary', defaultClassNames.today),
        outside: cn(
          'text-[var(--text-tertiary)] opacity-50',
          defaultClassNames.outside
        ),
        disabled: cn(
          'text-[var(--text-tertiary)] opacity-50',
          defaultClassNames.disabled
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
