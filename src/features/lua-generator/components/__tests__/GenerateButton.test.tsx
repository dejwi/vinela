import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGenerationStore } from '../../store'
import { GenerateButton } from '../GenerateButton'

// Mock the store
vi.mock('../../store', () => ({
  useGenerationStore: vi.fn(),
  selectIsOperationInProgress: vi.fn((state) => {
    if (state.dialogPhase.type === 'deploying') return true
    if (state.dialogPhase.type === 'generation') {
      const t = state.dialogPhase.progress.type
      return (
        t === 'validating' ||
        t === 'generating-sections' ||
        t === 'generating-graphs' ||
        t === 'validating-output'
      )
    }
    return false
  }),
}))

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipPrimitive.Provider>{children}</TooltipPrimitive.Provider>
)

describe('GenerateButton', () => {
  const mockOpenDialog = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders in idle state with play icon', () => {
    vi.mocked(useGenerationStore).mockImplementation((selector) => {
      const state = {
        openDialog: mockOpenDialog,
        dialogPhase: { type: 'pre-flight' },
        lastResult: null,
      }
      return selector ? selector(state as never) : state
    })

    render(<GenerateButton />, { wrapper: Wrapper })

    expect(screen.getByLabelText('Generate Lua Config')).toBeInTheDocument()
  })

  it('opens dialog when clicked', () => {
    vi.mocked(useGenerationStore).mockImplementation((selector) => {
      const state = {
        openDialog: mockOpenDialog,
        dialogPhase: { type: 'pre-flight' },
        lastResult: null,
      }
      return selector ? selector(state as never) : state
    })

    render(<GenerateButton />, { wrapper: Wrapper })

    const button = screen.getByLabelText('Generate Lua Config')
    button.click()

    expect(mockOpenDialog).toHaveBeenCalled()
  })

  it('shows error count badge when there are errors', () => {
    vi.mocked(useGenerationStore).mockImplementation((selector) => {
      const state = {
        openDialog: mockOpenDialog,
        dialogPhase: {
          type: 'generation',
          progress: {
            type: 'complete',
            result: {
              success: true,
              initLua: '-- test',
              diagnostics: [
                {
                  id: '1',
                  severity: 'error',
                  category: 'config',
                  message: 'Test error',
                },
                {
                  id: '2',
                  severity: 'warning',
                  category: 'config',
                  message: 'Test warning',
                },
              ],
              metadata: {
                graphsGenerated: 1,
                nodesGenerated: 1,
                pluginsConfigured: 0,
                linesOfCode: 10,
                generationTimeMs: 100,
                phaseTimingsMs: {},
              },
            },
          },
        },
        lastResult: {
          success: true,
          initLua: '-- test',
          diagnostics: [
            {
              id: '1',
              severity: 'error',
              category: 'config',
              message: 'Test error',
            },
            {
              id: '2',
              severity: 'warning',
              category: 'config',
              message: 'Test warning',
            },
          ],
          metadata: {
            graphsGenerated: 1,
            nodesGenerated: 1,
            pluginsConfigured: 0,
            linesOfCode: 10,
            generationTimeMs: 100,
            phaseTimingsMs: {},
          },
        },
      }
      return selector ? selector(state as never) : state
    })

    render(<GenerateButton />, { wrapper: Wrapper })

    // Should show badge with "2" (1 error + 1 warning)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('disables button during operation', () => {
    vi.mocked(useGenerationStore).mockImplementation((selector) => {
      const state = {
        openDialog: mockOpenDialog,
        dialogPhase: {
          type: 'generation',
          progress: { type: 'validating', checkName: 'test' },
        },
        lastResult: null,
      }
      return selector ? selector(state as never) : state
    })

    render(<GenerateButton />, { wrapper: Wrapper })

    const button = screen.getByLabelText('Generating...')
    expect(button).toBeDisabled()
  })
})
