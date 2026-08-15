import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectStore } from '@/features/projects/store'
import { useGenerationStore } from '../../store'
import { GenerateDialog } from '../GenerateDialog'

vi.mock('@/features/projects/store', () => ({
  useProjectStore: vi.fn(),
}))

const resolveTargetNeovimSnapshot = vi.fn()

vi.mock('../../lib/target-neovim', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../lib/target-neovim')>()
  return {
    ...actual,
    resolveTargetNeovimSnapshot: (...args: unknown[]) =>
      resolveTargetNeovimSnapshot(...args),
  }
})

function mockProjectStore(): void {
  vi.mocked(useProjectStore).mockImplementation((selector) => {
    const state = {
      currentProject: {
        id: 'project-1',
        absolutePath: '/tmp/project',
      },
    }
    return selector ? selector(state as never) : (state as never)
  })
}

describe('GenerateDialog restart preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProjectStore()
    useGenerationStore.getState().resetForProjectClose()
    resolveTargetNeovimSnapshot.mockReset()
  })

  it('Try Again refreshes preflight without calling generate()', async () => {
    const user = userEvent.setup()
    const generateSpy = vi
      .spyOn(useGenerationStore.getState(), 'generate')
      .mockResolvedValue(undefined)

    resolveTargetNeovimSnapshot.mockResolvedValue({
      kind: 'detected',
      version: '0.12.4',
      versionDisplay: 'NVIM v0.12.4',
    })

    useGenerationStore.setState((state) => {
      state.dialogOpen = true
      state.dialogPhase = {
        type: 'generation',
        progress: { type: 'error', error: 'Generation failed' },
      }
      state.targetNeovimPreflight = {
        kind: 'ready',
        requestId: 1,
        snapshot: {
          kind: 'detected',
          version: '0.12.0',
          versionDisplay: 'NVIM v0.12.0',
        },
      }
    })

    render(<GenerateDialog />)

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(resolveTargetNeovimSnapshot).toHaveBeenCalledTimes(1)
    expect(generateSpy).not.toHaveBeenCalled()
    expect(useGenerationStore.getState().dialogPhase).toEqual({
      type: 'pre-flight',
    })

    await waitFor(() => {
      expect(useGenerationStore.getState().targetNeovimPreflight).toMatchObject(
        {
          kind: 'ready',
          snapshot: {
            kind: 'detected',
            version: '0.12.4',
            versionDisplay: 'NVIM v0.12.4',
          },
        },
      )
    })

    generateSpy.mockRestore()
  })

  it('Regenerate uses the same restart preflight action', async () => {
    const user = userEvent.setup()
    const generateSpy = vi
      .spyOn(useGenerationStore.getState(), 'generate')
      .mockResolvedValue(undefined)

    resolveTargetNeovimSnapshot.mockResolvedValue({
      kind: 'detected',
      version: '0.12.4',
      versionDisplay: 'NVIM v0.12.4',
    })

    useGenerationStore.setState((state) => {
      state.dialogOpen = true
      state.dialogPhase = {
        type: 'generation',
        progress: {
          type: 'complete',
          result: {
            success: true,
            initLua: '-- ok',
            diagnostics: [],
            metadata: {
              graphsGenerated: 0,
              nodesGenerated: 0,
              pluginsConfigured: 0,
              linesOfCode: 1,
              generationTimeMs: 1,
              phaseTimingsMs: {},
            },
          },
        },
      }
      state.targetNeovimPreflight = {
        kind: 'ready',
        requestId: 1,
        snapshot: {
          kind: 'detected',
          version: '0.12.0',
          versionDisplay: 'NVIM v0.12.0',
        },
      }
    })

    render(<GenerateDialog />)

    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    expect(resolveTargetNeovimSnapshot).toHaveBeenCalledTimes(1)
    expect(generateSpy).not.toHaveBeenCalled()
    expect(useGenerationStore.getState().dialogPhase).toEqual({
      type: 'pre-flight',
    })

    generateSpy.mockRestore()
  })
})
