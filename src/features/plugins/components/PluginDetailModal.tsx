import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTutorialStore } from '@/features/tutorial/store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContentNoClose,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import type {
  PluginConfigValue,
  PluginInstallOverride,
  SchemaImportScope,
} from '@/shared/types'
import { PLUGIN_CATEGORY_LABELS } from '@/shared/types'
import { formatStars, resolvePluginMetadata } from '../format-utils'
import { seedWithLuaDefaults } from '../utils/seed-defaults'
import { CommandsPanel } from './detail-panels/CommandsPanel'
import { ConfigPanel } from './detail-panels/ConfigPanel'
import { FunctionsPanel } from './detail-panels/FunctionsPanel'
import { OverviewPanel } from './detail-panels/OverviewPanel'
import {
  PluginDetailSidebar,
  type PluginDetailView,
} from './PluginDetailSidebar'
import type { ValidPluginDisplayInfo } from './PluginGridCard'

// ============================================
// Props
// ============================================

export interface PluginDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  displayInfo: ValidPluginDisplayInfo
  onInstall: (schemaId: string) => Promise<void>
  onUninstall: (schemaId: string) => Promise<void>
  onDeleteSchema: (schemaId: string, source: SchemaImportScope) => Promise<void>
  onToggle: (schemaId: string, enabled: boolean) => Promise<void>
  onConfigChange: (
    schemaId: string,
    config: Record<string, PluginConfigValue>,
  ) => void
  onInstallOverrideChange?:
    | ((schemaId: string, override: PluginInstallOverride) => Promise<void>)
    | undefined
  onInstallOverrideClear?: ((schemaId: string) => Promise<void>) | undefined
  onLuaIncludeChange?:
    | ((schemaId: string, optionKey: string, included: boolean) => void)
    | undefined
  onLuaIncludeClear?:
    | ((schemaId: string, optionKey: string) => void)
    | undefined
  onResetAll?: ((schemaId: string) => void) | undefined
  isInstalling?: boolean | undefined
  isUninstalling?: boolean | undefined
  isDeletingSchema?: boolean | undefined
}

// ============================================
// Modal header
// ============================================

interface ModalHeaderProps {
  displayInfo: ValidPluginDisplayInfo
  onClose: () => void
}

function ModalHeader({
  displayInfo,
  onClose,
}: ModalHeaderProps): React.JSX.Element {
  const { schema } = displayInfo
  const repositoryMetadata = resolvePluginMetadata(schema, displayInfo.source)
  const formattedStars = formatStars(repositoryMetadata.stars)
  const categoryLabel =
    schema.category !== undefined
      ? PLUGIN_CATEGORY_LABELS[schema.category]
      : null

  return (
    <div className="flex items-start justify-between gap-4 p-4 border-b shrink-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold leading-tight">
            {schema.pluginName}
          </h2>
          {displayInfo.status === 'installed' && (
            <Badge
              variant={displayInfo.installed.enabled ? 'default' : 'secondary'}
              className="text-xs"
            >
              {displayInfo.installed.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
          {repositoryMetadata.author !== undefined && (
            <span>{repositoryMetadata.author}</span>
          )}
          {formattedStars !== null && (
            <>
              {repositoryMetadata.author !== undefined && (
                <span aria-hidden>·</span>
              )}
              <span>⭐ {formattedStars}</span>
            </>
          )}
          {categoryLabel !== null && (
            <>
              <span aria-hidden>·</span>
              <Badge variant="outline" className="text-xs">
                {categoryLabel}
              </Badge>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring shrink-0 mt-0.5"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}

// ============================================
// Modal footer
// ============================================

interface ModalFooterProps {
  displayInfo: ValidPluginDisplayInfo
  isConfigDirty: boolean
  activeView: PluginDetailView
  onClose: () => void
  onInstall: () => void
  onToggle: () => void
  onRequestUninstall: () => void
  onRequestDelete: () => void
  onSave: () => void
  onResetDefaults: () => void
  isInstalling?: boolean | undefined
  isUninstalling?: boolean | undefined
  isDeletingSchema?: boolean | undefined
}

function ModalFooter({
  displayInfo,
  isConfigDirty,
  activeView,
  onClose,
  onInstall,
  onToggle,
  onRequestUninstall,
  onRequestDelete,
  onSave,
  onResetDefaults,
  isInstalling,
  isUninstalling,
  isDeletingSchema,
}: ModalFooterProps): React.JSX.Element {
  const isInstalled = displayInfo.status === 'installed'
  const isEnabled = isInstalled ? displayInfo.installed.enabled : false
  const isConfigView = activeView.kind === 'config'

  if (!isInstalled) {
    // Available plugin footer
    return (
      <div className="flex items-center justify-between p-4 border-t shrink-0">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {displayInfo.source !== 'builtin' && (
            <Button
              variant="outline"
              onClick={onRequestDelete}
              disabled={isDeletingSchema === true}
              className="text-destructive hover:text-destructive"
            >
              Delete from Catalog
            </Button>
          )}
        </div>
        <Button
          data-testid="footer-install-btn"
          data-tutorial="plugin-install-button-footer"
          onClick={onInstall}
          disabled={isInstalling === true}
        >
          {isInstalling === true ? 'Installing…' : 'Install Plugin'}
        </Button>
      </div>
    )
  }

  if (isConfigView && isConfigDirty) {
    // Installed + config view + dirty
    return (
      <div className="flex items-center justify-between p-4 border-t shrink-0">
        <div className="flex items-center gap-2">
          <Button
            data-testid="footer-uninstall-btn"
            variant="outline"
            size="sm"
            onClick={onRequestUninstall}
            disabled={isUninstalling === true}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isUninstalling === true ? 'Removing…' : 'Uninstall'}
          </Button>
          <Button variant="outline" size="sm" onClick={onResetDefaults}>
            Reset Defaults
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onSave}>Save Changes</Button>
        </div>
      </div>
    )
  }

  // Installed + clean (any view)
  return (
    <div className="flex items-center justify-between p-4 border-t shrink-0">
      <div className="flex items-center gap-2">
        <Button
          data-testid="footer-uninstall-btn"
          variant="outline"
          size="sm"
          onClick={onRequestUninstall}
          disabled={isUninstalling === true}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {isUninstalling === true ? 'Removing…' : 'Uninstall'}
        </Button>
        {isConfigView && (
          <Button variant="outline" size="sm" onClick={onResetDefaults}>
            Reset Defaults
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button variant="outline" onClick={onToggle}>
          {isEnabled ? 'Disable' : 'Enable'}
        </Button>
      </div>
    </div>
  )
}

// ============================================
// Main modal
// ============================================

export function PluginDetailModal({
  open,
  onOpenChange,
  displayInfo,
  onInstall,
  onUninstall,
  onDeleteSchema,
  onToggle,
  onConfigChange,
  onInstallOverrideChange,
  onInstallOverrideClear,
  onLuaIncludeChange,
  onLuaIncludeClear,
  onResetAll,
  isInstalling,
  isUninstalling,
  isDeletingSchema,
}: PluginDetailModalProps): React.JSX.Element {
  const [activeView, setActiveView] = useState<PluginDetailView>({
    kind: 'overview',
  })
  const [configDirty, setConfigDirty] = useState(false)
  const [installVersionDirty, setInstallVersionDirty] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showUninstallDialog, setShowUninstallDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showDeleteSchemaDialog, setShowDeleteSchemaDialog] = useState(false)

  // Triggers for ConfigPanel save/reset
  const [saveTrigger, setSaveTrigger] = useState(0)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [installVersionDiscardTrigger, setInstallVersionDiscardTrigger] =
    useState(0)

  // Pending close action (used when dirty check intercepts close)
  const pendingCloseRef = useRef(false)

  // Check if tutorial is active to prevent outside close
  const runtimeState = useTutorialStore((s) => s.runtimeState)
  const isTutorialActive =
    runtimeState.status === 'active' || runtimeState.status === 'paused'

  const { schema } = displayInfo

  const savedConfig = useMemo<Record<string, PluginConfigValue>>(
    () =>
      displayInfo.status === 'installed' ? displayInfo.installed.config : {},
    [displayInfo],
  )
  const seededSavedConfig = useMemo<Record<string, PluginConfigValue>>(
    () => seedWithLuaDefaults(savedConfig, schema.options),
    [savedConfig, schema.options],
  )
  const [values, setValues] = useState<Record<string, PluginConfigValue>>(
    () => seededSavedConfig,
  )
  const prevSchemaIdRef = useRef(schema.id)
  const prevStatusRef = useRef(displayInfo.status)
  const isDirty = configDirty || installVersionDirty

  useEffect(() => {
    if (
      prevSchemaIdRef.current !== schema.id ||
      prevStatusRef.current !== displayInfo.status
    ) {
      setValues(seededSavedConfig)
      setConfigDirty(false)
      setInstallVersionDirty(false)
      prevSchemaIdRef.current = schema.id
      prevStatusRef.current = displayInfo.status
    }
  }, [schema.id, displayInfo.status, seededSavedConfig])

  // ── Close handling ──

  const handleRequestClose = useCallback((): void => {
    if (isDirty) {
      pendingCloseRef.current = true
      setShowDiscardDialog(true)
    } else {
      onOpenChange(false)
    }
  }, [isDirty, onOpenChange])

  const handleDiscardConfirm = useCallback((): void => {
    setShowDiscardDialog(false)
    setConfigDirty(false)
    setInstallVersionDirty(false)
    setInstallVersionDiscardTrigger((count) => count + 1)
    if (pendingCloseRef.current) {
      pendingCloseRef.current = false
      onOpenChange(false)
    }
  }, [onOpenChange])

  const handleDiscardCancel = useCallback((): void => {
    setShowDiscardDialog(false)
    pendingCloseRef.current = false
  }, [])

  // Intercept Dialog's own close (Escape / overlay click)
  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) {
        handleRequestClose()
      } else {
        onOpenChange(true)
      }
    },
    [handleRequestClose, onOpenChange],
  )

  // ── Actions ──

  const handleInstall = useCallback((): void => {
    void onInstall(schema.id)
  }, [onInstall, schema.id])

  const handleToggle = useCallback((): void => {
    if (displayInfo.status === 'installed') {
      void onToggle(schema.id, !displayInfo.installed.enabled)
    }
  }, [onToggle, schema.id, displayInfo])

  const handleRequestUninstall = useCallback((): void => {
    setShowUninstallDialog(true)
  }, [])

  const handleConfirmUninstall = useCallback((): void => {
    setShowUninstallDialog(false)
    void onUninstall(schema.id)
  }, [onUninstall, schema.id])

  const handleCancelUninstall = useCallback((): void => {
    setShowUninstallDialog(false)
  }, [])

  const handleConfirmDeleteSchema = useCallback(async (): Promise<void> => {
    await onDeleteSchema(
      schema.id,
      displayInfo.source === 'global' ? 'global' : 'project',
    )
    setShowDeleteSchemaDialog(false)
  }, [displayInfo.source, onDeleteSchema, schema.id])

  const handleConfigChange = useCallback(
    (config: Record<string, PluginConfigValue>): void => {
      onConfigChange(schema.id, config)
      setValues(config)
      setConfigDirty(false)
    },
    [onConfigChange, schema.id],
  )

  const handleInstallOverrideChange = useCallback(
    async (override: PluginInstallOverride): Promise<void> => {
      await onInstallOverrideChange?.(schema.id, override)
      setInstallVersionDirty(false)
    },
    [onInstallOverrideChange, schema.id],
  )

  const handleInstallOverrideClear = useCallback(async (): Promise<void> => {
    await onInstallOverrideClear?.(schema.id)
    setInstallVersionDirty(false)
  }, [onInstallOverrideClear, schema.id])

  const handleSave = useCallback((): void => {
    setSaveTrigger((n) => n + 1)
  }, [])

  const handleLuaIncludeChange = useCallback(
    (optionKey: string, included: boolean): void => {
      if (displayInfo.status !== 'installed') {
        return
      }

      onLuaIncludeChange?.(schema.id, optionKey, included)
    },
    [displayInfo.status, onLuaIncludeChange, schema.id],
  )

  const handleLuaIncludeClear = useCallback(
    (optionKey: string): void => {
      if (displayInfo.status !== 'installed') {
        return
      }

      onLuaIncludeClear?.(schema.id, optionKey)
    },
    [displayInfo.status, onLuaIncludeClear, schema.id],
  )

  const handleResetDefaults = useCallback((): void => {
    if (configDirty) {
      setResetTrigger((n) => n + 1)
      return
    }

    setShowResetDialog(true)
  }, [configDirty])

  const handleConfirmReset = useCallback((): void => {
    setShowResetDialog(false)
    setResetTrigger((n) => n + 1)
  }, [])

  const handleCancelReset = useCallback((): void => {
    setShowResetDialog(false)
  }, [])

  // ── Content rendering ──
  // ConfigPanel is always mounted (but hidden when not active) to preserve dirty state
  // across sidebar navigation. Other panels are rendered on demand.

  const renderNonConfigContent = (): React.JSX.Element | null => {
    switch (activeView.kind) {
      case 'overview':
        return (
          <OverviewPanel
            displayInfo={displayInfo}
            onToggle={handleToggle}
            onUninstall={handleRequestUninstall}
            onInstallOverrideChange={handleInstallOverrideChange}
            onInstallOverrideClear={handleInstallOverrideClear}
            onInstallVersionDirtyChange={setInstallVersionDirty}
            discardTrigger={installVersionDiscardTrigger}
            isUninstalling={isUninstalling}
          />
        )
      case 'commands':
        return <CommandsPanel commands={schema.exCommands ?? []} />
      case 'functions':
        return (
          <FunctionsPanel
            functions={schema.functions}
            functionTemplates={schema.functionTemplates}
          />
        )
      case 'config':
        return null
    }
  }

  const nonConfigContent = renderNonConfigContent()

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContentNoClose
          data-tutorial="plugin-detail-modal"
          className="max-w-5xl h-[700px] max-h-[90vh] p-0 gap-0 overflow-hidden"
          preventOutsideClose={isTutorialActive}
        >
          {/* Visually hidden title/description for screen reader accessibility (Radix requirement) */}
          <DialogTitle className="sr-only">
            {schema.pluginName} — Plugin Details
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and configure {schema.pluginName} plugin settings
          </DialogDescription>
          <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <ModalHeader
              displayInfo={displayInfo}
              onClose={handleRequestClose}
            />

            {/* Body: sidebar + content */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Sidebar */}
              <PluginDetailSidebar
                schema={schema}
                pluginValues={values}
                activeView={activeView}
                onSelectView={setActiveView}
              />

              {/* Main content */}
              <ScrollArea className="flex-1 min-w-0">
                <div className="p-6">
                  {/* ConfigPanel is always mounted to preserve dirty state across navigation */}
                  <div
                    className={
                      activeView.kind === 'config' ? undefined : 'hidden'
                    }
                  >
                    <ConfigPanel
                      displayInfo={displayInfo}
                      values={values}
                      onValuesChange={setValues}
                      activeGroup={
                        activeView.kind === 'config'
                          ? activeView.group
                          : undefined
                      }
                      onNavigateGroup={(group) =>
                        setActiveView({ kind: 'config', group })
                      }
                      onConfigChange={handleConfigChange}
                      onDirtyChange={setConfigDirty}
                      saveTrigger={saveTrigger}
                      resetTrigger={resetTrigger}
                      luaFieldOverrides={
                        displayInfo.status === 'installed'
                          ? displayInfo.installed.luaFieldOverrides
                          : undefined
                      }
                      onLuaIncludeChange={handleLuaIncludeChange}
                      onLuaIncludeClear={handleLuaIncludeClear}
                      onResetAll={onResetAll}
                    />
                  </div>
                  {/* Other panels rendered on demand */}
                  {nonConfigContent}
                </div>
              </ScrollArea>
            </div>

            {/* Footer */}
            <ModalFooter
              displayInfo={displayInfo}
              isConfigDirty={configDirty}
              activeView={activeView}
              onClose={handleRequestClose}
              onInstall={handleInstall}
              onToggle={handleToggle}
              onRequestUninstall={handleRequestUninstall}
              onRequestDelete={() => setShowDeleteSchemaDialog(true)}
              onSave={handleSave}
              onResetDefaults={handleResetDefaults}
              isInstalling={isInstalling}
              isUninstalling={isUninstalling}
              isDeletingSchema={isDeletingSchema}
            />
          </div>
        </DialogContentNoClose>
      </Dialog>

      {/* Unsaved changes confirmation */}
      <AlertDialog open={showDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved configuration or install-version changes. Discard
              them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardConfirm}>
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteSchemaDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {schema.pluginName} from catalog?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {displayInfo.source === 'global'
                ? "This removes the global schema from every project's catalog. Installed copies in other projects will remain installed but lose their catalog schema. This action cannot be undone."
                : 'This removes the project-local schema from this project. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteSchemaDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDeleteSchema()}
              disabled={isDeletingSchema === true}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeletingSchema === true ? 'Deleting…' : 'Delete from Catalog'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Uninstall confirmation */}
      <AlertDialog open={showUninstallDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall {schema.pluginName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all configuration for{' '}
              <strong>{schema.pluginName}</strong>. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUninstall}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUninstall}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Uninstall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset defaults confirmation */}
      <AlertDialog open={showResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all configuration options for{' '}
              <strong>{schema.pluginName}</strong> to their default values. Your
              current settings will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReset}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Reset Defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
