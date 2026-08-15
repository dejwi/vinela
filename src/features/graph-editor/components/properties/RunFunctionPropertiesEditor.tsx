import { AlertCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePluginStore } from '@/features/plugins'
import {
  buildParamInfoList,
  FunctionParamDefaultsForm,
} from '@/shared/components/function-param-defaults'
import { FunctionPickerModal } from '@/shared/components/function-picker'
import { Button } from '@/shared/components/ui/button'
import {
  buildFunctionCatalog,
  findFunctionByKey,
} from '@/shared/data/function-catalog-builder'
import type { FunctionCatalogEntry } from '@/shared/data/function-catalog-types'
import type {
  RunFunctionDefaultValue,
  RunFunctionNodeData,
  RunFunctionSignatureSnapshot,
} from '@/shared/types'
import { useParamConnectionStatus } from '../../hooks/useParamConnectionStatus'
import { useGraphEditorStore } from '../../store'
import { type NodePropertiesEditorProps, PropertiesSection } from './shared'

export function RunFunctionPropertiesEditor({
  node,
}: NodePropertiesEditorProps<RunFunctionNodeData>) {
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)
  const schemas = usePluginStore((state) => state.schemas)
  const installedPlugins = usePluginStore((state) => state.installedPlugins)

  const [pickerOpen, setPickerOpen] = useState(false)

  // Build catalog from installed + enabled schemas
  const enabledSchemas = useMemo(
    () =>
      schemas.filter((s) =>
        installedPlugins.some((p) => p.schemaId === s.schema.id && p.enabled),
      ),
    [schemas, installedPlugins],
  )

  const catalog = useMemo(
    () => buildFunctionCatalog(enabledSchemas),
    [enabledSchemas],
  )

  const { functionSource, selectedFunctionKey, signature } = node.data

  // Merge signature params with catalog metadata for rich param info
  const catalogEntry: FunctionCatalogEntry | undefined = useMemo(
    () =>
      selectedFunctionKey.length > 0
        ? findFunctionByKey(catalog, selectedFunctionKey)
        : undefined,
    [catalog, selectedFunctionKey],
  )

  const paramInfoList = useMemo(
    () =>
      signature !== null
        ? buildParamInfoList(signature.params, catalogEntry)
        : [],
    [signature, catalogEntry],
  )

  const hasUnresolvedSelection =
    selectedFunctionKey.length > 0 && catalogEntry === undefined

  // Check which param ports are connected (single selector, no hook-in-loop)
  const connectionStatus = useParamConnectionStatus(
    node.id,
    signature?.params ?? [],
  )

  function handleFunctionSelected(entry: FunctionCatalogEntry): void {
    const newSignature: RunFunctionSignatureSnapshot = {
      params: entry.params.map((p) => ({
        name: p.name,
        type: p.type,
        optional: p.optional,
        description: p.description,
      })),
      returns: entry.returns,
      luaCall: entry.luaCall,
    }

    // Smart auto-set displayName: only when blank or matching the current auto-generated label
    const currentDisplayName = node.data.displayName ?? ''
    const currentAutoLabel = catalogEntry?.label ?? ''
    const shouldAutoSetName =
      currentDisplayName === '' || currentDisplayName === currentAutoLabel

    updateNodeData<RunFunctionNodeData>(node.id, {
      selectedFunctionKey: entry.key,
      functionSource: entry.functionSource,
      signature: newSignature,
      // Pre-fill template defaults; reset for non-templates
      paramDefaults:
        entry.isTemplate === true && entry.templateDefaults !== undefined
          ? { ...entry.templateDefaults }
          : {},
      // Auto-set display name to friendly label (smart: respects user overrides)
      ...(shouldAutoSetName ? { displayName: entry.label } : {}),
    })
  }

  function handleParamDefaultsChange(
    newDefaults: Record<string, RunFunctionDefaultValue>,
  ): void {
    updateNodeData<RunFunctionNodeData>(node.id, {
      paramDefaults: newDefaults,
    })
  }

  const sourceLabel =
    functionSource.type === 'core'
      ? 'Core Neovim API'
      : `Plugin: ${functionSource.pluginId}`

  return (
    <div className="space-y-5">
      <PropertiesSection
        title="Function"
        description="Select the Neovim API or plugin function to call."
      >
        <div className="space-y-3">
          {/* Current selection display */}
          {selectedFunctionKey.length > 0 ? (
            <div className="space-y-1.5">
              {/* Friendly label + source badge */}
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {catalogEntry?.label ??
                    (functionSource.type === 'core'
                      ? functionSource.functionName
                      : functionSource.functionName)}
                </p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {sourceLabel}
                </span>
              </div>

              {/* What it does (only if available) */}
              {catalogEntry?.whatItDoes !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {catalogEntry.whatItDoes}
                </p>
              )}

              {/* Lua call signature (compact) */}
              {signature !== null && (
                <code className="block text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded whitespace-normal break-all">
                  {signature.luaCall}
                </code>
              )}

              {/* Return type info (inside Function section) */}
              {signature !== null && signature.returns !== 'void' && (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Returns
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {signature.returns}
                    </span>
                  </div>
                  {catalogEntry?.returnDescription !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      {catalogEntry.returnDescription}
                    </p>
                  )}
                </div>
              )}

              {/* Unresolved warning */}
              {hasUnresolvedSelection && (
                <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      This function no longer resolves in the current catalog.
                      Re-select a function to refresh the snapshot.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No function selected
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
            className="w-full"
          >
            {selectedFunctionKey.length > 0
              ? 'Change Function...'
              : 'Choose Function...'}
          </Button>
        </div>
      </PropertiesSection>

      {/* Parameter Defaults — only shown when function has params */}
      {signature !== null && signature.params.length > 0 && (
        <PropertiesSection
          title="Parameter Defaults"
          description="Set default values for function parameters. Connected ports override these defaults."
        >
          <FunctionParamDefaultsForm
            selectedFunctionKey={selectedFunctionKey}
            params={paramInfoList}
            paramDefaults={node.data.paramDefaults}
            onParamDefaultsChange={handleParamDefaultsChange}
            connectedParams={connectionStatus}
          />
        </PropertiesSection>
      )}

      <FunctionPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        catalog={catalog}
        selectedFunctionKey={selectedFunctionKey}
        onConfirm={handleFunctionSelected}
      />
    </div>
  )
}
