/**
 * Phase 3 Step System Tests
 *
 * Tests for: TUTORIAL_STEPS, setup actions, TutorialProvider exports
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Top-level mocks ───────────────────────────────────────────────────────────

vi.mock('@/features/graph-editor/store', () => ({
  useGraphEditorStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
      setSelectedNodes: vi.fn(),
    })),
  }),
}))

vi.mock('@/features/plugins/store', () => ({
  usePluginStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({
      installedPlugins: [],
      setActiveTab: vi.fn(),
      setSearchQuery: vi.fn(),
      setSelectedCategory: vi.fn(),
      installPlugin: vi.fn().mockResolvedValue(undefined),
      uninstallPlugin: vi.fn().mockResolvedValue(undefined),
    })),
  }),
}))

vi.mock('@/features/projects/store', () => ({
  useProjectStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({
      currentProject: null,
    })),
  }),
}))

vi.mock('@/features/keymaps/store', () => ({
  useKeymapStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({
      manualKeymaps: [],
      graphKeymaps: [],
      initStatus: { status: 'idle' },
      loadAllKeymaps: vi.fn().mockResolvedValue(undefined),
    })),
  }),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import * as graphEditorStore from '@/features/graph-editor/store'
import {
  runSetupAction,
  SETUP_ACTIONS,
  type SetupActionId,
} from '../data/setup-actions'
import { TUTORIAL_STEPS } from '../data/steps'

// ─── Step Definitions Validation ─────────────────────────────────────────────

describe('TUTORIAL_STEPS validation', () => {
  it('has exactly 10 steps (v7 short flow)', () => {
    expect(TUTORIAL_STEPS).toHaveLength(10)
  })

  it('has unique step IDs', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('first step is welcome section with allowBack=false', () => {
    const first = TUTORIAL_STEPS[0]
    expect(first).toBeDefined()
    expect(first?.section).toBe('welcome')
    expect(first?.allowBack).toBe(false)
  })

  it('last step is conclusion section with allowBack=false', () => {
    const last = TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1]
    expect(last).toBeDefined()
    expect(last?.section).toBe('conclusion')
    expect(last?.allowBack).toBe(false)
  })

  it('every step has non-empty id, title, and content', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.id.length).toBeGreaterThan(0)
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.content.length).toBeGreaterThan(0)
    }
  })

  it('steps with target=null use "center" placement', () => {
    const centerSteps = TUTORIAL_STEPS.filter((s) => s.target === null)
    for (const step of centerSteps) {
      expect(step.tooltipPlacement).toBe('center')
    }
  })

  it('click-target steps have a non-null target', () => {
    const clickTargetSteps = TUTORIAL_STEPS.filter(
      (s) => s.advanceCondition.type === 'click-target',
    )
    for (const step of clickTargetSteps) {
      expect(step.target).not.toBeNull()
    }
  })

  it('every setupActionId references a registered action', () => {
    const stepsWithSetup = TUTORIAL_STEPS.filter(
      (s) => s.setupActionId !== undefined,
    )
    for (const step of stepsWithSetup) {
      const { setupActionId } = step
      expect(setupActionId).toBeDefined()
      if (setupActionId !== undefined) {
        expect(SETUP_ACTIONS[setupActionId]).toBeDefined()
      }
    }
  })

  it('sections appear in logical order (v7 flow: plugins/keymaps/options first)', () => {
    const sectionOrder = [
      'welcome',
      'plugins',
      'keymaps',
      'neovim-options',
      'colorschemes',
      'graph-editor',
      'settings',
      'conclusion',
    ]

    let lastSectionIndex = -1
    for (const step of TUTORIAL_STEPS) {
      const sectionIndex = sectionOrder.indexOf(step.section)
      expect(sectionIndex).toBeGreaterThanOrEqual(lastSectionIndex)
      lastSectionIndex = sectionIndex
    }
  })

  it('every requiredRoute is a valid app route or null', () => {
    const validRoutes = [
      '/editor',
      '/plugins',
      '/keymaps',
      '/neovim-options',
      '/colorschemes',
      '/settings',
      null,
    ]

    for (const step of TUTORIAL_STEPS) {
      expect(validRoutes).toContain(step.requiredRoute)
    }
  })

  it('all steps use click-next advance condition (v7 short flow)', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.advanceCondition.type).toBe('click-next')
    }
  })

  it('v7 steps have correct IDs in order', () => {
    const expectedIds = [
      'welcome',
      'plugins-overview',
      'plugin-install-hint',
      'keymaps-overview',
      'keymaps-create-hint',
      'options-overview',
      'colorschemes-overview',
      'graph-editor-brief',
      'settings-overview',
      'conclusion',
    ]
    const actualIds = TUTORIAL_STEPS.map((s) => s.id)
    expect(actualIds).toEqual(expectedIds)
  })

  it('graph-editor-brief step targets the graph canvas', () => {
    const step = TUTORIAL_STEPS.find((s) => s.id === 'graph-editor-brief')
    expect(step).toBeDefined()
    expect(step?.target).toBe('graph-canvas')
  })

  it('graph-editor-brief uses ensure-graph-sidebar-expanded setup action', () => {
    const step = TUTORIAL_STEPS.find((s) => s.id === 'graph-editor-brief')
    expect(step?.setupActionId).toBe('ensure-graph-sidebar-expanded')
  })
})

// ─── Setup Actions ────────────────────────────────────────────────────────────

describe('Setup actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ensure-graph-sidebar-expanded calls setSidebarCollapsed(false) when collapsed', () => {
    const mockSetSidebarCollapsed = vi.fn()
    vi.mocked(graphEditorStore.useGraphEditorStore.getState).mockReturnValue({
      sidebarCollapsed: true,
      setSidebarCollapsed: mockSetSidebarCollapsed,
    } as unknown as ReturnType<
      typeof graphEditorStore.useGraphEditorStore.getState
    >)

    const action = SETUP_ACTIONS['ensure-graph-sidebar-expanded']
    expect(action).toBeDefined()
    action?.()

    expect(mockSetSidebarCollapsed).toHaveBeenCalledWith(false)
  })

  it('ensure-graph-sidebar-expanded does not call setSidebarCollapsed when already expanded', () => {
    const mockSetSidebarCollapsed = vi.fn()
    vi.mocked(graphEditorStore.useGraphEditorStore.getState).mockReturnValue({
      sidebarCollapsed: false,
      setSidebarCollapsed: mockSetSidebarCollapsed,
    } as unknown as ReturnType<
      typeof graphEditorStore.useGraphEditorStore.getState
    >)

    const action = SETUP_ACTIONS['ensure-graph-sidebar-expanded']
    action?.()

    expect(mockSetSidebarCollapsed).not.toHaveBeenCalled()
  })

  it('runSetupAction handles unknown action IDs gracefully', async () => {
    // Should not throw
    await expect(runSetupAction('non-existent-action')).resolves.toBeUndefined()
  })

  it('runSetupAction calls the correct action by ID', async () => {
    const mockSetSidebarCollapsed = vi.fn()
    vi.mocked(graphEditorStore.useGraphEditorStore.getState).mockReturnValue({
      sidebarCollapsed: true,
      setSidebarCollapsed: mockSetSidebarCollapsed,
      setSelectedNodes: vi.fn(),
    } as unknown as ReturnType<
      typeof graphEditorStore.useGraphEditorStore.getState
    >)

    await runSetupAction('ensure-graph-sidebar-expanded')

    expect(mockSetSidebarCollapsed).toHaveBeenCalledWith(false)
  })

  it('SetupActionId rejects invalid IDs at compile time', () => {
    const validActionId: SetupActionId = 'prepare-plugins-browse'
    expect(validActionId).toBe('prepare-plugins-browse')

    // @ts-expect-error SetupActionId must stay a literal-key union.
    const invalidActionId: SetupActionId = 'prepare-plugin-brows'
    expect(invalidActionId).toBe('prepare-plugin-brows')
  })

  it('select-autocmd-node calls setSelectedNodes with correct node ID', () => {
    const mockSetSelectedNodes = vi.fn()
    vi.mocked(graphEditorStore.useGraphEditorStore.getState).mockReturnValue({
      sidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
      setSelectedNodes: mockSetSelectedNodes,
    } as unknown as ReturnType<
      typeof graphEditorStore.useGraphEditorStore.getState
    >)

    const action = SETUP_ACTIONS['select-autocmd-node']
    expect(action).toBeDefined()
    action?.()

    expect(mockSetSelectedNodes).toHaveBeenCalledWith([
      'tut-node-autocmd-yank-highlight',
    ])
  })

  it('select-callable-entry-node calls setSelectedNodes with correct node ID', () => {
    const mockSetSelectedNodes = vi.fn()
    vi.mocked(graphEditorStore.useGraphEditorStore.getState).mockReturnValue({
      sidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
      setSelectedNodes: mockSetSelectedNodes,
    } as unknown as ReturnType<
      typeof graphEditorStore.useGraphEditorStore.getState
    >)

    const action = SETUP_ACTIONS['select-callable-entry-node']
    expect(action).toBeDefined()
    action?.()

    expect(mockSetSelectedNodes).toHaveBeenCalledWith([
      'tut-node-callable-entry',
    ])
  })

  it('close-plugin-modal dispatches tutorial:close-plugin-modal event', () => {
    const dispatchedEvents: string[] = []
    const originalDispatch = window.dispatchEvent.bind(window)
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      dispatchedEvents.push(event.type)
      return originalDispatch(event)
    })

    const action = SETUP_ACTIONS['close-plugin-modal']
    expect(action).toBeDefined()
    action?.()

    expect(dispatchedEvents).toContain('tutorial:close-plugin-modal')
    vi.restoreAllMocks()
  })

  it('prepare-plugins-browse resets tab, search, and category', async () => {
    const mockSetActiveTab = vi.fn()
    const mockSetSearchQuery = vi.fn()
    const mockSetSelectedCategory = vi.fn()

    const { usePluginStore } = await import('@/features/plugins/store')
    vi.mocked(usePluginStore.getState).mockReturnValue({
      installedPlugins: [],
      setActiveTab: mockSetActiveTab,
      setSearchQuery: mockSetSearchQuery,
      setSelectedCategory: mockSetSelectedCategory,
      installPlugin: vi.fn(),
      uninstallPlugin: vi.fn(),
    } as unknown as ReturnType<typeof usePluginStore.getState>)

    const action = SETUP_ACTIONS['prepare-plugins-browse']
    expect(action).toBeDefined()
    action?.()

    expect(mockSetActiveTab).toHaveBeenCalledWith('browse')
    expect(mockSetSearchQuery).toHaveBeenCalledWith('')
    expect(mockSetSelectedCategory).toHaveBeenCalledWith(null)
  })

  it('select-graph-ref-node calls setSelectedNodes with correct node ID', () => {
    const mockSetSelectedNodes = vi.fn()
    vi.mocked(graphEditorStore.useGraphEditorStore.getState).mockReturnValue({
      sidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
      setSelectedNodes: mockSetSelectedNodes,
    } as unknown as ReturnType<
      typeof graphEditorStore.useGraphEditorStore.getState
    >)

    const action = SETUP_ACTIONS['select-graph-ref-node']
    expect(action).toBeDefined()
    action?.()

    expect(mockSetSelectedNodes).toHaveBeenCalledWith([
      'tut-node-graph-ref-telescope',
    ])
  })

  it('prepare-keymaps-page dispatches reset event and loads keymaps', async () => {
    const dispatchedEvents: string[] = []
    const originalDispatch = window.dispatchEvent.bind(window)
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      dispatchedEvents.push(event.type)
      return originalDispatch(event)
    })

    const { useKeymapStore } = await import('@/features/keymaps/store')
    const mockLoadAllKeymaps = vi.fn().mockResolvedValue(undefined)
    const { useProjectStore } = await import('@/features/projects/store')
    vi.mocked(useProjectStore.getState).mockReturnValue({
      currentProject: { absolutePath: '/test/project' },
    } as unknown as ReturnType<typeof useProjectStore.getState>)
    vi.mocked(useKeymapStore.getState).mockReturnValue({
      loadAllKeymaps: mockLoadAllKeymaps,
    } as unknown as ReturnType<typeof useKeymapStore.getState>)

    const action = SETUP_ACTIONS['prepare-keymaps-page']
    expect(action).toBeDefined()
    await action?.()

    expect(mockLoadAllKeymaps).toHaveBeenCalledWith('/test/project')
    expect(dispatchedEvents).toContain('tutorial:reset-keymaps-page-state')
    vi.restoreAllMocks()
  })

  it('ensure-keymap-editor-open dispatches tutorial:open-keymap-editor event', () => {
    const dispatchedEvents: string[] = []
    const originalDispatch = window.dispatchEvent.bind(window)
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      dispatchedEvents.push(event.type)
      return originalDispatch(event)
    })

    const action = SETUP_ACTIONS['ensure-keymap-editor-open']
    expect(action).toBeDefined()
    action?.()

    expect(dispatchedEvents).toContain('tutorial:open-keymap-editor')
    vi.restoreAllMocks()
  })

  it('close-keymap-editor dispatches tutorial:close-keymap-editor event', () => {
    const dispatchedEvents: string[] = []
    const originalDispatch = window.dispatchEvent.bind(window)
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      dispatchedEvents.push(event.type)
      return originalDispatch(event)
    })

    const action = SETUP_ACTIONS['close-keymap-editor']
    expect(action).toBeDefined()
    action?.()

    expect(dispatchedEvents).toContain('tutorial:close-keymap-editor')
    vi.restoreAllMocks()
  })

  it('reset-neovim-options-tutorial-state dispatches tutorial:reset-neovim-options-state event', () => {
    const dispatchedEvents: string[] = []
    const originalDispatch = window.dispatchEvent.bind(window)
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      dispatchedEvents.push(event.type)
      return originalDispatch(event)
    })

    const action = SETUP_ACTIONS['reset-neovim-options-tutorial-state']
    expect(action).toBeDefined()
    action?.()

    expect(dispatchedEvents).toContain('tutorial:reset-neovim-options-state')
    vi.restoreAllMocks()
  })

  it('clear-node-selection calls setSelectedNodes with empty array', () => {
    const mockSetSelectedNodes = vi.fn()
    vi.mocked(graphEditorStore.useGraphEditorStore.getState).mockReturnValue({
      sidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
      setSelectedNodes: mockSetSelectedNodes,
    } as unknown as ReturnType<
      typeof graphEditorStore.useGraphEditorStore.getState
    >)

    const action = SETUP_ACTIONS['clear-node-selection']
    expect(action).toBeDefined()
    action?.()

    expect(mockSetSelectedNodes).toHaveBeenCalledWith([])
  })

  it('center-on-callable-entry dispatches graph-editor:center-on-node event', () => {
    const dispatchedEvents: CustomEvent[] = []
    const originalDispatch = window.dispatchEvent.bind(window)
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      if (event instanceof CustomEvent) {
        dispatchedEvents.push(event)
      }
      return originalDispatch(event)
    })

    const action = SETUP_ACTIONS['center-on-callable-entry']
    expect(action).toBeDefined()
    action?.()

    expect(
      dispatchedEvents.some((e) => e.type === 'graph-editor:center-on-node'),
    ).toBe(true)
    const centerEvent = dispatchedEvents.find(
      (e) => e.type === 'graph-editor:center-on-node',
    )
    expect(centerEvent?.detail.nodeId).toBe('tut-node-callable-entry')
    vi.restoreAllMocks()
  })

  it('center-on-graph-ref dispatches graph-editor:center-on-node event for telescope node', () => {
    const dispatchedEvents: CustomEvent[] = []
    const originalDispatch = window.dispatchEvent.bind(window)
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      if (event instanceof CustomEvent) {
        dispatchedEvents.push(event)
      }
      return originalDispatch(event)
    })

    const action = SETUP_ACTIONS['center-on-graph-ref']
    expect(action).toBeDefined()
    action?.()

    expect(
      dispatchedEvents.some((e) => e.type === 'graph-editor:center-on-node'),
    ).toBe(true)
    const centerEvent = dispatchedEvents.find(
      (e) => e.type === 'graph-editor:center-on-node',
    )
    expect(centerEvent?.detail.nodeId).toBe('tut-node-graph-ref-telescope')
    vi.restoreAllMocks()
  })
})

// ─── Provider Integration (lightweight) ──────────────────────────────────────

describe('TutorialProvider exports', () => {
  it('exports are available from index.ts', async () => {
    const tutorialModule = await import('../index')
    expect(tutorialModule.TutorialProvider).toBeDefined()
    expect(tutorialModule.useTutorialStore).toBeDefined()
  })

  it('TUTORIAL_STEPS is importable and is a readonly array', () => {
    expect(Array.isArray(TUTORIAL_STEPS)).toBe(true)
    expect(TUTORIAL_STEPS.length).toBeGreaterThan(0)
  })
})
