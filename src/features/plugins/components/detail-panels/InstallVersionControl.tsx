import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import type {
  InstalledPlugin,
  PluginInstallOverride,
  PluginInstallVersionOverride,
  PluginSchema,
} from '@/shared/types'
import {
  getEffectiveInstallVersionDisplay,
  installVersionSpecsEqual,
  validatePluginInstallVersionOverride,
} from '../../utils/install-version'
import {
  InstallVersionActions,
  InstallVersionCustomFields,
} from './InstallVersionControl.parts'

type DraftInstallVersionMode =
  | 'semver-range'
  | 'branch'
  | 'tag'
  | 'commit'
  | 'ref'

type InstallVersionDraft =
  | { readonly kind: 'default' }
  | {
      readonly kind: 'custom'
      readonly mode: DraftInstallVersionMode
      readonly value: string
    }

interface InstallVersionControlProps {
  readonly schema: PluginSchema
  readonly installed: InstalledPlugin
  readonly onSave: (override: PluginInstallOverride) => Promise<void> | void
  readonly onClear: () => Promise<void> | void
  readonly onDirtyChange?: ((dirty: boolean) => void) | undefined
  readonly discardTrigger: number
}

function createDraftFromInstalled(
  installed: InstalledPlugin,
): InstallVersionDraft {
  const version = installed.installOverride?.version
  if (version === undefined) {
    return { kind: 'default' }
  }

  if (version.mode === 'semver-range') {
    return { kind: 'custom', mode: 'semver-range', value: version.value }
  }

  return {
    kind: 'custom',
    mode: version.refKind,
    value: version.value,
  }
}

function getDraftOverride(
  draft: InstallVersionDraft,
): PluginInstallOverride | undefined {
  if (draft.kind === 'default') {
    return undefined
  }

  const version: PluginInstallVersionOverride =
    draft.mode === 'semver-range'
      ? { mode: 'semver-range', value: draft.value }
      : { mode: 'ref', refKind: draft.mode, value: draft.value }

  return { version }
}

function getValidationMessage(draft: InstallVersionDraft): string | null {
  const draftOverride = getDraftOverride(draft)
  if (draftOverride?.version === undefined) {
    return null
  }

  const result = validatePluginInstallVersionOverride(draftOverride.version)
  return result.success ? null : result.reason
}

function isDirtyDraft(
  installed: InstalledPlugin,
  draft: InstallVersionDraft,
): boolean {
  const persistedVersion = installed.installOverride?.version
  const draftVersion = getDraftOverride(draft)?.version
  return !installVersionSpecsEqual(persistedVersion, draftVersion)
}

export function InstallVersionControl({
  schema,
  installed,
  onSave,
  onClear,
  onDirtyChange,
  discardTrigger,
}: InstallVersionControlProps): React.JSX.Element {
  const [draft, setDraft] = useState<InstallVersionDraft>(() =>
    createDraftFromInstalled(installed),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const prevDiscardTriggerRef = useRef(discardTrigger)
  const prevInstalledRef = useRef(installed)

  useEffect(() => {
    const discardIncremented = discardTrigger > prevDiscardTriggerRef.current
    const installedChanged = prevInstalledRef.current !== installed

    prevDiscardTriggerRef.current = discardTrigger
    prevInstalledRef.current = installed

    if (installedChanged || discardIncremented) {
      setDraft(createDraftFromInstalled(installed))
      onDirtyChange?.(false)
    }
  }, [installed, onDirtyChange, discardTrigger])

  const validationMessage = useMemo(() => getValidationMessage(draft), [draft])
  const isDirty = useMemo(
    () => isDirtyDraft(installed, draft),
    [draft, installed],
  )
  const hasPersistedInstallVersionOverride =
    installed.installOverride?.version !== undefined
  const isDirtyDefaultDraft = draft.kind === 'default' && isDirty
  const draftOverride = getDraftOverride(draft)
  const effectiveDisplay = useMemo(
    () =>
      getEffectiveInstallVersionDisplay(
        schema.pack?.version,
        draftOverride?.version,
      ),
    [draftOverride, schema.pack?.version],
  )
  const persistedOverrideDiffersFromSchema = useMemo(
    () =>
      draftOverride?.version !== undefined &&
      schema.pack?.version !== undefined &&
      !installVersionSpecsEqual(draftOverride.version, schema.pack.version),
    [draftOverride, schema.pack?.version],
  )

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const canSave =
    isDirty &&
    !isSaving &&
    !isResetting &&
    (draft.kind === 'default' || validationMessage === null)

  const canReset =
    !isSaving &&
    !isResetting &&
    (hasPersistedInstallVersionOverride || draft.kind !== 'default')

  const clearPersistedOverride = async (
    pending: 'save' | 'reset',
  ): Promise<void> => {
    if (pending === 'save') {
      setIsSaving(true)
    } else {
      setIsResetting(true)
    }

    try {
      await onClear()
      setDraft({ kind: 'default' })
      onDirtyChange?.(false)
    } finally {
      if (pending === 'save') {
        setIsSaving(false)
      } else {
        setIsResetting(false)
      }
    }
  }

  const handleSave = async (): Promise<void> => {
    if (draft.kind === 'default') {
      if (!isDirtyDefaultDraft) {
        return
      }

      await clearPersistedOverride('save')
      return
    }

    if (draftOverride?.version === undefined) {
      return
    }

    const validationResult = validatePluginInstallVersionOverride(
      draftOverride.version,
    )
    if (!validationResult.success) {
      return
    }

    setIsSaving(true)
    try {
      await onSave({ version: validationResult.version })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    if (hasPersistedInstallVersionOverride) {
      await clearPersistedOverride('reset')
      return
    }

    setDraft({ kind: 'default' })
    onDirtyChange?.(false)
  }

  const handleDiscard = (): void => {
    setDraft(createDraftFromInstalled(installed))
    onDirtyChange?.(false)
  }

  return (
    <div className="mt-4 space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h5 className="text-sm font-semibold">Install version</h5>
          <Badge
            variant="outline"
            data-testid="install-version-effective-source"
          >
            {effectiveDisplay.source === 'user-override'
              ? 'Custom'
              : effectiveDisplay.source === 'schema-default'
                ? 'Schema default'
                : 'Unpinned'}
          </Badge>
        </div>
        <p
          className="text-sm font-medium"
          data-testid="install-version-effective-text"
        >
          {effectiveDisplay.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {effectiveDisplay.detail}
        </p>
      </div>

      <fieldset className="flex gap-2">
        <legend className="sr-only">Install version source</legend>
        <Button
          type="button"
          variant={draft.kind === 'default' ? 'default' : 'outline'}
          aria-pressed={draft.kind === 'default'}
          data-testid="install-version-mode-default"
          onClick={() => setDraft({ kind: 'default' })}
        >
          Default / recommended
        </Button>
        <Button
          type="button"
          variant={draft.kind === 'custom' ? 'default' : 'outline'}
          aria-pressed={draft.kind === 'custom'}
          data-testid="install-version-mode-custom"
          onClick={() =>
            setDraft((currentDraft) =>
              currentDraft.kind === 'custom'
                ? currentDraft
                : { kind: 'custom', mode: 'semver-range', value: '' },
            )
          }
        >
          Custom
        </Button>
      </fieldset>

      {draft.kind === 'custom' && (
        <InstallVersionCustomFields
          mode={draft.mode}
          value={draft.value}
          validationMessage={validationMessage}
          showSchemaOverrideHint={persistedOverrideDiffersFromSchema}
          onModeChange={(mode) =>
            setDraft({ kind: 'custom', mode, value: draft.value })
          }
          onValueChange={(value) =>
            setDraft({ kind: 'custom', mode: draft.mode, value })
          }
        />
      )}

      <InstallVersionActions
        canSave={canSave}
        canReset={canReset}
        isDirty={isDirty}
        isSaving={isSaving}
        isResetting={isResetting}
        onSave={() => void handleSave()}
        onReset={() => void handleClear()}
        onDiscard={handleDiscard}
      />
    </div>
  )
}
