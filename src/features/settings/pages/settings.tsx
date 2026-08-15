import { Settings as SettingsIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BackupManager, NeovimStatus } from '@/features/neovim/components'
import { useProjectStore } from '@/features/projects/store'
import { useTutorialStore } from '@/features/tutorial'
import { loadTutorialProgress } from '@/features/tutorial/storage'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import {
  getDefaultAppSettings,
  getSettingWithDefault,
  SETTING_DEFAULTS,
} from '@/shared/lib/settings'
import type { AppSettings } from '@/shared/types'
import { AboutSection } from '../components/AboutSection'
import { NeovimOptionsLinkCard } from '../components/NeovimOptionsLinkCard'
import { NumberSetting } from '../components/NumberSetting'
import { OutputPathSetting } from '../components/OutputPathSetting'
import { SettingRow } from '../components/SettingRow'
import { SettingsSection } from '../components/SettingsSection'
import { ThemeSelector } from '../components/ThemeSelector'
import { ToggleSetting } from '../components/ToggleSetting'
import { useAppSettings } from '../hooks/useAppSettings'
import { useProjectNeovimOptions } from '../hooks/useProjectNeovimOptions'

export default function SettingsPage(): React.JSX.Element {
  const { settings, updateSetting, resetSetting } = useAppSettings()
  const { setTheme } = useTheme()
  const currentProject = useProjectStore((state) => state.currentProject)
  const { modifiedCount } = useProjectNeovimOptions()
  const tutorialRuntimeState = useTutorialStore((s) => s.runtimeState)
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(false)

  useEffect(() => {
    if (
      tutorialRuntimeState.status !== 'idle' &&
      tutorialRuntimeState.status !== 'completing'
    ) {
      return
    }

    let isCancelled = false

    async function loadCompletionState(): Promise<void> {
      const progress = await loadTutorialProgress()
      if (!isCancelled) {
        setHasCompletedTutorial(progress?.hasCompleted ?? false)
      }
    }

    void loadCompletionState()

    return () => {
      isCancelled = true
    }
  }, [tutorialRuntimeState.status])

  const isTutorialActive =
    tutorialRuntimeState.status === 'active' ||
    tutorialRuntimeState.status === 'loading'

  const tutorialStatusText = isTutorialActive
    ? 'Tutorial in progress...'
    : hasCompletedTutorial
      ? "You've completed the guided tour ✓"
      : 'New to vinela? Take the guided tour'

  const tutorialButtonText = isTutorialActive
    ? 'Tutorial Active'
    : hasCompletedTutorial
      ? 'Replay Tutorial'
      : 'Start Tutorial'

  // Use defaults while settings are loading — eliminates skeleton flash.
  // The difference between defaults and actual settings is imperceptible for
  // a single render frame, and the page updates in-place when real values arrive.
  const effectiveSettings = settings ?? getDefaultAppSettings()

  const handleThemeChange = async (
    theme: 'light' | 'dark' | 'system',
  ): Promise<void> => {
    const result = await updateSetting('theme', theme)
    if (result.success) {
      setTheme(theme)
      toast.success('Theme updated')
    }
  }

  const handleSettingReset = async <K extends keyof typeof SETTING_DEFAULTS>(
    key: K,
  ): Promise<void> => {
    const result = await resetSetting(key)
    if (result.success) {
      if (key === 'theme') {
        setTheme('system')
      }
      toast.success('Setting reset to default')
    }
  }

  const handleSettingChange = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ): Promise<boolean> => {
    const result = await updateSetting(key, value)
    return result.success
  }

  return (
    <ScrollArea className="h-full" data-tutorial="settings-page">
      <div className="mx-auto max-w-2xl space-y-8 p-6 pb-16">
        {/* Page header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Customize how the app looks and behaves.
          </p>
        </div>

        {/* Appearance */}
        <SettingsSection title="Appearance">
          <ThemeSelector
            value={effectiveSettings.theme}
            onChange={handleThemeChange}
            onReset={() => {
              void handleSettingReset('theme')
            }}
            canReset={effectiveSettings.theme !== SETTING_DEFAULTS.theme}
          />
        </SettingsSection>

        {/* Output */}
        <SettingsSection title="Output">
          <OutputPathSetting
            value={effectiveSettings.neovimOutputPath}
            onChange={(path) => {
              return handleSettingChange('neovimOutputPath', path)
            }}
          />
        </SettingsSection>

        {/* Graph Editor */}
        <SettingsSection title="Graph Editor">
          <SettingRow
            label="Auto-save Delay"
            description="How long to wait after you stop making changes before automatically saving."
            hint="Performance tip: if editing feels laggy, increase this to 2000-3000 ms."
            htmlFor="autosave-delay"
            canReset={
              getSettingWithDefault(effectiveSettings, 'autoSaveDelay') !==
              SETTING_DEFAULTS.autoSaveDelay
            }
            onReset={() => {
              void handleSettingReset('autoSaveDelay')
            }}
          >
            <NumberSetting
              id="autosave-delay"
              value={getSettingWithDefault(effectiveSettings, 'autoSaveDelay')}
              onChange={(v) => {
                void handleSettingChange('autoSaveDelay', v)
              }}
              min={200}
              max={5000}
              step={100}
              unit="ms"
              describedBy="autosave-delay-desc"
            />
          </SettingRow>

          <SettingRow
            label="Show Grid"
            description="Display a dot grid on the canvas background. Helps you align and organize your nodes visually."
            htmlFor="show-grid"
            canReset={
              getSettingWithDefault(effectiveSettings, 'showGrid') !==
              SETTING_DEFAULTS.showGrid
            }
            onReset={() => {
              void handleSettingReset('showGrid')
            }}
          >
            <ToggleSetting
              id="show-grid"
              checked={getSettingWithDefault(effectiveSettings, 'showGrid')}
              onCheckedChange={(v) => {
                void handleSettingChange('showGrid', v)
              }}
              describedBy="show-grid-desc"
            />
          </SettingRow>

          <SettingRow
            label="Snap to Grid"
            description="When you move nodes, they'll automatically jump to the nearest grid point. Makes it easy to keep things perfectly aligned."
            htmlFor="snap-to-grid"
            canReset={
              getSettingWithDefault(effectiveSettings, 'snapToGrid') !==
              SETTING_DEFAULTS.snapToGrid
            }
            onReset={() => {
              void handleSettingReset('snapToGrid')
            }}
          >
            <ToggleSetting
              id="snap-to-grid"
              checked={getSettingWithDefault(effectiveSettings, 'snapToGrid')}
              onCheckedChange={(v) => {
                void handleSettingChange('snapToGrid', v)
              }}
              describedBy="snap-to-grid-desc"
            />
          </SettingRow>

          <SettingRow
            label="Grid Spacing"
            description="The distance between grid points, in pixels. This controls both how dense the canvas grid looks and how far nodes jump when Snap to Grid is enabled."
            hint="Fine: 10px · Standard: 20px · Coarse: 40px"
            htmlFor="grid-spacing"
            canReset={
              getSettingWithDefault(effectiveSettings, 'gridSpacing') !==
              SETTING_DEFAULTS.gridSpacing
            }
            onReset={() => {
              void handleSettingReset('gridSpacing')
            }}
          >
            <NumberSetting
              id="grid-spacing"
              value={getSettingWithDefault(effectiveSettings, 'gridSpacing')}
              onChange={(v) => {
                void handleSettingChange('gridSpacing', v)
              }}
              min={5}
              max={100}
              step={5}
              unit="px"
              describedBy="grid-spacing-desc"
            />
          </SettingRow>

          <SettingRow
            label="Show Minimap"
            description="Like the minimap in VS Code, this shows a zoomed-out view of your entire graph in the corner."
            htmlFor="show-minimap"
            canReset={
              getSettingWithDefault(effectiveSettings, 'showMinimap') !==
              SETTING_DEFAULTS.showMinimap
            }
            onReset={() => {
              void handleSettingReset('showMinimap')
            }}
          >
            <ToggleSetting
              id="show-minimap"
              checked={getSettingWithDefault(effectiveSettings, 'showMinimap')}
              onCheckedChange={(v) => {
                void handleSettingChange('showMinimap', v)
              }}
              describedBy="show-minimap-desc"
            />
          </SettingRow>

          <SettingRow
            label="Confirm Before Deleting"
            description="Show a confirmation dialog before deleting nodes from the canvas. Prevents accidental deletions."
            hint="You can always undo deletions with Ctrl+Z, even with this turned off."
            htmlFor="confirm-delete"
            canReset={
              getSettingWithDefault(
                effectiveSettings,
                'confirmNodeDeletion',
              ) !== SETTING_DEFAULTS.confirmNodeDeletion
            }
            onReset={() => {
              void handleSettingReset('confirmNodeDeletion')
            }}
          >
            <ToggleSetting
              id="confirm-delete"
              checked={getSettingWithDefault(
                effectiveSettings,
                'confirmNodeDeletion',
              )}
              onCheckedChange={(v) => {
                void handleSettingChange('confirmNodeDeletion', v)
              }}
              describedBy="confirm-delete-desc"
            />
          </SettingRow>
        </SettingsSection>

        {/* Neovim Options */}
        <SettingsSection
          title="Neovim Options"
          description="Configure Neovim behavior for this project. These settings work alongside your automation graphs."
        >
          {currentProject ? (
            <NeovimOptionsLinkCard modifiedCount={modifiedCount} />
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/50">
              <p>Open a project to configure Neovim options.</p>
            </div>
          )}
        </SettingsSection>

        {/* Neovim */}
        <SettingsSection
          title="Neovim"
          description="Neovim installation status and config backups."
        >
          <div className="space-y-6">
            {/* Status subsection */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Installation</h3>
              <NeovimStatus />
            </div>

            {/* Backups subsection */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Config Backups</h3>
              <BackupManager />
            </div>
          </div>
        </SettingsSection>

        {/* Help & Tutorial */}
        <SettingsSection
          title="Help & Tutorial"
          description="Take a guided tour of the app's features."
          data-tutorial="settings-tutorial-section"
        >
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Interactive Tutorial</p>
                <p className="text-sm text-muted-foreground">
                  {tutorialStatusText}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isTutorialActive}
                onClick={() => {
                  void useTutorialStore.getState().startTutorial()
                }}
              >
                {tutorialButtonText}
              </Button>
            </CardContent>
          </Card>
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <AboutSection />
        </SettingsSection>
      </div>
    </ScrollArea>
  )
}
