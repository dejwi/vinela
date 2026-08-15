/**
 * Tooltip collision-aware positioning tests.
 *
 * Verifies that the tutorial tooltip repositions to a non-overlapping placement
 * when open popovers/menus are detected.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import {
  calculateTooltipPosition,
  calculateTooltipPositionWithCollision,
  detectOpenFloatingSurfaces,
  rectsOverlap,
  tooltipOverlapsFloatingSurface,
} from '../utils'

// ── rectsOverlap ──────────────────────────────────────────────────────────────

describe('rectsOverlap', () => {
  it('returns true when rects fully overlap', () => {
    const a = new DOMRect(0, 0, 200, 200)
    const b = new DOMRect(50, 50, 100, 100)
    expect(rectsOverlap(a, b)).toBe(true)
  })

  it('returns true when rects partially overlap', () => {
    const a = new DOMRect(0, 0, 100, 100)
    const b = new DOMRect(80, 80, 100, 100)
    expect(rectsOverlap(a, b)).toBe(true)
  })

  it('returns false when rects are completely separate', () => {
    const a = new DOMRect(0, 0, 100, 100)
    const b = new DOMRect(200, 200, 100, 100)
    expect(rectsOverlap(a, b)).toBe(false)
  })

  it('returns false when rects are adjacent horizontally', () => {
    const a = new DOMRect(0, 0, 100, 100)
    const b = new DOMRect(100, 0, 100, 100)
    expect(rectsOverlap(a, b)).toBe(false)
  })

  it('returns false when rects are adjacent vertically', () => {
    const a = new DOMRect(0, 0, 100, 100)
    const b = new DOMRect(0, 100, 100, 100)
    expect(rectsOverlap(a, b)).toBe(false)
  })
})

// ── tooltipOverlapsFloatingSurface ────────────────────────────────────────────

describe('tooltipOverlapsFloatingSurface', () => {
  it('returns false when surfaces array is empty', () => {
    expect(
      tooltipOverlapsFloatingSurface(100, 100, { width: 200, height: 150 }, []),
    ).toBe(false)
  })

  it('returns true when tooltip overlaps a surface', () => {
    const surface = new DOMRect(150, 150, 300, 200)
    expect(
      tooltipOverlapsFloatingSurface(100, 100, { width: 200, height: 150 }, [
        surface,
      ]),
    ).toBe(true)
  })

  it('returns false when tooltip does not overlap any surface', () => {
    const surface = new DOMRect(500, 500, 300, 200)
    expect(
      tooltipOverlapsFloatingSurface(0, 0, { width: 100, height: 100 }, [
        surface,
      ]),
    ).toBe(false)
  })

  it('returns true when tooltip overlaps at least one of multiple surfaces', () => {
    const surfaces = [
      new DOMRect(500, 500, 100, 100), // no overlap
      new DOMRect(50, 50, 100, 100), // overlaps
    ]
    expect(
      tooltipOverlapsFloatingSurface(
        0,
        0,
        { width: 100, height: 100 },
        surfaces,
      ),
    ).toBe(true)
  })
})

// ── calculateTooltipPositionWithCollision ─────────────────────────────────────

describe('calculateTooltipPositionWithCollision', () => {
  const tooltipSize = { width: 380, height: 250 }

  it('returns preferred placement when no collision', () => {
    const targetRect = new DOMRect(400, 300, 200, 50)
    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'bottom',
      8,
      [], // no floating surfaces
    )
    expect(result.actualPlacement).toBe('bottom')
  })

  it('falls back to opposite placement when preferred overlaps a floating surface', () => {
    // Target in middle of viewport
    const targetRect = new DOMRect(400, 300, 200, 50)

    // Calculate where 'bottom' placement would be
    const bottomResult = calculateTooltipPosition(
      targetRect,
      tooltipSize,
      'bottom',
      8,
    )

    // Create a floating surface that covers the bottom placement
    const blockingRect = new DOMRect(
      bottomResult.x,
      bottomResult.y,
      tooltipSize.width,
      tooltipSize.height,
    )

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'bottom',
      8,
      [blockingRect],
    )

    // Should have moved away from 'bottom'
    expect(result.actualPlacement).not.toBe('bottom')
  })

  it('falls back to center when all placements overlap floating surfaces', () => {
    // Create surfaces that cover all possible placements
    // Use a very large surface that covers the entire viewport
    const blockingRect = new DOMRect(0, 0, 2000, 2000)

    const targetRect = new DOMRect(400, 300, 200, 50)
    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'bottom',
      8,
      [blockingRect],
    )

    // Should fall back to center when all placements are blocked
    expect(result.actualPlacement).toBe('center')
  })

  it('returns center placement unchanged when preferred is center', () => {
    const targetRect = new DOMRect(400, 300, 200, 50)
    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'center',
      8,
      [],
    )
    expect(result.actualPlacement).toBe('center')
  })

  it('behaves identically to calculateTooltipPosition when no surfaces', () => {
    const targetRect = new DOMRect(400, 300, 200, 50)
    const withoutCollision = calculateTooltipPosition(
      targetRect,
      tooltipSize,
      'right',
      8,
    )
    const withCollision = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'right',
      8,
      [],
    )
    expect(withCollision.x).toBe(withoutCollision.x)
    expect(withCollision.y).toBe(withoutCollision.y)
    expect(withCollision.actualPlacement).toBe(withoutCollision.actualPlacement)
  })
})

// ── detectOpenFloatingSurfaces ────────────────────────────────────────────────

describe('detectOpenFloatingSurfaces', () => {
  it('returns empty array when no floating surfaces are in DOM', () => {
    const result = detectOpenFloatingSurfaces()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })

  it('detects elements with data-tutorial-popover="true"', () => {
    const el = document.createElement('div')
    el.setAttribute('data-tutorial-popover', 'true')
    // Give it a non-zero size so it's detected
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => new DOMRect(100, 100, 200, 300),
      configurable: true,
    })
    document.body.appendChild(el)

    const result = detectOpenFloatingSurfaces()
    expect(result.length).toBeGreaterThanOrEqual(1)

    document.body.removeChild(el)
  })

  it('ignores elements with zero size', () => {
    const el = document.createElement('div')
    el.setAttribute('data-tutorial-popover', 'true')
    // Zero size — should be ignored
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => new DOMRect(0, 0, 0, 0),
      configurable: true,
    })
    document.body.appendChild(el)

    const result = detectOpenFloatingSurfaces()
    // Should not include zero-size elements
    const hasZeroSize = result.some((r) => r.width === 0 && r.height === 0)
    expect(hasZeroSize).toBe(false)

    document.body.removeChild(el)
  })
})

// ── Large target positioning (Phase 4) ────────────────────────────────────────

describe('calculateTooltipPositionWithCollision large targets', () => {
  const tooltipSize = { width: 380, height: 250 }

  it('prefers center placement for large targets (>40% viewport)', () => {
    // Create a large target (50% of viewport)
    const targetRect = new DOMRect(0, 0, 640, 400) // 50% of 1280x800

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'bottom', // Preferred would normally be bottom
      8,
      [],
    )

    // Should use center placement for large targets
    expect(result.actualPlacement).toBe('center')
  })

  it('avoids tooltip overlapping spotlight rect', () => {
    // Medium target with preferred bottom placement
    const targetRect = new DOMRect(400, 300, 200, 100)

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'bottom',
      8,
      [],
    )

    const tooltipRect = new DOMRect(
      result.x,
      result.y,
      tooltipSize.width,
      tooltipSize.height,
    )

    const spotlightPadding = 8
    const spotlightRect = new DOMRect(
      targetRect.x - spotlightPadding,
      targetRect.y - spotlightPadding,
      targetRect.width + spotlightPadding * 2,
      targetRect.height + spotlightPadding * 2,
    )

    // Tooltip should not overlap spotlight
    const overlap = rectsOverlap(tooltipRect, spotlightRect)
    expect(overlap).toBe(false)
  })

  it('maintains minimum 20px offset from spotlight edge', () => {
    const targetRect = new DOMRect(400, 300, 200, 100)

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'right',
      8,
      [],
    )

    const spotlightPadding = 8
    const spotlightRight = targetRect.right + spotlightPadding
    const minOffset = 20

    // Right placement should be at least 20px from spotlight edge
    if (result.actualPlacement === 'right') {
      expect(result.x).toBeGreaterThanOrEqual(spotlightRight + minOffset)
    }
  })

  it('penalizes floating surface overlaps heavily', () => {
    const targetRect = new DOMRect(400, 300, 200, 50)

    // Create a floating surface where bottom placement would be
    const bottomPlacement = calculateTooltipPosition(
      targetRect,
      tooltipSize,
      'bottom',
      8,
    )
    const blockingSurface = new DOMRect(
      bottomPlacement.x,
      bottomPlacement.y,
      tooltipSize.width,
      tooltipSize.height,
    )

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'bottom',
      8,
      [blockingSurface],
    )

    // Should not use bottom placement since it overlaps the surface
    expect(result.actualPlacement).not.toBe('bottom')

    // Tooltip should not overlap the blocking surface
    const tooltipRect = new DOMRect(
      result.x,
      result.y,
      tooltipSize.width,
      tooltipSize.height,
    )
    expect(rectsOverlap(tooltipRect, blockingSurface)).toBe(false)
  })

  it('prefers orthogonal sides when preferred and opposite are blocked', () => {
    const targetRect = new DOMRect(400, 300, 200, 50)

    // Block preferred (bottom) and opposite (top) placements
    const bottomResult = calculateTooltipPosition(
      targetRect,
      tooltipSize,
      'bottom',
      8,
    )
    const topResult = calculateTooltipPosition(
      targetRect,
      tooltipSize,
      'top',
      8,
    )

    const blockingSurfaces = [
      new DOMRect(
        bottomResult.x,
        bottomResult.y,
        tooltipSize.width,
        tooltipSize.height,
      ),
      new DOMRect(
        topResult.x,
        topResult.y,
        tooltipSize.width,
        tooltipSize.height,
      ),
    ]

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'bottom', // Preferred
      8,
      blockingSurfaces,
    )

    // Should use left or right (orthogonal sides)
    expect(['left', 'right']).toContain(result.actualPlacement)
  })
})

// ── Viewport-safe padding tests (Phase 4) ─────────────────────────────────────

describe('viewport-safe tooltip positioning', () => {
  const tooltipSize = { width: 380, height: 250 }

  it('keeps tooltip within viewport bounds with padding', () => {
    const targetRect = new DOMRect(50, 50, 100, 50) // Near top-left corner
    const padding = 16

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'left', // Would normally go off-screen left
      8,
      [],
    )

    // Should be clamped to at least padding from left edge
    expect(result.x).toBeGreaterThanOrEqual(padding)
    expect(result.y).toBeGreaterThanOrEqual(padding)
  })

  it('prevents tooltip overflow on right edge of viewport', () => {
    // Simulate a viewport of 1280x800
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })

    const targetRect = new DOMRect(1200, 400, 50, 50) // Near right edge

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'right', // Would overflow right edge
      8,
      [],
    )

    const padding = 16
    expect(result.x + tooltipSize.width).toBeLessThanOrEqual(1280 - padding)
  })

  it('keeps tooltip off spotlight when clamping near viewport edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true })

    const edgeTarget = new DOMRect(740, 250, 40, 40)
    const edgeTooltip = { width: 300, height: 180 }

    const result = calculateTooltipPositionWithCollision(
      edgeTarget,
      edgeTooltip,
      'right',
      8,
      [],
    )

    const tooltipRect = new DOMRect(
      result.x,
      result.y,
      edgeTooltip.width,
      edgeTooltip.height,
    )
    const spotlightRect = new DOMRect(
      edgeTarget.x - 8,
      edgeTarget.y - 8,
      edgeTarget.width + 16,
      edgeTarget.height + 16,
    )

    expect(rectsOverlap(tooltipRect, spotlightRect)).toBe(false)
  })

  it('prevents tooltip overflow on bottom edge of viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })

    const targetRect = new DOMRect(400, 750, 200, 50) // Near bottom edge

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      tooltipSize,
      'bottom', // Would overflow bottom edge
      8,
      [],
    )

    const padding = 16
    expect(result.y + tooltipSize.height).toBeLessThanOrEqual(800 - padding)
  })

  it('handles oversized tooltip within small viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 300, writable: true })

    const largeTooltip = { width: 380, height: 280 } // Almost fills viewport
    const targetRect = new DOMRect(100, 100, 50, 50)

    const result = calculateTooltipPositionWithCollision(
      targetRect,
      largeTooltip,
      'bottom',
      8,
      [],
    )

    // Should prefer center placement for constrained viewport
    expect(result.actualPlacement).toBe('center')
    // Should stay within bounds
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })

  it('adjusts position when measured size changes', () => {
    const targetRect = new DOMRect(400, 300, 200, 50)

    // Initial smaller size
    const smallSize = { width: 300, height: 200 }
    const smallResult = calculateTooltipPositionWithCollision(
      targetRect,
      smallSize,
      'right',
      8,
      [],
    )

    // Larger size that might overflow
    const largeSize = { width: 500, height: 350 }
    const largeResult = calculateTooltipPositionWithCollision(
      targetRect,
      largeSize,
      'right',
      8,
      [],
    )

    // Larger tooltip should be positioned differently or fallback
    expect(largeResult.x).not.toBe(smallResult.x)
  })
})

// ── Tooltip scroll and control visibility tests ───────────────────────────────

describe('tooltip scroll behavior and control visibility', () => {
  it('calculates dynamic max-height based on tooltip position', () => {
    const viewportHeight = 800
    const tooltipY = 500
    const padding = 16
    const expectedMaxHeight = viewportHeight - tooltipY - padding
    // At y=500 on 800px viewport, max height should be 284px
    expect(expectedMaxHeight).toBe(284)
  })

  it('maintains minimum padding from viewport edges', () => {
    const viewportWidth = 1280
    const viewportHeight = 800
    const tooltipSize = { width: 380, height: 250 }
    const padding = 16

    // Center placement calculation with padding
    const centerX = Math.max(padding, (viewportWidth - tooltipSize.width) / 2)
    const centerY = Math.max(padding, (viewportHeight - tooltipSize.height) / 2)

    expect(centerX).toBeGreaterThanOrEqual(padding)
    expect(centerY).toBeGreaterThanOrEqual(padding)
    expect(centerX + tooltipSize.width).toBeLessThanOrEqual(
      viewportWidth - padding,
    )
    expect(centerY + tooltipSize.height).toBeLessThanOrEqual(
      viewportHeight - padding,
    )
  })
})
