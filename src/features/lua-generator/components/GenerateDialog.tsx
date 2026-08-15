import { Loader2, Play, Rocket, RotateCcw } from 'lucide-react'
import { useProjectStore } from '@/features/projects/store'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs'
import { isMemoryMode } from '@/shared/lib/storage'
import {
  selectCanDeploy,
  selectCanGenerate,
  selectIsPreflightLoading,
  useGenerationStore,
} from '../store'
import type { GenerationDialogPhase, GenerationResult } from '../types'
import { countByLevel, hasWarnings } from '../types'
import { DeployPanel } from './DeployPanel'
import { DiagnosticList } from './DiagnosticList'
import { GenerationProgress } from './GenerationProgress'
import { LuaPreview } from './LuaPreview'
import { PreFlightPanel } from './PreFlightPanel'

// Underline tab style overrides (scoped to this dialog, no changes to shared tabs component)
const TAB_LIST_CLS =
  'p-0 h-auto border-b border-border rounded-none w-full justify-start shrink-0'
const TAB_TRIGGER_CLS =
  'rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none relative top-[1px] gap-2 px-4 py-2 cursor-pointer hover:text-foreground hover:bg-muted/50'

function CompletionContent({
  result,
}: {
  result: GenerationResult
}): React.JSX.Element {
  const errorCount = countByLevel(result.diagnostics, 'error')
  const warningCount = countByLevel(result.diagnostics, 'warning')
  const hasDiagnostics = result.diagnostics.length > 0

  // Narrow Lua output to a guaranteed string (non-empty, success only)
  const luaCode: string | null =
    result.success && result.initLua !== undefined && result.initLua.length > 0
      ? result.initLua
      : null
  const lineCount = luaCode !== null ? luaCode.split('\n').length : 0

  // Edge case: no diagnostics, generation succeeded — show preview directly (no tabs)
  if (!hasDiagnostics && luaCode !== null) {
    return <LuaPreview code={luaCode} />
  }

  // Edge case: no diagnostics and no Lua output — nothing meaningful to show
  if (!hasDiagnostics && luaCode === null) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Generation complete but no output was produced.
      </p>
    )
  }

  // Default active tab: lua when output is available, diagnostics otherwise
  const defaultTab = luaCode !== null ? 'lua' : 'diagnostics'

  return (
    <Tabs defaultValue={defaultTab} className="flex flex-col min-h-0 flex-1">
      <TabsList className={TAB_LIST_CLS}>
        {/* Diagnostics tab — always shown when there are diagnostics */}
        <TabsTrigger value="diagnostics" className={TAB_TRIGGER_CLS}>
          Diagnostics
          {errorCount > 0 && (
            <Badge variant="destructive">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary">
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </TabsTrigger>

        {/* Generated Lua tab — only shown when generation succeeded with output */}
        {luaCode !== null && (
          <TabsTrigger value="lua" className={TAB_TRIGGER_CLS}>
            Generated Lua
            <span className="text-xs text-muted-foreground">
              ({lineCount} lines)
            </span>
          </TabsTrigger>
        )}
      </TabsList>

      {/* Diagnostics panel */}
      <TabsContent
        value="diagnostics"
        className="mt-0 pt-3 flex-1 overflow-y-auto min-h-0"
      >
        <div className="space-y-4">
          <DiagnosticList diagnostics={result.diagnostics} embedded />
          {!result.success && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive font-medium">
                Generation failed due to {errorCount} error
                {errorCount !== 1 ? 's' : ''}. Fix the issues above and try
                again.
              </p>
            </div>
          )}
        </div>
      </TabsContent>

      {/* Generated Lua panel — only rendered when Lua output is available */}
      {luaCode !== null && (
        <TabsContent
          value="lua"
          className="mt-0 pt-3 flex-1 overflow-y-auto min-h-0"
        >
          <LuaPreview code={luaCode} embedded />
        </TabsContent>
      )}
    </Tabs>
  )
}

function getDialogTitle(dialogPhase: GenerationDialogPhase): string {
  if (dialogPhase.type === 'pre-flight') return 'Generate Lua Configuration'
  if (dialogPhase.type === 'deploying') return 'Deploying...'
  if (dialogPhase.type === 'deployed') {
    return dialogPhase.deployResult.success
      ? 'Deployed Successfully'
      : 'Deploy Failed'
  }

  const p = dialogPhase.progress
  if (p.type === 'idle') return 'Generate Lua Configuration'
  if (p.type === 'complete')
    return p.result.success ? 'Generation Complete' : 'Generation Failed'
  if (p.type === 'error') return 'Error'
  return 'Generating...'
}

function getDialogDescription(dialogPhase: GenerationDialogPhase): string {
  if (dialogPhase.type === 'pre-flight') {
    return 'Generate a working init.lua from your visual configuration.'
  }
  if (dialogPhase.type === 'deploying') {
    return 'Writing init.lua to your Neovim config directory...'
  }
  if (dialogPhase.type === 'deployed') {
    return dialogPhase.deployResult.success
      ? 'Your configuration has been deployed.'
      : 'There was a problem deploying the configuration.'
  }

  const p = dialogPhase.progress
  if (p.type === 'idle')
    return 'Generate a working init.lua from your visual configuration.'
  if (p.type === 'validating')
    return `Running pre-generation checks: ${p.checkName}`
  if (p.type === 'generating-sections')
    return `Generating section: ${p.sectionName}`
  if (p.type === 'generating-graphs')
    return `Generating graph ${p.current}/${p.total}: ${p.graphName}`
  if (p.type === 'validating-output') return 'Validating generated Lua output.'
  if (p.type === 'complete') {
    return p.result.success
      ? 'Review the generated code below. You can deploy it to your Neovim config directory.'
      : 'There were errors that prevented generation. Review the issues below.'
  }
  return 'An unexpected error occurred.'
}

function renderPhaseContent(
  dialogPhase: GenerationDialogPhase,
): React.ReactNode {
  if (dialogPhase.type === 'pre-flight') {
    return <PreFlightPanel />
  }

  if (dialogPhase.type === 'deploying') {
    return (
      <GenerationProgress message="Deploying to Neovim config directory..." />
    )
  }

  if (dialogPhase.type === 'deployed') {
    return <DeployPanel deployResult={dialogPhase.deployResult} />
  }

  const progress = dialogPhase.progress
  if (progress.type === 'validating') {
    return (
      <GenerationProgress message={`Running check: ${progress.checkName}...`} />
    )
  }
  if (progress.type === 'generating-sections') {
    return (
      <GenerationProgress
        message={`Generating section: ${progress.sectionName}...`}
      />
    )
  }
  if (progress.type === 'generating-graphs') {
    return (
      <GenerationProgress
        message={`Generating graph ${progress.current}/${progress.total}: ${progress.graphName}...`}
      />
    )
  }
  if (progress.type === 'validating-output') {
    return <GenerationProgress message="Validating generated Lua..." />
  }
  if (progress.type === 'error') {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{progress.error}</p>
      </div>
    )
  }
  if (progress.type === 'idle') {
    return <PreFlightPanel />
  }

  // complete
  const result = progress.result
  return <CompletionContent result={result} />
}

interface FooterActionProps {
  dialogPhase: GenerationDialogPhase
  canDeploy: boolean
  canGenerate: boolean
  isPreflightLoading: boolean
  isMemory: boolean
  onGenerate: () => void
  onDeploy: () => void
  onRestartPreflight: () => void
  onCancelGeneration: () => void
  onClose: () => void
}

function renderFooterActions(props: FooterActionProps): React.ReactNode {
  const {
    dialogPhase,
    canDeploy,
    canGenerate,
    isPreflightLoading,
    isMemory,
    onGenerate,
    onDeploy,
    onRestartPreflight,
    onCancelGeneration,
    onClose,
  } = props

  if (dialogPhase.type === 'pre-flight') {
    return (
      <>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={onGenerate}
          disabled={!canGenerate || isPreflightLoading}
        >
          {isPreflightLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          Generate
        </Button>
      </>
    )
  }

  if (dialogPhase.type === 'generation') {
    const p = dialogPhase.progress
    const isActive =
      p.type === 'validating' ||
      p.type === 'generating-sections' ||
      p.type === 'generating-graphs' ||
      p.type === 'validating-output'

    if (isActive) {
      return (
        <>
          <Button variant="outline" onClick={onCancelGeneration}>
            Cancel
          </Button>
          <Button variant="outline" disabled>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </Button>
        </>
      )
    }

    if (p.type === 'complete') {
      const result = p.result
      return (
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={onRestartPreflight}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Regenerate
          </Button>
          {canDeploy && !isMemory && (
            <Button onClick={onDeploy}>
              <Rocket className="w-4 h-4 mr-2" />
              Deploy
              {result.success && hasWarnings(result.diagnostics) && (
                <span className="ml-1 text-xs opacity-75">
                  ({countByLevel(result.diagnostics, 'warning')} warnings)
                </span>
              )}
            </Button>
          )}
          {isMemory && (
            <Button disabled title="Deploy is not available in browser mode">
              <Rocket className="w-4 h-4 mr-2" />
              Deploy (Browser Mode)
            </Button>
          )}
        </>
      )
    }

    return (
      <>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onRestartPreflight}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </>
    )
  }

  if (dialogPhase.type === 'deploying') {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Deploying...
      </Button>
    )
  }

  return (
    <>
      <Button variant="outline" onClick={onRestartPreflight}>
        <RotateCcw className="w-4 h-4 mr-2" />
        Regenerate
      </Button>
      <Button onClick={onClose}>Done</Button>
    </>
  )
}

export function GenerateDialog(): React.JSX.Element {
  const dialogOpen = useGenerationStore((s) => s.dialogOpen)
  const closeDialog = useGenerationStore((s) => s.closeDialog)
  const dialogPhase = useGenerationStore((s) => s.dialogPhase)
  const generate = useGenerationStore((s) => s.generate)
  const deploy = useGenerationStore((s) => s.deploy)
  const cancelGeneration = useGenerationStore((s) => s.cancelGeneration)
  const restartGenerationPreflight = useGenerationStore(
    (s) => s.restartGenerationPreflight,
  )
  const canDeploy = useGenerationStore(selectCanDeploy)
  const canGenerate = useGenerationStore(selectCanGenerate)
  const isPreflightLoading = useGenerationStore(selectIsPreflightLoading)
  const projectId = useProjectStore((s) => s.currentProject?.id ?? null)
  const projectPath = useProjectStore(
    (s) => s.currentProject?.absolutePath ?? null,
  )

  const handleGenerate = (): void => {
    if (projectPath === null) return
    void generate()
  }

  const handleDeploy = (): void => {
    if (projectId === null || projectPath === null) return
    void deploy(projectId, projectPath)
  }

  const handleRestartPreflight = (): void => {
    restartGenerationPreflight()
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
    >
      <DialogContent
        className="max-w-3xl max-h-[85vh] flex flex-col"
        preventOutsideClose={dialogPhase.type === 'deploying'}
      >
        <DialogHeader>
          <DialogTitle>{getDialogTitle(dialogPhase)}</DialogTitle>
          <DialogDescription>
            {getDialogDescription(dialogPhase)}
          </DialogDescription>
        </DialogHeader>

        {/* Phase-specific content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto py-2">
          {renderPhaseContent(dialogPhase)}
        </div>

        {/* Footer with phase-specific actions */}
        <DialogFooter className="gap-2 sm:gap-0">
          {renderFooterActions({
            dialogPhase,
            canDeploy,
            canGenerate,
            isPreflightLoading,
            isMemory: isMemoryMode(),
            onGenerate: handleGenerate,
            onDeploy: handleDeploy,
            onRestartPreflight: handleRestartPreflight,
            onCancelGeneration: cancelGeneration,
            onClose: closeDialog,
          })}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
