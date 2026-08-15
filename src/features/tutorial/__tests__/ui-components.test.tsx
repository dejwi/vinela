/**
 * Phase 2 UI Component Tests
 *
 * Tests for: useSkipButtonTimer, TutorialOverlay, TutorialControls, TutorialTooltip
 *
 * @vitest-environment jsdom
 */
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Dialog,
  DialogContentNoClose,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { TutorialConclusionStep } from '../components/TutorialConclusionStep'
import { TutorialControls } from '../components/TutorialControls'
import { TutorialOverlay } from '../components/TutorialOverlay'
import { TutorialTooltip } from '../components/TutorialTooltip'
import { useClickTargetFallbackTimer } from '../hooks/useClickTargetFallbackTimer'
import { useSkipButtonTimer } from '../hooks/useSkipButtonTimer'

// ── useClickTargetFallbackTimer ───────────────────────────────────────────────

// Canonical fallback duration from hook implementation (20 seconds)
const CLICK_TARGET_FALLBACK_MS = 20000

describe('useClickTargetFallbackTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with fallbackElapsed=false for a click-target step', () => {
    const { result } = renderHook(() =>
      useClickTargetFallbackTimer('test-click-target-step', true),
    )
    expect(result.current.fallbackElapsed).toBe(false)
  })

  it('sets fallbackElapsed=true after fallback duration', async () => {
    const { result } = renderHook(() =>
      useClickTargetFallbackTimer('test-click-target-step', true),
    )

    expect(result.current.fallbackElapsed).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(CLICK_TARGET_FALLBACK_MS)
    })

    expect(result.current.fallbackElapsed).toBe(true)
  })

  it('does not elapse when isClickTargetStep is false', async () => {
    const { result } = renderHook(() =>
      useClickTargetFallbackTimer('graph-canvas', false),
    )

    await act(async () => {
      vi.advanceTimersByTime(CLICK_TARGET_FALLBACK_MS)
    })

    expect(result.current.fallbackElapsed).toBe(false)
  })

  it('resets fallbackElapsed when stepId changes', async () => {
    const { result, rerender } = renderHook(
      ({ stepId }: { stepId: string }) =>
        useClickTargetFallbackTimer(stepId, true),
      { initialProps: { stepId: 'test-step-1' } },
    )

    // Elapse the timer on the first step (20 seconds)
    await act(async () => {
      vi.advanceTimersByTime(CLICK_TARGET_FALLBACK_MS)
    })
    expect(result.current.fallbackElapsed).toBe(true)

    // Advance to a new step — should reset
    rerender({ stepId: 'add-node-button' })

    expect(result.current.fallbackElapsed).toBe(false)
  })

  it('does not elapse when stepId is null', async () => {
    const { result } = renderHook(() => useClickTargetFallbackTimer(null, true))

    await act(async () => {
      vi.advanceTimersByTime(CLICK_TARGET_FALLBACK_MS)
    })

    expect(result.current.fallbackElapsed).toBe(false)
  })
})

// ── useSkipButtonTimer ────────────────────────────────────────────────────────

describe('useSkipButtonTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts disabled with 5 seconds remaining when active', () => {
    const { result } = renderHook(() => useSkipButtonTimer(true))

    expect(result.current.isEnabled).toBe(false)
    expect(result.current.remainingSeconds).toBe(5)
  })

  it('enables after 5 seconds', async () => {
    const { result } = renderHook(() => useSkipButtonTimer(true))

    expect(result.current.isEnabled).toBe(false)

    // Advance past the 5-second threshold
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.isEnabled).toBe(true)
  })

  it('resets when isActive changes to false', async () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useSkipButtonTimer(active),
      { initialProps: { active: true } },
    )

    // Advance 3 seconds (still counting down)
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.isEnabled).toBe(false)
    expect(result.current.remainingSeconds).toBeLessThan(5)

    // Deactivate — should reset
    rerender({ active: false })

    expect(result.current.isEnabled).toBe(false)
    expect(result.current.remainingSeconds).toBe(5)
  })
})

// ── TutorialOverlay ───────────────────────────────────────────────────────────

describe('TutorialOverlay', () => {
  const baseProps = {
    targetRect: null,
    spotlightPadding: 8,
    isActive: true,
    status: 'active' as const,
    targetName: 'Add Node Button',
    onRetry: vi.fn(),
    onSkip: vi.fn(),
    blockInteractions: false,
  }

  it('renders overlay when isActive is true', () => {
    render(<TutorialOverlay {...baseProps} />)
    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument()
  })

  it('does not render when isActive is false and status is not paused', () => {
    render(<TutorialOverlay {...baseProps} isActive={false} status="idle" />)
    expect(screen.queryByTestId('tutorial-overlay')).not.toBeInTheDocument()
  })

  it('renders SVG mask with cutout rect when targetRect is provided', () => {
    const targetRect = new DOMRect(100, 200, 300, 50)
    const { container } = render(
      <TutorialOverlay {...baseProps} targetRect={targetRect} />,
    )

    // The SVG mask should contain a cutout rect (black fill)
    const maskRects = container.querySelectorAll('mask rect')
    // First rect is the white background, second is the black cutout
    expect(maskRects.length).toBe(2)

    const cutoutRect = maskRects[1]
    expect(cutoutRect).toBeDefined()
    expect(cutoutRect?.getAttribute('fill')).toBe('black')
  })

  it('renders no cutout rect when targetRect is null (center step)', () => {
    const { container } = render(
      <TutorialOverlay {...baseProps} targetRect={null} />,
    )

    // Only the white background rect should be in the mask
    const maskRects = container.querySelectorAll('mask rect')
    expect(maskRects.length).toBe(1)
    expect(maskRects[0]?.getAttribute('fill')).toBe('white')
  })

  it('shows paused overlay with retry and skip buttons when status is paused', () => {
    const onRetry = vi.fn()
    const onSkip = vi.fn()

    render(
      <TutorialOverlay
        {...baseProps}
        isActive={false}
        status="paused"
        targetName="Graph Canvas"
        onRetry={onRetry}
        onSkip={onSkip}
      />,
    )

    expect(screen.getByTestId('tutorial-paused-overlay')).toBeInTheDocument()
    expect(screen.getByText(/Graph Canvas/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: /skip tutorial/i }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('shows navigation CTA when paused due to wrong route', () => {
    const onNavigate = vi.fn()

    render(
      <TutorialOverlay
        {...baseProps}
        isActive={false}
        status="paused"
        pauseReason="wrong-route"
        requiredRoute="/editor"
        onNavigate={onNavigate}
      />,
    )

    const navButton = screen.getByRole('button', {
      name: /go to required page/i,
    })
    expect(navButton).toBeInTheDocument()
    fireEvent.click(navButton)
    expect(onNavigate).toHaveBeenCalledWith('/editor')
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
  })

  it('shows setup action error and retry CTA when paused due to setup-action-failed', () => {
    const onRetrySetupAction = vi.fn()
    const onSkip = vi.fn()

    render(
      <TutorialOverlay
        {...baseProps}
        isActive={false}
        status="paused"
        pauseReason="setup-action-failed"
        setupError="Failed to install plugin: telescope-nvim"
        onRetry={vi.fn()}
        onRetrySetupAction={onRetrySetupAction}
        onSkip={onSkip}
      />,
    )

    expect(screen.getByTestId('tutorial-paused-overlay')).toBeInTheDocument()

    // Error message should be displayed
    expect(
      screen.getByText(/failed to install plugin: telescope-nvim/i),
    ).toBeInTheDocument()

    // Setup-specific messaging
    expect(
      screen.getByText(/setup action failed while preparing this step/i),
    ).toBeInTheDocument()

    // Retry Setup button should be present
    const retryButton = screen.getByTestId('retry-setup-button')
    expect(retryButton).toBeInTheDocument()
    expect(retryButton).toHaveTextContent(/retry setup/i)

    fireEvent.click(retryButton)
    expect(onRetrySetupAction).toHaveBeenCalledOnce()

    // Skip Tutorial button should still be present
    fireEvent.click(screen.getByRole('button', { name: /skip tutorial/i }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('falls back to regular retry when setup-action-failed has no onRetrySetupAction', () => {
    const onRetry = vi.fn()

    render(
      <TutorialOverlay
        {...baseProps}
        isActive={false}
        status="paused"
        pauseReason="setup-action-failed"
        setupError="Something went wrong"
        onRetry={onRetry}
        onSkip={vi.fn()}
      />,
    )

    // Should show "Retry Setup" button even without onRetrySetupAction
    const retryButton = screen.getByTestId('retry-setup-button')
    fireEvent.click(retryButton)

    // Should fall back to regular onRetry
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

// ── TutorialControls ──────────────────────────────────────────────────────────

describe('TutorialControls', () => {
  const baseProps = {
    currentStepIndex: 1,
    totalSteps: 5,
    allowBack: true,
    skipEnabled: true,
    skipRemainingSeconds: 0,
    canAdvance: true,
    advanceType: 'click-next' as const,
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onSkip: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Continue and Skip buttons', () => {
    render(<TutorialControls {...baseProps} />)
    expect(
      screen.getByRole('button', { name: /continue/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /skip tutorial/i }),
    ).toBeInTheDocument()
  })

  it('hides Previous button when allowBack is false', () => {
    render(<TutorialControls {...baseProps} allowBack={false} />)
    expect(
      screen.queryByRole('button', { name: /previous/i }),
    ).not.toBeInTheDocument()
  })

  it('hides Previous button on first step even when allowBack is true', () => {
    render(<TutorialControls {...baseProps} currentStepIndex={0} />)
    expect(
      screen.queryByRole('button', { name: /previous/i }),
    ).not.toBeInTheDocument()
  })

  it('disables Skip button when skipEnabled is false', () => {
    render(
      <TutorialControls
        {...baseProps}
        skipEnabled={false}
        skipRemainingSeconds={3}
      />,
    )
    const skipButton = screen.getByRole('button', { name: /skip \(3s\)/i })
    expect(skipButton).toBeDisabled()
  })

  it('disables Next button for click-target steps when canAdvance is false', () => {
    render(
      <TutorialControls
        {...baseProps}
        advanceType="click-target"
        canAdvance={false}
        fallbackRemainingSeconds={5}
      />,
    )
    const nextButton = screen.getByRole('button', {
      name: /click target \(5s\)/i,
    })
    expect(nextButton).toBeDisabled()
  })

  it('shows countdown in click-target button label', () => {
    render(
      <TutorialControls
        {...baseProps}
        advanceType="click-target"
        canAdvance={false}
        fallbackRemainingSeconds={3}
      />,
    )
    expect(
      screen.getByRole('button', { name: /click target \(3s\)/i }),
    ).toBeInTheDocument()
  })

  it('shows "Continue" when click-target fallback unlocks', () => {
    render(
      <TutorialControls
        {...baseProps}
        advanceType="click-target"
        canAdvance={true}
        fallbackRemainingSeconds={0}
      />,
    )
    expect(
      screen.getByRole('button', { name: /continue/i }),
    ).toBeInTheDocument()
    // Fallback hint should appear
    expect(screen.getByText(/could not detect click/i)).toBeInTheDocument()
  })

  it('does not show fallback hint when advance was via click (remainingSeconds > 0)', () => {
    render(
      <TutorialControls
        {...baseProps}
        advanceType="click-target"
        canAdvance={true}
        fallbackRemainingSeconds={3}
      />,
    )
    expect(
      screen.queryByText(/could not detect click/i),
    ).not.toBeInTheDocument()
  })

  it('calls onNext when Continue button is clicked', () => {
    const onNext = vi.fn()
    render(<TutorialControls {...baseProps} onNext={onNext} />)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('calls onSkip when Skip button is clicked', () => {
    const onSkip = vi.fn()
    render(<TutorialControls {...baseProps} onSkip={onSkip} />)
    fireEvent.click(screen.getByRole('button', { name: /skip tutorial/i }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('shows "Finish" on last step', () => {
    render(
      <TutorialControls {...baseProps} currentStepIndex={4} totalSteps={5} />,
    )
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
  })
})

// ── TutorialConclusionStep ────────────────────────────────────────────────────

describe('TutorialConclusionStep', () => {
  it('renders "Close Tutorial Project" and "Keep Exploring" buttons', () => {
    render(
      <TutorialConclusionStep onFinish={vi.fn()} onKeepExploring={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: /close tutorial project/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /keep exploring/i }),
    ).toBeInTheDocument()
  })

  it('calls onFinish when "Close Tutorial Project" is clicked', () => {
    const onFinish = vi.fn()
    render(
      <TutorialConclusionStep onFinish={onFinish} onKeepExploring={vi.fn()} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /close tutorial project/i }),
    )
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('calls onKeepExploring when "Keep Exploring" is clicked', () => {
    const onKeepExploring = vi.fn()
    render(
      <TutorialConclusionStep
        onFinish={vi.fn()}
        onKeepExploring={onKeepExploring}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /keep exploring/i }))
    expect(onKeepExploring).toHaveBeenCalledOnce()
  })

  it('renders all 6 summary bullet points (v7)', () => {
    render(
      <TutorialConclusionStep onFinish={vi.fn()} onKeepExploring={vi.fn()} />,
    )
    const list = screen.getByRole('list', { name: /tutorial summary/i })
    expect(list.querySelectorAll('li')).toHaveLength(6)
  })

  it('renders the settings replay hint', () => {
    render(
      <TutorialConclusionStep onFinish={vi.fn()} onKeepExploring={vi.fn()} />,
    )
    expect(screen.getByText(/replay this tutorial/i)).toBeInTheDocument()
  })
})

// ── TutorialTooltip ───────────────────────────────────────────────────────────

describe('TutorialTooltip', () => {
  const baseProps = {
    title: 'Adding Your First Node',
    content: 'Click the **Add Node** button.',
    section: 'graph-editor',
    currentStepIndex: 2,
    totalSteps: 10,
    position: { x: 100, y: 200 },
    isVisible: true,
  }

  it('renders step title and content', () => {
    render(<TutorialTooltip {...baseProps} />)
    expect(screen.getByText('Adding Your First Node')).toBeInTheDocument()
    // Content renders via renderSimpleMarkdown — check for the bold part
    expect(screen.getByText('Add Node')).toBeInTheDocument()
  })

  it('renders hint when provided', () => {
    render(
      <TutorialTooltip {...baseProps} hint='Try searching for "trigger"' />,
    )
    expect(screen.getByText(/try searching for "trigger"/i)).toBeInTheDocument()
  })

  it('does not render when isVisible is false', () => {
    render(<TutorialTooltip {...baseProps} isVisible={false} />)
    expect(screen.queryByTestId('tutorial-tooltip')).not.toBeInTheDocument()
  })

  it('shows step progress (e.g., "Step 3 of 10")', () => {
    render(<TutorialTooltip {...baseProps} />)
    // currentStepIndex=2 → Step 3 of 10
    expect(screen.getByText('Step 3 of 10')).toBeInTheDocument()
  })

  it('formats section name for display', () => {
    render(<TutorialTooltip {...baseProps} section="graph-editor" />)
    expect(screen.getByText('Graph Editor')).toBeInTheDocument()
  })

  it('renders children in the controls slot', () => {
    render(
      <TutorialTooltip {...baseProps}>
        <div data-testid="controls-slot">Controls here</div>
      </TutorialTooltip>,
    )
    expect(screen.getByTestId('controls-slot')).toBeInTheDocument()
  })

  it('renders via portal outside the local render container', () => {
    const { container } = render(
      <div data-testid="local-container">
        <TutorialTooltip {...baseProps} />
      </div>,
    )

    expect(screen.getByTestId('tutorial-tooltip')).toBeInTheDocument()
    expect(
      container.querySelector('[data-testid="tutorial-tooltip"]'),
    ).toBeNull()
  })

  it('shows reacquiring indicator when target is disappearing', () => {
    render(<TutorialTooltip {...baseProps} isReacquiring={true} />)
    expect(screen.getByText(/target element changed/i)).toBeInTheDocument()
  })

  it('does not show reacquiring indicator by default', () => {
    render(<TutorialTooltip {...baseProps} />)
    expect(
      screen.queryByText(/target element changed/i),
    ).not.toBeInTheDocument()
  })

  it('reports size changes to parent via onSizeChange callback', () => {
    const onSizeChange = vi.fn()
    render(<TutorialTooltip {...baseProps} onSizeChange={onSizeChange} />)

    // onSizeChange should be called during initial render
    expect(onSizeChange).toHaveBeenCalled()
    const lastCall = onSizeChange.mock.calls[onSizeChange.mock.calls.length - 1]
    expect(lastCall?.[0]).toHaveProperty('width')
    expect(lastCall?.[0]).toHaveProperty('height')
  })

  it('renders with viewport-aware dynamic max-height', () => {
    render(<TutorialTooltip {...baseProps} />)

    // The tooltip container should have dynamic max-height based on position.y
    const tooltip = screen.getByTestId('tutorial-tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toBeVisible()
    // position.y = 200, padding = 16
    const expectedMaxHeight = Math.max(0, Math.floor(window.innerHeight - 216))
    expect(tooltip.style.maxHeight).toBe(`${expectedMaxHeight}px`)
  })

  it('constrains max-height when positioned near bottom of viewport', () => {
    render(<TutorialTooltip {...baseProps} position={{ x: 100, y: 600 }} />)
    const tooltip = screen.getByTestId('tutorial-tooltip')
    const expectedMaxHeight = Math.max(0, Math.floor(window.innerHeight - 616))
    expect(tooltip.style.maxHeight).toBe(`${expectedMaxHeight}px`)
  })

  it('uses viewport-safe max-height for center placement based on top position', () => {
    render(
      <TutorialTooltip
        {...baseProps}
        actualPlacement="center"
        position={{ x: 100, y: 200 }}
      />,
    )

    const tooltip = screen.getByTestId('tutorial-tooltip')
    const expectedMaxHeight = Math.max(0, Math.floor(window.innerHeight - 216))
    expect(tooltip.style.maxHeight).toBe(`${expectedMaxHeight}px`)
  })

  it('renders with overflow-y-auto for scrolling', () => {
    render(<TutorialTooltip {...baseProps} />)

    const tooltip = screen.getByTestId('tutorial-tooltip')
    expect(tooltip.querySelector('.overflow-y-auto')).toBeInTheDocument()
  })

  it('renders controls in sticky container at bottom', () => {
    render(
      <TutorialTooltip {...baseProps}>
        <div data-testid="controls-slot">Controls</div>
      </TutorialTooltip>,
    )

    // Query portal-rendered content via document.body/screen
    const tooltip = screen.getByTestId('tutorial-tooltip')
    // Controls should be wrapped in sticky container
    const stickyContainer = tooltip.querySelector('.sticky.bottom-0')
    expect(stickyContainer).toBeInTheDocument()
    expect(stickyContainer).toContainElement(
      screen.getByTestId('controls-slot'),
    )
  })

  it('does not pin children when stickyChildren is false', () => {
    render(
      <TutorialTooltip {...baseProps} stickyChildren={false}>
        <div data-testid="custom-slot">Custom content</div>
      </TutorialTooltip>,
    )

    const tooltip = screen.getByTestId('tutorial-tooltip')
    expect(tooltip.querySelector('.sticky.bottom-0')).toBeNull()
    expect(screen.getByTestId('custom-slot')).toBeInTheDocument()
  })

  it('hides default markdown body when renderDefaultContent is false', () => {
    render(
      <TutorialTooltip
        {...baseProps}
        content="This should be hidden"
        renderDefaultContent={false}
      >
        <div>Body override</div>
      </TutorialTooltip>,
    )

    expect(screen.queryByText('This should be hidden')).not.toBeInTheDocument()
    expect(screen.getByText('Body override')).toBeInTheDocument()
  })
})

// ── Modal Safety Tests (Phase 1) ──────────────────────────────────────────────

describe('Tutorial modal interaction safety', () => {
  it('does not cancel tutorial control pointer events while outside close is prevented', () => {
    const onContinue = vi.fn()

    render(
      <>
        <Dialog open={true} onOpenChange={vi.fn()}>
          <DialogContentNoClose preventOutsideClose={true}>
            <DialogTitle className="sr-only">Plugin detail modal</DialogTitle>
            <DialogDescription className="sr-only">
              Plugin detail dialog content
            </DialogDescription>
            <div>Plugin detail modal</div>
          </DialogContentNoClose>
        </Dialog>
        <TutorialTooltip
          title="Tutorial Step"
          content="Click Continue"
          section="plugins"
          currentStepIndex={0}
          totalSteps={5}
          position={{ x: 120, y: 120 }}
          isVisible={true}
        >
          <button
            type="button"
            data-testid="tutorial-continue"
            onClick={onContinue}
          >
            Continue
          </button>
        </TutorialTooltip>
      </>,
    )

    const continueButton = screen.getByTestId('tutorial-continue')
    const pointerDownEvent = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
    })

    const pointerDownWasNotCanceled =
      continueButton.dispatchEvent(pointerDownEvent)

    fireEvent.click(continueButton)

    expect(pointerDownWasNotCanceled).toBe(true)
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
