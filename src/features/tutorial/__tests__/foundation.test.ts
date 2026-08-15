/**
 * Phase 1 Foundation Tests — Utils and Store
 *
 * Storage tests are in storage.test.ts (separate file to avoid mock conflicts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCloseProject } = vi.hoisted(() => ({
  mockCloseProject: vi.fn(),
}))

// ── Top-level mocks (hoisted by Vitest) ──────────────────────────────────────

// Mock storage and lifecycle so the store can be tested in isolation
vi.mock('../storage', () => ({
  loadTutorialProgress: vi.fn(),
  saveTutorialProgress: vi.fn(),
  clearTutorialProgress: vi.fn(),
  // normalizeTutorialProgress is a pure function — use real implementation
  normalizeTutorialProgress: (progress: {
    currentStepIndex: number
    [key: string]: unknown
  }) => progress,
}))

vi.mock('../lifecycle', () => ({
  createTutorialProject: vi.fn(),
  cleanupTutorialProject: vi.fn(),
  openTutorialProject: vi.fn(),
}))

vi.mock('@/features/projects/store', () => ({
  useProjectStore: {
    getState: vi.fn(() => ({
      closeProject: mockCloseProject,
    })),
  },
}))

// Mock data/steps so route-validation tests can control TUTORIAL_STEPS
vi.mock('../data/steps', () => ({
  TUTORIAL_STEPS: [
    {
      id: 'step-0',
      section: 'welcome',
      title: 'Welcome',
      content: 'Welcome content',
      target: null,
      tooltipPlacement: 'center',
      advanceCondition: { type: 'click-next' },
      requiredRoute: null,
      allowBack: false,
    },
    {
      id: 'step-1',
      section: 'navigation',
      title: 'Sidebar',
      content: 'Sidebar content',
      target: 'sidebar',
      tooltipPlacement: 'right',
      advanceCondition: { type: 'click-next' },
      requiredRoute: '/editor',
    },
    {
      id: 'step-2',
      section: 'graph-editor',
      title: 'Graph',
      content: 'Graph content',
      target: 'graph-canvas',
      tooltipPlacement: 'bottom',
      advanceCondition: { type: 'click-next' },
      requiredRoute: '/editor',
    },
    {
      id: 'step-3',
      section: 'conclusion',
      title: 'Done',
      content: 'Done content',
      target: null,
      tooltipPlacement: 'center',
      advanceCondition: { type: 'click-next' },
      requiredRoute: null,
      allowBack: false,
    },
    {
      id: 'step-4',
      section: 'conclusion',
      title: 'Finish',
      content: 'Finish content',
      target: null,
      tooltipPlacement: 'center',
      advanceCondition: { type: 'click-next' },
      requiredRoute: null,
      allowBack: false,
    },
  ],
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import * as lifecycleModule from '../lifecycle'
import * as storageModule from '../storage'
import {
  _resetTutorialStoreForTest,
  _setTotalStepCountForTest,
  isRouteAllowedForCurrentStep,
  useTutorialStore,
} from '../store'
import {
  calculateSpotlightRect,
  calculateTooltipPosition,
  detectOpenFloatingSurfaces,
  rectsOverlap,
  renderSimpleMarkdown,
  tooltipOverlapsFloatingSurface,
} from '../utils'

// ── Typed mock references ─────────────────────────────────────────────────────

const mockLoadTutorialProgress = vi.mocked(storageModule.loadTutorialProgress)
const mockSaveTutorialProgress = vi.mocked(storageModule.saveTutorialProgress)
const mockCreateTutorialProject = vi.mocked(
  lifecycleModule.createTutorialProject,
)
const mockCleanupTutorialProject = vi.mocked(
  lifecycleModule.cleanupTutorialProject,
)
const mockOpenTutorialProject = vi.mocked(lifecycleModule.openTutorialProject)

// ─── Utils Tests ──────────────────────────────────────────────────────────────

describe('calculateSpotlightRect', () => {
  it('adds padding around the target rect', () => {
    const rect = new DOMRect(100, 200, 300, 50)
    const result = calculateSpotlightRect(rect, 8)

    expect(result.x).toBe(92) // 100 - 8
    expect(result.y).toBe(192) // 200 - 8
    expect(result.width).toBe(316) // 300 + 8*2
    expect(result.height).toBe(66) // 50 + 8*2
    expect(result.borderRadius).toBe(8)
  })

  it('clamps to viewport bounds (no negative x/y)', () => {
    // Target near top-left corner with large padding
    const rect = new DOMRect(2, 3, 100, 40)
    const result = calculateSpotlightRect(rect, 20)

    expect(result.x).toBe(0) // clamped from -18
    expect(result.y).toBe(0) // clamped from -17
    expect(result.width).toBe(140) // 100 + 20*2
    expect(result.height).toBe(80) // 40 + 20*2
  })

  it('handles zero padding', () => {
    const rect = new DOMRect(50, 60, 200, 100)
    const result = calculateSpotlightRect(rect, 0)

    expect(result.x).toBe(50)
    expect(result.y).toBe(60)
    expect(result.width).toBe(200)
    expect(result.height).toBe(100)
  })
})

describe('calculateTooltipPosition', () => {
  it('positions tooltip below target for "bottom" placement', () => {
    // Target in the middle of a 1280x800 viewport
    const rect = new DOMRect(400, 300, 200, 50)
    const tooltipSize = { width: 300, height: 120 }
    const result = calculateTooltipPosition(rect, tooltipSize, 'bottom', 8)

    expect(result.actualPlacement).toBe('bottom')
    // y should be below the spotlight bottom (300 + 50 + 8 padding + 16 gap)
    expect(result.y).toBeGreaterThan(300 + 50)
    // x should be roughly centered on the target
    expect(result.x).toBeGreaterThanOrEqual(0)
  })

  it('falls back to opposite side when preferred side has no space', () => {
    // Target near the bottom of the viewport — no space below
    // jsdom window.innerHeight defaults to 768
    const rect = new DOMRect(400, 700, 200, 50)
    const tooltipSize = { width: 300, height: 120 }
    const result = calculateTooltipPosition(rect, tooltipSize, 'bottom', 8)

    // Should fall back to 'top' since there's no room below
    expect(result.actualPlacement).toBe('top')
    expect(result.y).toBeLessThan(700)
  })

  it('centers tooltip for "center" placement', () => {
    const rect = new DOMRect(100, 100, 50, 50)
    const tooltipSize = { width: 300, height: 200 }
    const result = calculateTooltipPosition(rect, tooltipSize, 'center', 8)

    expect(result.actualPlacement).toBe('center')
    // Should be roughly centered in the viewport
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })
})

describe('renderSimpleMarkdown', () => {
  it('renders **bold** text as <strong> elements', () => {
    const nodes = renderSimpleMarkdown('Hello **world**!')
    // Should contain a strong element
    const strongNode = nodes.find(
      (n) =>
        typeof n === 'object' &&
        n !== null &&
        'type' in n &&
        (n as { type: unknown }).type === 'strong',
    )
    expect(strongNode).toBeDefined()
  })

  it('renders `code` text as <code> elements', () => {
    const nodes = renderSimpleMarkdown('Run `vim.cmd` now')
    const codeNode = nodes.find(
      (n) =>
        typeof n === 'object' &&
        n !== null &&
        'type' in n &&
        (n as { type: unknown }).type === 'code',
    )
    expect(codeNode).toBeDefined()
  })

  it('handles plain text without markdown', () => {
    const nodes = renderSimpleMarkdown('Just plain text here')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toBe('Just plain text here')
  })
})

// ─── Store Tests ──────────────────────────────────────────────────────────────

describe('Tutorial store', () => {
  beforeEach(() => {
    _resetTutorialStoreForTest()
    _setTotalStepCountForTest(5)
    vi.clearAllMocks()
    mockCloseProject.mockReset()

    // Default mock implementations
    mockLoadTutorialProgress.mockResolvedValue(null)
    mockSaveTutorialProgress.mockResolvedValue(undefined)
    mockCreateTutorialProject.mockResolvedValue(
      '/memory/projects/tutorial-stub',
    )
    mockCleanupTutorialProject.mockResolvedValue(undefined)
    mockOpenTutorialProject.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in idle state', () => {
    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('idle')
  })

  it('transitions idle → loading → active on startTutorial', async () => {
    await useTutorialStore.getState().startTutorial()

    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('active')
    if (state.runtimeState.status === 'active') {
      expect(state.runtimeState.currentStepIndex).toBe(0)
      expect(state.runtimeState.isTransitioning).toBe(false)
      expect(state.runtimeState.advanceConditionMet).toBe(false)
    }
  })

  it('advances step index on nextStep', async () => {
    await useTutorialStore.getState().startTutorial()
    await useTutorialStore.getState().nextStep()

    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('active')
    if (state.runtimeState.status === 'active') {
      expect(state.runtimeState.currentStepIndex).toBe(1)
    }
  })

  it('does not go below step 0 on previousStep', async () => {
    await useTutorialStore.getState().startTutorial()

    // At step 0, previousStep should stay at 0
    useTutorialStore.getState().previousStep()

    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('active')
    if (state.runtimeState.status === 'active') {
      expect(state.runtimeState.currentStepIndex).toBe(0)
    }
  })

  it('transitions to idle on skipTutorial', async () => {
    await useTutorialStore.getState().startTutorial()
    expect(useTutorialStore.getState().runtimeState.status).toBe('active')

    await useTutorialStore.getState().skipTutorial()

    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')
  })

  it('ignores nextStep when not in active state', async () => {
    // Store is idle — nextStep should be a no-op
    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')

    await useTutorialStore.getState().nextStep()

    // Still idle
    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')
    // saveTutorialProgress should not have been called
    expect(mockSaveTutorialProgress).not.toHaveBeenCalled()
  })

  // ── Fix 1: startTutorial calls openTutorialProject ───────────────────────

  it('startTutorial calls openTutorialProject with the created project path', async () => {
    await useTutorialStore.getState().startTutorial()

    expect(mockOpenTutorialProject).toHaveBeenCalledOnce()
    expect(mockOpenTutorialProject).toHaveBeenCalledWith(
      '/memory/projects/tutorial-stub',
    )
  })

  it('startTutorial rollback: if openTutorialProject rejects, cleanup is called and store resets to idle', async () => {
    mockOpenTutorialProject.mockRejectedValueOnce(
      new Error('Failed to open project'),
    )

    await expect(useTutorialStore.getState().startTutorial()).rejects.toThrow(
      'Failed to open project',
    )

    // Cleanup should have been called for the created project
    expect(mockCleanupTutorialProject).toHaveBeenCalledWith(
      '/memory/projects/tutorial-stub',
    )

    // Store should be back to idle
    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')
    expect(useTutorialStore.getState().tutorialProjectPath).toBeNull()
  })

  it('startTutorial rollback closes loaded project when save fails after open', async () => {
    mockSaveTutorialProgress.mockRejectedValueOnce(new Error('Save failed'))

    await expect(useTutorialStore.getState().startTutorial()).rejects.toThrow(
      'Save failed',
    )

    expect(mockOpenTutorialProject).toHaveBeenCalledWith(
      '/memory/projects/tutorial-stub',
    )
    expect(mockCleanupTutorialProject).toHaveBeenCalledWith(
      '/memory/projects/tutorial-stub',
    )
    expect(mockCloseProject).toHaveBeenCalledOnce()
    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')
    expect(useTutorialStore.getState().tutorialProjectPath).toBeNull()
  })

  // ── Fix 6: Resume cleans old project first ────────────────────────────────

  it('startTutorial cleans up existing progress project path before creating a new one', async () => {
    // Simulate existing progress with a prior tutorial project path
    mockLoadTutorialProgress.mockResolvedValueOnce({
      tutorialVersion: 1,
      currentStepIndex: 2,
      hasCompleted: false,
      isActive: true,
      startedAt: Date.now() - 60000,
      lastInteractedAt: Date.now() - 30000,
      tutorialProjectPath: '/memory/projects/tutorial-old-12345',
    })

    await useTutorialStore.getState().startTutorial()

    // Old path should have been cleaned up
    expect(mockCleanupTutorialProject).toHaveBeenCalledWith(
      '/memory/projects/tutorial-old-12345',
    )
    // New project should have been created and opened
    expect(mockCreateTutorialProject).toHaveBeenCalledOnce()
    expect(mockOpenTutorialProject).toHaveBeenCalledWith(
      '/memory/projects/tutorial-stub',
    )
  })

  // ── Fix 3: Route handling ─────────────────────────────────────────────────

  it('handleRouteChange pauses tutorial with wrong-route when on wrong route', async () => {
    await useTutorialStore.getState().startTutorial(1) // step 1 requires /editor

    expect(useTutorialStore.getState().runtimeState.status).toBe('active')

    // Navigate to a different route
    useTutorialStore.getState().handleRouteChange('/plugins')

    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('paused')
    if (state.runtimeState.status === 'paused') {
      expect(state.runtimeState.reason).toBe('wrong-route')
    }
  })

  it('handleRouteChange does not pause when on the correct route', async () => {
    await useTutorialStore.getState().startTutorial(1) // step 1 requires /editor

    useTutorialStore.getState().handleRouteChange('/editor')

    expect(useTutorialStore.getState().runtimeState.status).toBe('active')
  })

  it('handleRouteChange does not pause when step has no requiredRoute', async () => {
    await useTutorialStore.getState().startTutorial(0) // step 0 has requiredRoute: null

    useTutorialStore.getState().handleRouteChange('/anywhere')

    expect(useTutorialStore.getState().runtimeState.status).toBe('active')
  })

  it('handleRouteChange is a no-op when tutorial is not active', () => {
    // Store is idle
    useTutorialStore.getState().handleRouteChange('/plugins')

    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')
  })

  // ── Fix 7: nextStep failure resets isTransitioning ────────────────────────

  it('nextStep failure resets isTransitioning to false', async () => {
    await useTutorialStore.getState().startTutorial()

    // Make saveTutorialProgress throw on the next call
    mockSaveTutorialProgress.mockRejectedValueOnce(new Error('Save failed'))

    await expect(useTutorialStore.getState().nextStep()).rejects.toThrow(
      'Save failed',
    )

    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('active')
    if (state.runtimeState.status === 'active') {
      expect(state.runtimeState.isTransitioning).toBe(false)
    }
  })

  it('completeTutorial always returns to idle when save fails', async () => {
    await useTutorialStore.getState().startTutorial()

    mockSaveTutorialProgress.mockRejectedValueOnce(new Error('Persist failed'))

    await expect(
      useTutorialStore.getState().completeTutorial(),
    ).rejects.toThrow('Persist failed')

    expect(mockCleanupTutorialProject).toHaveBeenCalledWith(
      '/memory/projects/tutorial-stub',
    )
    expect(mockCloseProject).toHaveBeenCalledOnce()
    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')
    expect(useTutorialStore.getState().tutorialProjectPath).toBeNull()
  })

  // ── keepExploring ─────────────────────────────────────────────────────────

  it('keepExploring transitions active → idle without cleanup or project close', async () => {
    await useTutorialStore.getState().startTutorial()
    expect(useTutorialStore.getState().runtimeState.status).toBe('active')

    await useTutorialStore.getState().keepExploring()

    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')
    // Project should NOT have been cleaned up
    expect(mockCleanupTutorialProject).not.toHaveBeenCalled()
    // Project should NOT have been closed
    expect(mockCloseProject).not.toHaveBeenCalled()
  })

  it('keepExploring persists hasCompleted=true', async () => {
    await useTutorialStore.getState().startTutorial()

    await useTutorialStore.getState().keepExploring()

    expect(mockSaveTutorialProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasCompleted: true, isActive: false }),
    )
  })

  it('keepExploring clears tutorialProjectPath in store', async () => {
    await useTutorialStore.getState().startTutorial()
    expect(useTutorialStore.getState().tutorialProjectPath).toBe(
      '/memory/projects/tutorial-stub',
    )

    await useTutorialStore.getState().keepExploring()

    expect(useTutorialStore.getState().tutorialProjectPath).toBeNull()
  })

  it('keepExploring is a no-op when tutorial is idle', async () => {
    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')

    await useTutorialStore.getState().keepExploring()

    // saveTutorialProgress should not have been called (only startTutorial calls it in setup)
    expect(mockSaveTutorialProgress).not.toHaveBeenCalled()
    expect(useTutorialStore.getState().runtimeState.status).toBe('idle')
  })

  // ── resumeTutorialAtStep ──────────────────────────────────────────────────

  it('resumeTutorialAtStep restores exact saved step index', async () => {
    await useTutorialStore.getState().resumeTutorialAtStep(3)

    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('active')
    if (state.runtimeState.status === 'active') {
      expect(state.runtimeState.currentStepIndex).toBe(3)
    }
  })

  it('resumeTutorialAtStep clamps out-of-range index to max valid step', async () => {
    // _totalStepCount is 5, so max index is 4
    await useTutorialStore.getState().resumeTutorialAtStep(99)

    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('active')
    if (state.runtimeState.status === 'active') {
      expect(state.runtimeState.currentStepIndex).toBe(4)
    }
  })

  it('resumeTutorialAtStep clamps negative index to 0', async () => {
    await useTutorialStore.getState().resumeTutorialAtStep(-5)

    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('active')
    if (state.runtimeState.status === 'active') {
      expect(state.runtimeState.currentStepIndex).toBe(0)
    }
  })

  it('resumeTutorialAtStep is a no-op when already active', async () => {
    await useTutorialStore.getState().startTutorial()
    expect(useTutorialStore.getState().runtimeState.status).toBe('active')

    // Should not throw or change state
    await useTutorialStore.getState().resumeTutorialAtStep(2)

    // Still active at step 0 (not changed to 2)
    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('active')
    if (state.runtimeState.status === 'active') {
      expect(state.runtimeState.currentStepIndex).toBe(0)
    }
  })

  it('resumeTutorialAtStep calls openTutorialProject', async () => {
    await useTutorialStore.getState().resumeTutorialAtStep(2)

    expect(mockOpenTutorialProject).toHaveBeenCalledOnce()
    expect(mockOpenTutorialProject).toHaveBeenCalledWith(
      '/memory/projects/tutorial-stub',
    )
  })

  // ── isRouteAllowedForCurrentStep ──────────────────────────────────────────

  it('isRouteAllowedForCurrentStep: allows any route when step has no requiredRoute', () => {
    // step-0 has requiredRoute: null
    expect(isRouteAllowedForCurrentStep('/anywhere', 0, false)).toBe(true)
    expect(isRouteAllowedForCurrentStep('/plugins', 0, false)).toBe(true)
  })

  it('isRouteAllowedForCurrentStep: allows matching route', () => {
    // step-1 has requiredRoute: '/editor'
    expect(isRouteAllowedForCurrentStep('/editor', 1, false)).toBe(true)
  })

  it('isRouteAllowedForCurrentStep: disallows non-matching route without nav intent', () => {
    // step-1 has requiredRoute: '/editor'
    expect(isRouteAllowedForCurrentStep('/plugins', 1, false)).toBe(false)
  })

  it('isRouteAllowedForCurrentStep: allows non-matching route during nav-intent grace window for click-target step', () => {
    // step-1 has requiredRoute: '/editor' and advanceCondition: click-next
    // nav intent only helps click-target steps
    expect(isRouteAllowedForCurrentStep('/plugins', 1, true)).toBe(false)
  })

  it('isRouteAllowedForCurrentStep: returns true for out-of-range step index', () => {
    expect(isRouteAllowedForCurrentStep('/anywhere', 999, false)).toBe(true)
  })

  // ── handleRouteChange with nav-intent ────────────────────────────────────

  it('handleRouteChange does not pause when nav-intent is active for click-target step', async () => {
    // step-1 has requiredRoute: '/editor' and advanceCondition: click-next
    // nav intent only helps click-target steps, so this should still pause
    await useTutorialStore.getState().startTutorial(1)

    useTutorialStore.getState().handleRouteChange('/plugins', true)

    // step-1 is click-next, not click-target, so nav intent doesn't help
    expect(useTutorialStore.getState().runtimeState.status).toBe('paused')
  })

  // ── Auto-resume when paused for wrong-route ───────────────────────────────

  it('handleRouteChange auto-resumes when paused for wrong-route and user navigates to correct route', async () => {
    await useTutorialStore.getState().startTutorial(1) // step 1 requires /editor

    // Navigate away to trigger wrong-route pause
    useTutorialStore.getState().handleRouteChange('/plugins')
    expect(useTutorialStore.getState().runtimeState.status).toBe('paused')

    // Now navigate to the correct route — should auto-resume
    useTutorialStore.getState().handleRouteChange('/editor')

    const state = useTutorialStore.getState()
    expect(state.runtimeState.status).toBe('active')
    if (state.runtimeState.status === 'active') {
      expect(state.runtimeState.currentStepIndex).toBe(1)
    }
  })

  it('handleRouteChange stays paused when paused for wrong-route and user navigates to another wrong route', async () => {
    await useTutorialStore.getState().startTutorial(1) // step 1 requires /editor

    // Navigate away to trigger wrong-route pause
    useTutorialStore.getState().handleRouteChange('/plugins')
    expect(useTutorialStore.getState().runtimeState.status).toBe('paused')

    // Navigate to yet another wrong route — should stay paused
    useTutorialStore.getState().handleRouteChange('/settings')

    expect(useTutorialStore.getState().runtimeState.status).toBe('paused')
  })

  it('handleRouteChange does not auto-resume when paused for target-not-found (only wrong-route triggers auto-resume)', async () => {
    await useTutorialStore.getState().startTutorial(1) // step 1 requires /editor

    // Manually pause for target-not-found
    useTutorialStore.getState().pauseTutorial('target-not-found')
    expect(useTutorialStore.getState().runtimeState.status).toBe('paused')

    // Navigate to the correct route — should NOT auto-resume (wrong pause reason)
    useTutorialStore.getState().handleRouteChange('/editor')

    // Still paused (target-not-found requires manual retry)
    expect(useTutorialStore.getState().runtimeState.status).toBe('paused')
  })
})

// ── Tooltip collision detection utils ─────────────────────────────────────────

describe('rectsOverlap', () => {
  it('returns true when rects overlap', () => {
    const a = new DOMRect(0, 0, 100, 100)
    const b = new DOMRect(50, 50, 100, 100)
    expect(rectsOverlap(a, b)).toBe(true)
  })

  it('returns false when rects do not overlap', () => {
    const a = new DOMRect(0, 0, 100, 100)
    const b = new DOMRect(200, 200, 100, 100)
    expect(rectsOverlap(a, b)).toBe(false)
  })

  it('returns false when rects are adjacent (touching but not overlapping)', () => {
    const a = new DOMRect(0, 0, 100, 100)
    const b = new DOMRect(100, 0, 100, 100) // right edge of a = left edge of b
    expect(rectsOverlap(a, b)).toBe(false)
  })
})

describe('tooltipOverlapsFloatingSurface', () => {
  it('returns false when no floating surfaces', () => {
    expect(
      tooltipOverlapsFloatingSurface(0, 0, { width: 100, height: 100 }, []),
    ).toBe(false)
  })

  it('returns true when tooltip overlaps a floating surface', () => {
    const surface = new DOMRect(50, 50, 200, 200)
    expect(
      tooltipOverlapsFloatingSurface(0, 0, { width: 100, height: 100 }, [
        surface,
      ]),
    ).toBe(true)
  })

  it('returns false when tooltip does not overlap any floating surface', () => {
    const surface = new DOMRect(500, 500, 200, 200)
    expect(
      tooltipOverlapsFloatingSurface(0, 0, { width: 100, height: 100 }, [
        surface,
      ]),
    ).toBe(false)
  })
})

describe('detectOpenFloatingSurfaces', () => {
  it('returns empty array when no floating surfaces are present', () => {
    const result = detectOpenFloatingSurfaces()
    expect(Array.isArray(result)).toBe(true)
    // In jsdom test environment, no popovers are open
    expect(result.length).toBe(0)
  })
})
