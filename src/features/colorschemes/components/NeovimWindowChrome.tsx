import { cn } from '@/shared/lib/utils'
import type { ColorSchemeColors } from '@/shared/types'
import { CodePreview } from './CodePreview'

interface NeovimWindowChromeProps {
  /** Stable catalog ID used for preview caching */
  themeId: string
  /** Theme name for title bar */
  themeName: string
  /** Theme colors */
  colors: ColorSchemeColors
  /** Optional class name */
  className?: string
}

export function NeovimWindowChrome({
  themeId,
  themeName,
  colors,
  className,
}: NeovimWindowChromeProps): React.JSX.Element {
  return (
    <div
      className={cn('rounded-xl overflow-hidden shadow-lg border', className)}
      style={{ borderColor: colors.ui.border }}
    >
      {/* Title bar with traffic lights */}
      {/* // <div */}
      {/* //   className="flex items-center justify-between px-3 py-2" */}
      {/* //   style={{ backgroundColor: colors.ui.tabLine }} */}
      {/* // > */}
      {/* Traffic light buttons */}
      {/*   <div className="flex items-center gap-2"> */}
      {/*     <div className="w-3 h-3 rounded-full bg-[#FF5F56]" /> */}
      {/*     <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" /> */}
      {/*     <div className="w-3 h-3 rounded-full bg-[#27C93F]" /> */}
      {/*   </div> */}
      {/**/}
      {/* Theme name */}
      {/*   <span */}
      {/*     className="text-xs font-medium" */}
      {/*     style={{ color: colors.ui.tabLineText }} */}
      {/*   > */}
      {/*     {themeName} */}
      {/*   </span> */}
      {/**/}
      {/* "neovim" label */}
      {/*   <span */}
      {/*     className="text-xs" */}
      {/*     style={{ color: colors.ui.tabLineText, opacity: 0.7 }} */}
      {/*   > */}
      {/*     neovim */}
      {/*   </span> */}
      {/* </div> */}

      {/* Tab bar (init.lua) */}
      {/* <div */}
      {/*   className="flex items-center px-1 py-1 text-xs" */}
      {/*   style={{ backgroundColor: colors.ui.tabLine }} */}
      {/* > */}
      {/*   <div */}
      {/*     className="px-3 py-1 rounded-t" */}
      {/*     style={{ */}
      {/*       backgroundColor: colors.ui.tabLineSel, */}
      {/*       color: colors.ui.tabLineSelText, */}
      {/*     }} */}
      {/*   > */}
      {/*     init.lua */}
      {/*   </div> */}
      {/* </div> */}

      {/* Code area with status line simulation */}
      <div className="relative">
        {/* Top status line (showing colorscheme command) */}
        <div
          className="flex items-center justify-center px-2 py-0.5 text-xs font-mono"
          style={{
            backgroundColor: colors.ui.statusLine,
            color: colors.ui.statusLineText,
          }}
        >
          {/* Mode badge - use inverted status line colors for contrast */}
          {/* <span */}
          {/*   className="px-1.5 py-0.5 rounded text-xs font-semibold" */}
          {/*   style={{ */}
          {/*     backgroundColor: colors.ui.statusLineText, */}
          {/*     color: colors.ui.statusLine, */}
          {/*   }} */}
          {/* > */}
          {/*   NORMAL */}
          {/* </span> */}
          <span>{themeName}</span>
          {/* <span className="opacity-70">utf-8 0% 0:2</span> */}
        </div>

        {/* Code preview */}
        <CodePreview
          themeId={themeId}
          colors={colors}
          showLineNumbers={true}
          className="rounded-none"
        />

        {/* Bottom status line */}
        <div
          className="flex items-center justify-between px-2 py-0.5 text-xs font-mono"
          style={{
            backgroundColor: colors.ui.statusLine,
            color: colors.ui.statusLineText,
          }}
        >
          {/* Mode badge - use inverted status line colors for contrast */}
          <span
            className="px-1.5 py-0.5 rounded text-xs font-semibold"
            style={{
              backgroundColor: colors.ui.statusLineText,
              color: colors.ui.statusLine,
            }}
          >
            NORMAL
          </span>
          <span>init.lua</span>
          <span className="opacity-70">utf-8 50% 6:12</span>
        </div>
      </div>
    </div>
  )
}
