import { Analytics } from '@vercel/analytics/react'
import type { ReactNode } from 'react'
import { UpdateManager } from '@/features/updates'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { isBrowserOnlyRuntime } from '@/shared/lib/tauri-runtime'
import { ThemeProvider } from './theme-provider'
import { Toaster } from './toast-provider'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        {children}
        <Toaster />
        <UpdateManager />
        {isBrowserOnlyRuntime() ? <Analytics /> : null}
      </TooltipProvider>
    </ThemeProvider>
  )
}
