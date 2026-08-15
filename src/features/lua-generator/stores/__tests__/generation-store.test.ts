import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type GenerationState,
  selectCanCancel,
  selectCanDeploy,
  selectCurrentResult,
  selectDiagnostics,
  selectIsOperationInProgress,
  useGenerationStore,
} from '../../store'
import type {
  DeployResult,
  GenerationDialogPhase,
  GenerationResult,
} from '../../types'

// Helper to create a base state
function createBaseState(
  overrides: Partial<GenerationState> = {},
): GenerationState {
  return {
    dialogOpen: false,
    dialogPhase: { type: 'pre-flight' },
    targetNeovimPreflight: { kind: 'idle' },
    lastResult: null,
    lastGeneratedAt: null,
    lastDeployResult: null,
    lastDeployedAt: null,
    activeAbortController: null,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    beginTargetNeovimPreflight: vi.fn(),
    restartGenerationPreflight: vi.fn(),
    generate: vi.fn(),
    cancelGeneration: vi.fn(),
    deploy: vi.fn(),
    resetForProjectClose: vi.fn(),
    ...overrides,
  }
}

// Helper to create a successful generation result
function createSuccessResult(
  diagnostics: GenerationResult['diagnostics'] = [],
): GenerationResult {
  return {
    success: true,
    initLua: '-- test',
    diagnostics,
    metadata: {
      graphsGenerated: 1,
      nodesGenerated: 2,
      pluginsConfigured: 0,
      linesOfCode: 5,
      generationTimeMs: 100,
      phaseTimingsMs: {},
    },
  }
}

// Helper to create a failed generation result
function createFailedResult(
  diagnostics: GenerationResult['diagnostics'] = [],
): GenerationResult {
  return {
    success: false,
    diagnostics,
    metadata: {
      graphsGenerated: 0,
      nodesGenerated: 0,
      pluginsConfigured: 0,
      linesOfCode: 0,
      generationTimeMs: 0,
      phaseTimingsMs: {},
    },
  }
}

describe('Generation Store Selectors', () => {
  describe('selectCurrentResult', () => {
    it('should return null when no result exists', () => {
      const state = createBaseState()
      expect(selectCurrentResult(state)).toBeNull()
    })

    it('should return lastResult when set', () => {
      const lastResult = createSuccessResult()
      const state = createBaseState({ lastResult })
      expect(selectCurrentResult(state)).toBe(lastResult)
    })

    it('should return result from complete generation phase', () => {
      const result = createSuccessResult()
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: { type: 'complete', result },
      }
      const state = createBaseState({ dialogPhase })
      expect(selectCurrentResult(state)).toBe(result)
    })

    it('should return result from deploying phase', () => {
      const result = createSuccessResult()
      const dialogPhase: GenerationDialogPhase = {
        type: 'deploying',
        result,
      }
      const state = createBaseState({ dialogPhase })
      expect(selectCurrentResult(state)).toBe(result)
    })

    it('should prioritize dialogPhase result over lastResult', () => {
      const dialogResult = createSuccessResult([
        { id: '1', severity: 'warning', category: 'config', message: 'test' },
      ])
      const lastResult = createSuccessResult()
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: { type: 'complete', result: dialogResult },
      }
      const state = createBaseState({ dialogPhase, lastResult })
      expect(selectCurrentResult(state)).toBe(dialogResult)
    })
  })

  describe('selectDiagnostics', () => {
    it('should return empty array when no result', () => {
      const state = createBaseState()
      expect(selectDiagnostics(state)).toEqual([])
    })

    it('should return diagnostics from current result', () => {
      const diagnostics = [
        {
          id: '1',
          severity: 'error' as const,
          category: 'config' as const,
          message: 'error',
        },
        {
          id: '2',
          severity: 'warning' as const,
          category: 'syntax' as const,
          message: 'warn',
        },
      ]
      const lastResult = createSuccessResult(diagnostics)
      const state = createBaseState({ lastResult })
      expect(selectDiagnostics(state)).toHaveLength(2)
    })
  })

  describe('selectCanDeploy', () => {
    it('should return false when no result', () => {
      const state = createBaseState()
      expect(selectCanDeploy(state)).toBe(false)
    })

    it('should return false when result failed', () => {
      const lastResult = createFailedResult()
      const state = createBaseState({ lastResult })
      expect(selectCanDeploy(state)).toBe(false)
    })

    it('should return false when result has errors', () => {
      const lastResult = createSuccessResult([
        { id: '1', severity: 'error', category: 'config', message: 'error' },
      ])
      const state = createBaseState({ lastResult })
      expect(selectCanDeploy(state)).toBe(false)
    })

    it('should return true when result success with no errors', () => {
      const lastResult = createSuccessResult([
        { id: '1', severity: 'warning', category: 'config', message: 'warn' },
      ])
      const state = createBaseState({ lastResult })
      expect(selectCanDeploy(state)).toBe(true)
    })

    it('should return true for successful result with empty diagnostics', () => {
      const lastResult = createSuccessResult([])
      const state = createBaseState({ lastResult })
      expect(selectCanDeploy(state)).toBe(true)
    })
  })

  describe('selectCanCancel', () => {
    it('should return false when not in generation phase', () => {
      const state = createBaseState({ dialogPhase: { type: 'pre-flight' } })
      expect(selectCanCancel(state)).toBe(false)
    })

    it('should return false when generation complete', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: { type: 'complete', result: createSuccessResult() },
      }
      const state = createBaseState({ dialogPhase })
      expect(selectCanCancel(state)).toBe(false)
    })

    it('should return false when generation errored', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: { type: 'error', error: 'failed' },
      }
      const state = createBaseState({ dialogPhase })
      expect(selectCanCancel(state)).toBe(false)
    })

    it('should return true when validating', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: { type: 'validating', checkName: 'test' },
      }
      const state = createBaseState({ dialogPhase })
      expect(selectCanCancel(state)).toBe(true)
    })

    it('should return true when generating sections', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: { type: 'generating-sections', sectionName: 'test' },
      }
      const state = createBaseState({ dialogPhase })
      expect(selectCanCancel(state)).toBe(true)
    })

    it('should return true when generating graphs', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: {
          type: 'generating-graphs',
          current: 1,
          total: 2,
          graphName: 'test',
        },
      }
      const state = createBaseState({ dialogPhase })
      expect(selectCanCancel(state)).toBe(true)
    })

    it('should return true when validating output', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: { type: 'validating-output' },
      }
      const state = createBaseState({ dialogPhase })
      expect(selectCanCancel(state)).toBe(true)
    })
  })

  describe('selectIsOperationInProgress', () => {
    it('should return false in pre-flight', () => {
      const state = createBaseState({ dialogPhase: { type: 'pre-flight' } })
      expect(selectIsOperationInProgress(state)).toBe(false)
    })

    it('should return false when generation complete', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: { type: 'complete', result: createSuccessResult() },
      }
      const state = createBaseState({ dialogPhase })
      expect(selectIsOperationInProgress(state)).toBe(false)
    })

    it('should return true when validating', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'generation',
        progress: { type: 'validating', checkName: 'test' },
      }
      const state = createBaseState({ dialogPhase })
      expect(selectIsOperationInProgress(state)).toBe(true)
    })

    it('should return true when deploying', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'deploying',
        result: createSuccessResult(),
      }
      const state = createBaseState({ dialogPhase })
      expect(selectIsOperationInProgress(state)).toBe(true)
    })

    it('should return false when deployed', () => {
      const dialogPhase: GenerationDialogPhase = {
        type: 'deployed',
        deployResult: {
          success: true,
          outputPath: '/test',
          backupCreated: false,
        } as DeployResult,
      }
      const state = createBaseState({ dialogPhase })
      expect(selectIsOperationInProgress(state)).toBe(false)
    })
  })
})

const resolveTargetNeovimSnapshot = vi.fn()
const generateInitLua = vi.fn()

vi.mock('../../lib/target-neovim', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../lib/target-neovim')>()
  return {
    ...actual,
    resolveTargetNeovimSnapshot: (...args: unknown[]) =>
      resolveTargetNeovimSnapshot(...args),
  }
})

vi.mock('../../orchestrator', () => ({
  generateInitLua: (...args: unknown[]) => generateInitLua(...args),
}))

vi.mock('@/features/projects/store', () => ({
  useProjectStore: {
    getState: vi.fn(() => ({
      currentProject: {
        absolutePath: '/tmp/project-b',
      },
    })),
  },
}))

describe('useGenerationStore restartGenerationPreflight', () => {
  beforeEach(() => {
    resolveTargetNeovimSnapshot.mockReset()
    useGenerationStore.getState().resetForProjectClose()
  })

  it('restarts preflight from an error state without generating', async () => {
    const snapshotA = {
      kind: 'detected' as const,
      version: '0.12.0',
      versionDisplay: 'NVIM v0.12.0',
    }
    let resolveB: ((value: typeof snapshotA) => void) | undefined
    const snapshotBPromise = new Promise<typeof snapshotA>((resolve) => {
      resolveB = resolve
    })

    resolveTargetNeovimSnapshot.mockReturnValueOnce(snapshotBPromise)

    useGenerationStore.setState((state) => {
      state.dialogOpen = true
      state.dialogPhase = {
        type: 'generation',
        progress: { type: 'error', error: 'boom' },
      }
      state.targetNeovimPreflight = {
        kind: 'ready',
        requestId: 1,
        snapshot: snapshotA,
      }
    })

    useGenerationStore.getState().restartGenerationPreflight()

    expect(resolveTargetNeovimSnapshot).toHaveBeenCalledTimes(1)
    expect(useGenerationStore.getState().dialogPhase).toEqual({
      type: 'pre-flight',
    })
    const loadingPreflight = useGenerationStore.getState().targetNeovimPreflight
    expect(loadingPreflight.kind).toBe('loading')
    const requestId =
      loadingPreflight.kind === 'loading' ? loadingPreflight.requestId : -1

    resolveB?.({
      kind: 'detected',
      version: '0.12.4',
      versionDisplay: 'NVIM v0.12.4',
    })
    await snapshotBPromise

    await vi.waitFor(() => {
      expect(useGenerationStore.getState().targetNeovimPreflight).toEqual({
        kind: 'ready',
        requestId,
        snapshot: {
          kind: 'detected',
          version: '0.12.4',
          versionDisplay: 'NVIM v0.12.4',
        },
      })
    })
  })

  it('ignores stale resolver completions after a newer restart', async () => {
    const snapshotA = {
      kind: 'detected' as const,
      version: '0.12.0',
      versionDisplay: 'NVIM v0.12.0',
    }
    const snapshotB = {
      kind: 'detected' as const,
      version: '0.12.4',
      versionDisplay: 'NVIM v0.12.4',
    }

    let resolveFirst: ((value: typeof snapshotA) => void) | undefined
    const firstPromise = new Promise<typeof snapshotA>((resolve) => {
      resolveFirst = resolve
    })

    resolveTargetNeovimSnapshot
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(snapshotB)

    useGenerationStore.setState((state) => {
      state.dialogOpen = true
      state.dialogPhase = {
        type: 'generation',
        progress: { type: 'error', error: 'boom' },
      }
      state.targetNeovimPreflight = {
        kind: 'ready',
        requestId: 1,
        snapshot: snapshotA,
      }
    })

    useGenerationStore.getState().restartGenerationPreflight()
    const firstLoading = useGenerationStore.getState().targetNeovimPreflight
    expect(firstLoading.kind).toBe('loading')
    const firstRequestId =
      firstLoading.kind === 'loading' ? firstLoading.requestId : -1

    useGenerationStore.getState().restartGenerationPreflight()

    await vi.waitFor(() => {
      const preflight = useGenerationStore.getState().targetNeovimPreflight
      expect(preflight.kind).toBe('ready')
      if (preflight.kind === 'ready') {
        expect(preflight.requestId).toBeGreaterThan(firstRequestId)
        expect(preflight.snapshot).toEqual(snapshotB)
      }
    })

    const readyPreflight = useGenerationStore.getState().targetNeovimPreflight
    expect(readyPreflight.kind).toBe('ready')
    const secondRequestId =
      readyPreflight.kind === 'ready' ? readyPreflight.requestId : -1

    resolveFirst?.({
      kind: 'detected',
      version: '9.9.9',
      versionDisplay: 'NVIM v9.9.9',
    })
    await firstPromise

    expect(useGenerationStore.getState().targetNeovimPreflight).toEqual({
      kind: 'ready',
      requestId: secondRequestId,
      snapshot: snapshotB,
    })
  })

  it('refuses to restart while generation is active', () => {
    useGenerationStore.setState((state) => {
      state.dialogOpen = true
      state.dialogPhase = {
        type: 'generation',
        progress: { type: 'validating', checkName: 'prepare-context' },
      }
    })

    useGenerationStore.getState().restartGenerationPreflight()

    expect(resolveTargetNeovimSnapshot).not.toHaveBeenCalled()
    expect(useGenerationStore.getState().dialogPhase).toEqual({
      type: 'generation',
      progress: { type: 'validating', checkName: 'prepare-context' },
    })
  })
})

describe('useGenerationStore preflight request identity', () => {
  beforeEach(() => {
    resolveTargetNeovimSnapshot.mockReset()
    useGenerationStore.getState().resetForProjectClose()
  })

  it('does not let a stale project-A resolver overwrite project-B after reset', async () => {
    const snapshotA = {
      kind: 'detected' as const,
      version: '0.12.0',
      versionDisplay: 'NVIM v0.12.0',
    }
    const snapshotB = {
      kind: 'detected' as const,
      version: '0.12.4',
      versionDisplay: 'NVIM v0.12.4',
    }

    let resolveA: ((value: typeof snapshotA) => void) | undefined
    let resolveB: ((value: typeof snapshotB) => void) | undefined
    const promiseA = new Promise<typeof snapshotA>((resolve) => {
      resolveA = resolve
    })
    const promiseB = new Promise<typeof snapshotB>((resolve) => {
      resolveB = resolve
    })

    resolveTargetNeovimSnapshot
      .mockReturnValueOnce(promiseA)
      .mockReturnValueOnce(promiseB)

    useGenerationStore.getState().openDialog()

    const preflightA = useGenerationStore.getState().targetNeovimPreflight
    expect(preflightA.kind).toBe('loading')
    const idA = preflightA.kind === 'loading' ? preflightA.requestId : -1

    useGenerationStore.getState().resetForProjectClose()
    useGenerationStore.getState().openDialog()

    const preflightBLoading =
      useGenerationStore.getState().targetNeovimPreflight
    expect(preflightBLoading.kind).toBe('loading')
    const idB =
      preflightBLoading.kind === 'loading' ? preflightBLoading.requestId : -1
    expect(idB).toBeGreaterThan(idA)

    resolveA?.(snapshotA)
    await promiseA
    await Promise.resolve()

    expect(useGenerationStore.getState().targetNeovimPreflight).toEqual({
      kind: 'loading',
      requestId: idB,
    })

    resolveB?.(snapshotB)
    await promiseB

    await vi.waitFor(() => {
      expect(useGenerationStore.getState().targetNeovimPreflight).toEqual({
        kind: 'ready',
        requestId: idB,
        snapshot: snapshotB,
      })
    })
  })
})

describe('useGenerationStore generate after retry', () => {
  beforeEach(() => {
    resolveTargetNeovimSnapshot.mockReset()
    generateInitLua.mockReset()
    useGenerationStore.getState().resetForProjectClose()
  })

  it('forwards the refreshed target Neovim snapshot during generate', async () => {
    const snapshotA = {
      kind: 'detected' as const,
      version: '0.12.0',
      versionDisplay: 'NVIM v0.12.0',
    }
    const snapshotB = {
      kind: 'detected' as const,
      version: '0.12.4',
      versionDisplay: 'NVIM v0.12.4',
    }

    let resolveB: ((value: typeof snapshotB) => void) | undefined
    const snapshotBPromise = new Promise<typeof snapshotB>((resolve) => {
      resolveB = resolve
    })

    resolveTargetNeovimSnapshot.mockReturnValueOnce(snapshotBPromise)

    useGenerationStore.setState((state) => {
      state.dialogOpen = true
      state.dialogPhase = {
        type: 'generation',
        progress: { type: 'error', error: 'boom' },
      }
      state.targetNeovimPreflight = {
        kind: 'ready',
        requestId: 1,
        snapshot: snapshotA,
      }
    })

    useGenerationStore.getState().restartGenerationPreflight()

    resolveB?.(snapshotB)
    await snapshotBPromise

    await vi.waitFor(() => {
      const preflight = useGenerationStore.getState().targetNeovimPreflight
      expect(preflight.kind).toBe('ready')
      if (preflight.kind === 'ready') {
        expect(preflight.snapshot).toEqual(snapshotB)
      }
    })

    const resolverCallsBeforeGenerate =
      resolveTargetNeovimSnapshot.mock.calls.length
    generateInitLua.mockResolvedValue(createSuccessResult())

    await useGenerationStore.getState().generate()

    expect(resolveTargetNeovimSnapshot.mock.calls.length).toBe(
      resolverCallsBeforeGenerate,
    )
    expect(generateInitLua).toHaveBeenCalledTimes(1)
    expect(generateInitLua).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: '/tmp/project-b',
        targetNeovim: snapshotB,
      }),
    )
    expect(generateInitLua.mock.calls[0]?.[0]?.targetNeovim).not.toEqual(
      snapshotA,
    )
  })
})
