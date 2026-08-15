import { AlertCircle, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePluginStore } from '@/features/plugins'
import {
  buildParamInfoList,
  FunctionParamDefaultsForm,
} from '@/shared/components/function-param-defaults'
import { FunctionPickerModal } from '@/shared/components/function-picker'
import { Button } from '@/shared/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import { Label } from '@/shared/components/ui/label'
import {
  buildFunctionCatalog,
  findFunctionByKey,
} from '@/shared/data/function-catalog-builder'
import type { FunctionCatalogEntry } from '@/shared/data/function-catalog-types'
import type {
  RunFunctionDefaultValue,
  RunFunctionSignatureSnapshot,
  RunFunctionSource,
} from '@/shared/types'

export interface RunFunctionEditorProps {
  selectedFunctionKey: string
  functionSource: RunFunctionSource
  signature: RunFunctionSignatureSnapshot | null
  paramDefaults: Record<string, RunFunctionDefaultValue>
  onChange: (updates: {
    selectedFunctionKey?: string
    functionSource?: RunFunctionSource
    signature?: RunFunctionSignatureSnapshot | null
    paramDefaults?: Record<string, RunFunctionDefaultValue>
  }) => void
}

export function RunFunctionEditor({
  selectedFunctionKey,
  functionSource,
  signature,
  paramDefaults,
  onChange,
}: RunFunctionEditorProps): React.JSX.Element {
  const schemas = usePluginStore((state) => state.schemas)
  const installedPlugins = usePluginStore((state) => state.installedPlugins)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [paramsOpen, setParamsOpen] = useState(true)

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

    onChange({
      selectedFunctionKey: entry.key,
      functionSource: entry.functionSource,
      signature: newSignature,
      // Pre-fill template defaults; reset for non-templates
      paramDefaults:
        entry.isTemplate === true && entry.templateDefaults !== undefined
          ? { ...entry.templateDefaults }
          : {},
    })
  }

  const sourceLabel =
    functionSource.type === 'core'
      ? 'Core Neovim API'
      : `Plugin: ${functionSource.pluginId}`

  const functionName =
    functionSource.type === 'core'
      ? functionSource.functionName
      : functionSource.functionName

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Function</Label>

        {/* Current selection display */}
        {selectedFunctionKey.length > 0 ? (
          <div className="space-y-1">
            {/* Friendly label */}
            <p className="text-sm font-medium">
              {catalogEntry?.label ?? functionName}
            </p>
            <p className="text-xs text-muted-foreground">{sourceLabel}</p>
            {/* What it does */}
            {catalogEntry?.whatItDoes !== undefined && (
              <p className="text-xs text-muted-foreground">
                {catalogEntry.whatItDoes}
              </p>
            )}
            <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              {selectedFunctionKey}
            </p>
            {hasUnresolvedSelection && (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    This function is no longer available in the current catalog
                    (removed or plugin disabled). Choose it again before saving.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No function selected</p>
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

      {/* Parameter Defaults in Collapsible — only shown when function has params */}
      {signature !== null && signature.params.length > 0 && (
        <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${paramsOpen ? '' : '-rotate-90'}`}
            />
            <span className="text-sm font-medium">Parameter Defaults</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Keymaps do not have graph input ports. Set defaults here for
              values this function needs.
            </p>
            <FunctionParamDefaultsForm
              selectedFunctionKey={selectedFunctionKey}
              params={paramInfoList}
              paramDefaults={paramDefaults}
              onParamDefaultsChange={(newDefaults) =>
                onChange({ paramDefaults: newDefaults })
              }
            />
          </CollapsibleContent>
        </Collapsible>
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
