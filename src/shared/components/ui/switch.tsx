import { Switch as SwitchPrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/shared/lib/utils'

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default'
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch inline-flex shrink-0 items-center rounded-full border border-slate-400 bg-slate-300 shadow-xs outline-none transition-all data-[state=checked]:border-slate-500 data-[state=checked]:bg-slate-600 data-[state=unchecked]:bg-slate-300 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-slate-700 dark:data-[state=checked]:border-slate-500 dark:data-[state=checked]:bg-slate-600 dark:data-[state=unchecked]:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block rounded-full border border-slate-300 bg-white shadow-sm ring-0 transition-transform will-change-transform dark:border-slate-200 dark:shadow-black/30 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
