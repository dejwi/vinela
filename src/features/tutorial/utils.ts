import React from 'react'
import type { TooltipPlacement } from '@/shared/types/tutorial'

/** Gap between spotlight edge and tooltip edge in px */
const TOOLTIP_GAP = 16

/** Minimum tooltip distance from spotlight edge in px */
const TOOLTIP_OFFSET = 20

/** Safe viewport padding for tooltip placement in px */
export const TOOLTIP_VIEWPORT_PADDING = 16

/** Default spotlight padding in px */
const DEFAULT_SPOTLIGHT_PADDING = 8

/**
 * Returns current viewport dimensions with SSR-safe defaults.
 */
export function getViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800 }
  }

  const visualViewport = window.visualViewport

  if (visualViewport !== undefined && visualViewport !== null) {
    return {
      width: visualViewport.width,
      height: visualViewport.height,
    }
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

/**
 * Clamps tooltip position so the full card stays inside the viewport with
 * configured padding.
 */
export function clampTooltipPositionToViewport(
  position: { x: number; y: number },
  tooltipSize: { width: number; height: number },
  viewport: { width: number; height: number } = getViewportSize(),
  padding: number = TOOLTIP_VIEWPORT_PADDING,
): { x: number; y: number } {
  const minX = padding
  const minY = padding
  const maxX = Math.max(minX, viewport.width - tooltipSize.width - padding)
  const maxY = Math.max(minY, viewport.height - tooltipSize.height - padding)

  return {
    x: Math.max(minX, Math.min(position.x, maxX)),
    y: Math.max(minY, Math.min(position.y, maxY)),
  }
}

/**
 * Calculates the spotlight cutout rectangle with padding.
 * Clamps to viewport bounds (no negative values).
 */
export function calculateSpotlightRect(
  targetRect: DOMRect,
  padding: number = DEFAULT_SPOTLIGHT_PADDING,
): {
  x: number
  y: number
  width: number
  height: number
  borderRadius: number
} {
  return {
    x: Math.max(0, targetRect.x - padding),
    y: Math.max(0, targetRect.y - padding),
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
    borderRadius: 8,
  }
}

/**
 * Calculates tooltip position relative to a target element.
 * Falls back to opposite side if preferred side has no space.
 * Clamps to viewport bounds.
 */
export function calculateTooltipPosition(
  targetRect: DOMRect,
  tooltipSize: { width: number; height: number },
  placement: TooltipPlacement,
  spotlightPadding: number,
  options?: {
    readonly clampToViewport?: boolean
    readonly viewportPadding?: number
  },
): {
  x: number
  y: number
  actualPlacement: TooltipPlacement
} {
  const viewport = getViewportSize()
  const vw = viewport.width
  const vh = viewport.height
  const clampToViewport = options?.clampToViewport !== false
  const viewportPadding = options?.viewportPadding ?? TOOLTIP_VIEWPORT_PADDING

  // Center placement: center in viewport
  if (placement === 'center') {
    const centeredPosition = {
      x: (vw - tooltipSize.width) / 2,
      y: (vh - tooltipSize.height) / 2,
    }

    if (!clampToViewport) {
      return {
        x: centeredPosition.x,
        y: centeredPosition.y,
        actualPlacement: 'center',
      }
    }

    const clampedCenteredPosition = clampTooltipPositionToViewport(
      centeredPosition,
      tooltipSize,
      viewport,
      viewportPadding,
    )

    return {
      x: clampedCenteredPosition.x,
      y: clampedCenteredPosition.y,
      actualPlacement: 'center',
    }
  }

  const spotlightLeft = targetRect.x - spotlightPadding
  const spotlightTop = targetRect.y - spotlightPadding
  const spotlightRight = targetRect.right + spotlightPadding
  const spotlightBottom = targetRect.bottom + spotlightPadding

  // Calculate preferred position
  let x = 0
  let y = 0
  let actualPlacement: TooltipPlacement = placement

  const centerX = targetRect.x + targetRect.width / 2 - tooltipSize.width / 2
  const centerY = targetRect.y + targetRect.height / 2 - tooltipSize.height / 2

  switch (placement) {
    case 'bottom': {
      x = centerX
      y = spotlightBottom + TOOLTIP_GAP
      // Fall back to top if no space below
      if (y + tooltipSize.height > vh - viewportPadding) {
        y = spotlightTop - TOOLTIP_GAP - tooltipSize.height
        actualPlacement = 'top'
      }
      break
    }
    case 'top': {
      x = centerX
      y = spotlightTop - TOOLTIP_GAP - tooltipSize.height
      // Fall back to bottom if no space above
      if (y < viewportPadding) {
        y = spotlightBottom + TOOLTIP_GAP
        actualPlacement = 'bottom'
      }
      break
    }
    case 'right': {
      x = spotlightRight + TOOLTIP_GAP
      y = centerY
      // Fall back to left if no space to the right
      if (x + tooltipSize.width > vw - viewportPadding) {
        x = spotlightLeft - TOOLTIP_GAP - tooltipSize.width
        actualPlacement = 'left'
      }
      break
    }
    case 'left': {
      x = spotlightLeft - TOOLTIP_GAP - tooltipSize.width
      y = centerY
      // Fall back to right if no space to the left
      if (x < viewportPadding) {
        x = spotlightRight + TOOLTIP_GAP
        actualPlacement = 'right'
      }
      break
    }
  }

  // Maintain a minimum separation from spotlight edges for side placements.
  const minOffset = TOOLTIP_OFFSET
  switch (actualPlacement) {
    case 'right':
      x = Math.max(x, spotlightRight + minOffset)
      break
    case 'left':
      x = Math.min(x, spotlightLeft - tooltipSize.width - minOffset)
      break
    case 'bottom':
      y = Math.max(y, spotlightBottom + minOffset)
      break
    case 'top':
      y = Math.min(y, spotlightTop - tooltipSize.height - minOffset)
      break
  }

  if (!clampToViewport) {
    return { x, y, actualPlacement }
  }

  const clampedPosition = clampTooltipPositionToViewport(
    { x, y },
    tooltipSize,
    viewport,
    viewportPadding,
  )

  return {
    x: clampedPosition.x,
    y: clampedPosition.y,
    actualPlacement,
  }
}

/**
 * Scrolls the target element into view if not visible.
 * Returns a promise that resolves after scroll completes.
 */
export async function scrollTargetIntoView(
  element: HTMLElement,
): Promise<void> {
  const rect = element.getBoundingClientRect()
  const isVisible =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth

  if (!isVisible) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Wait for scroll to complete
    await new Promise<void>((resolve) => setTimeout(resolve, 400))
  }
}

/**
 * Renders simple markdown to React elements.
 * Supports: **bold**, `code`, \n (line breaks)
 */
export function renderSimpleMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      result.push(React.createElement('br', { key: `br-${lineIndex}` }))
    }

    // Parse inline tokens: **bold** and `code`
    const tokens = parseInlineMarkdown(line)
    tokens.forEach((token, tokenIndex) => {
      const key = `line-${lineIndex}-token-${tokenIndex}`
      if (token.type === 'bold') {
        result.push(React.createElement('strong', { key }, token.content))
      } else if (token.type === 'code') {
        result.push(React.createElement('code', { key }, token.content))
      } else {
        result.push(token.content)
      }
    })
  })

  return result
}

type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'code'; content: string }

function parseInlineMarkdown(line: string): InlineToken[] {
  const tokens: InlineToken[] = []
  // Regex: match **bold** or `code` spans
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let lastIndex = 0

  for (;;) {
    const match = pattern.exec(line)
    if (match === null) break

    // Text before this match
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', content: line.slice(lastIndex, match.index) })
    }

    if (match[1] !== undefined) {
      // **bold**
      tokens.push({ type: 'bold', content: match[1] })
    } else if (match[2] !== undefined) {
      // `code`
      tokens.push({ type: 'code', content: match[2] })
    }

    lastIndex = pattern.lastIndex
  }

  // Remaining text after last match
  if (lastIndex < line.length) {
    tokens.push({ type: 'text', content: line.slice(lastIndex) })
  }

  return tokens
}

/**
 * Detects open floating surfaces (popovers, menus) that may overlap with the
 * tutorial tooltip. Looks for elements with `data-tutorial-popover="true"` or
 * `[data-radix-popper-content-wrapper]` (Radix UI portals).
 *
 * @returns Array of DOMRect for each detected open floating surface.
 */
export function detectOpenFloatingSurfaces(): DOMRect[] {
  if (typeof document === 'undefined') return []

  const rects: DOMRect[] = []

  // Explicit tutorial-popover markers (e.g., NodePalette)
  const markedElements = document.querySelectorAll(
    '[data-tutorial-popover="true"]',
  )
  for (const el of markedElements) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      rects.push(rect)
    }
  }

  // Radix UI popper content wrappers (covers most shadcn/ui popovers/menus)
  const radixElements = document.querySelectorAll(
    '[data-radix-popper-content-wrapper]',
  )
  for (const el of radixElements) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      rects.push(rect)
    }
  }

  return rects
}

/**
 * Checks whether two rectangles overlap.
 */
export function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  )
}

/**
 * Returns overlap area between two rectangles in square pixels.
 */
export function rectOverlapArea(a: DOMRect, b: DOMRect): number {
  const overlapWidth = Math.max(
    0,
    Math.min(a.right, b.right) - Math.max(a.left, b.left),
  )
  const overlapHeight = Math.max(
    0,
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
  )

  return overlapWidth * overlapHeight
}

function calculateRectDistance(a: DOMRect, b: DOMRect): number {
  const horizontalDistance =
    a.right < b.left
      ? b.left - a.right
      : b.right < a.left
        ? a.left - b.right
        : 0
  const verticalDistance =
    a.bottom < b.top
      ? b.top - a.bottom
      : b.bottom < a.top
        ? a.top - b.bottom
        : 0

  if (horizontalDistance === 0) return verticalDistance
  if (verticalDistance === 0) return horizontalDistance
  return Math.hypot(horizontalDistance, verticalDistance)
}

/**
 * Checks whether a proposed tooltip rect overlaps with any open floating surface.
 *
 * @param tooltipX - Proposed tooltip left position.
 * @param tooltipY - Proposed tooltip top position.
 * @param tooltipSize - Tooltip dimensions.
 * @param floatingSurfaces - Open floating surface rects to check against.
 */
export function tooltipOverlapsFloatingSurface(
  tooltipX: number,
  tooltipY: number,
  tooltipSize: { width: number; height: number },
  floatingSurfaces: DOMRect[],
): boolean {
  if (floatingSurfaces.length === 0) return false

  const tooltipRect = new DOMRect(
    tooltipX,
    tooltipY,
    tooltipSize.width,
    tooltipSize.height,
  )

  return floatingSurfaces.some((surface) => rectsOverlap(tooltipRect, surface))
}

/**
 * Calculates tooltip position with collision-aware placement fallback.
 *
 * Phase 4: Replaced simple preferred/opposite/clamp with scored candidate placement.
 * Candidate set: preferred, opposite, orthogonal sides, docked corners.
 * Score penalties: overlap with spotlight rect, viewport overflow, floating surfaces.
 * Minimum offset from spotlight edge (20-24px).
 * Large targets (>30% viewport) prefer docked placement.
 *
 * @param targetRect - Bounding rect of the spotlight target.
 * @param tooltipSize - Tooltip dimensions.
 * @param placement - Preferred placement.
 * @param spotlightPadding - Padding around spotlight cutout.
 * @param floatingSurfaces - Open floating surface rects to avoid.
 */
export function calculateTooltipPositionWithCollision(
  targetRect: DOMRect,
  tooltipSize: { width: number; height: number },
  placement: TooltipPlacement,
  spotlightPadding: number,
  floatingSurfaces: DOMRect[],
): { x: number; y: number; actualPlacement: TooltipPlacement } {
  const viewport = getViewportSize()
  const vw = viewport.width
  const vh = viewport.height

  if (placement === 'center') {
    return calculateTooltipPosition(
      targetRect,
      tooltipSize,
      'center',
      spotlightPadding,
    )
  }

  // If tooltip is larger than the safe viewport area, dock to center so the
  // user always sees as much content as possible.
  const maxSafeWidth = vw - TOOLTIP_VIEWPORT_PADDING * 2
  const maxSafeHeight = vh - TOOLTIP_VIEWPORT_PADDING * 2
  if (tooltipSize.width > maxSafeWidth || tooltipSize.height > maxSafeHeight) {
    return calculateTooltipPosition(
      targetRect,
      tooltipSize,
      'center',
      spotlightPadding,
    )
  }

  // Calculate spotlight rect with padding
  const spotlightLeft = targetRect.x - spotlightPadding
  const spotlightTop = targetRect.y - spotlightPadding
  const spotlightRight = targetRect.right + spotlightPadding
  const spotlightBottom = targetRect.bottom + spotlightPadding
  const spotlightRect = new DOMRect(
    spotlightLeft,
    spotlightTop,
    spotlightRight - spotlightLeft,
    spotlightBottom - spotlightTop,
  )

  // Check if target is "large" (>30% viewport area)
  const targetArea = targetRect.width * targetRect.height
  const viewportArea = vw * vh
  const isLargeTarget = targetArea > viewportArea * 0.3

  // Build candidate placements
  const opposite: Record<TooltipPlacement, TooltipPlacement> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
    center: 'center',
  }

  // Orthogonal sides relative to preferred
  const orthogonal: Record<TooltipPlacement, TooltipPlacement[]> = {
    top: ['left', 'right'],
    bottom: ['left', 'right'],
    left: ['top', 'bottom'],
    right: ['top', 'bottom'],
    center: ['top', 'bottom', 'left', 'right'],
  }

  // Candidate placements in priority order
  const candidates: TooltipPlacement[] = isLargeTarget
    ? ['center'] // Large targets prefer docked center placement
    : [
        placement, // Preferred
        opposite[placement], // Opposite
        ...orthogonal[placement], // Orthogonal sides
      ]

  // Score each candidate
  interface ScoredCandidate {
    placement: TooltipPlacement
    x: number
    y: number
    score: number
  }

  const scoredCandidates: ScoredCandidate[] = candidates.map((p) => {
    const pos = calculateTooltipPosition(
      targetRect,
      tooltipSize,
      p,
      spotlightPadding,
      {
        clampToViewport: false,
        viewportPadding: TOOLTIP_VIEWPORT_PADDING,
      },
    )

    const clampedPos = clampTooltipPositionToViewport(
      { x: pos.x, y: pos.y },
      tooltipSize,
      viewport,
      TOOLTIP_VIEWPORT_PADDING,
    )

    let score = 0
    const tooltipRect = new DOMRect(
      clampedPos.x,
      clampedPos.y,
      tooltipSize.width,
      tooltipSize.height,
    )

    // Hard reject candidates that overlap the spotlight target.
    if (rectsOverlap(tooltipRect, spotlightRect)) {
      return {
        placement: pos.actualPlacement,
        x: clampedPos.x,
        y: clampedPos.y,
        score: Number.POSITIVE_INFINITY,
      }
    }

    const distanceToSpotlight = calculateRectDistance(
      tooltipRect,
      spotlightRect,
    )
    if (distanceToSpotlight < TOOLTIP_OFFSET) {
      score += (TOOLTIP_OFFSET - distanceToSpotlight) * 100
    }

    const clampDelta =
      Math.abs(clampedPos.x - pos.x) + Math.abs(clampedPos.y - pos.y)
    if (clampDelta > 0) {
      score += 200 + clampDelta
    }

    // Penalty for floating surface overlap (proportional to overlap area).
    if (floatingSurfaces.length > 0) {
      const tooltipArea = tooltipSize.width * tooltipSize.height
      if (tooltipArea > 0) {
        const overlapArea = floatingSurfaces.reduce((total, surface) => {
          return total + rectOverlapArea(tooltipRect, surface)
        }, 0)

        if (overlapArea > 0) {
          const overlapRatio = Math.min(1, overlapArea / tooltipArea)
          score += overlapRatio * 2000
        }
      }
    }

    // Distance from edge penalty (prefer positions with some margin)
    const edgeMargin = Math.max(20, TOOLTIP_VIEWPORT_PADDING)
    if (clampedPos.x < edgeMargin) score += 50
    if (clampedPos.y < edgeMargin) score += 50
    if (vw - (clampedPos.x + tooltipSize.width) < edgeMargin) score += 50
    if (vh - (clampedPos.y + tooltipSize.height) < edgeMargin) score += 50

    // Slight preference for preferred placement (bonus for matching user intent)
    if (pos.actualPlacement === placement) score -= 100

    return {
      placement: pos.actualPlacement,
      x: clampedPos.x,
      y: clampedPos.y,
      score,
    }
  })

  // Sort by score (lowest is best)
  scoredCandidates.sort((a, b) => a.score - b.score)

  // Find first viable candidate; if every option is heavily obstructed, dock center.
  const MAX_ACCEPTABLE_SCORE = 1800
  const bestCandidate = scoredCandidates.find(
    (c) => Number.isFinite(c.score) && c.score < MAX_ACCEPTABLE_SCORE,
  )

  if (bestCandidate !== undefined) {
    return {
      x: bestCandidate.x,
      y: bestCandidate.y,
      actualPlacement: bestCandidate.placement,
    }
  }

  // All candidates have high overlap — fall back to center (docked)
  return calculateTooltipPosition(
    targetRect,
    tooltipSize,
    'center',
    spotlightPadding,
  )
}

/**
 * Debounce utility for resize/scroll handlers.
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeoutId !== null) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Override map for section names that don't format correctly via hyphen-split.
 * e.g. 'colorschemes' → 'Color Schemes' (no hyphen to split on).
 */
const SECTION_DISPLAY_NAMES: Partial<Record<string, string>> = {
  colorschemes: 'Color Schemes',
}

/**
 * Formats a section name for display.
 * 'graph-editor' → 'Graph Editor'
 * 'colorschemes' → 'Color Schemes' (via override map)
 */
export function formatSectionName(section: string): string {
  const override = SECTION_DISPLAY_NAMES[section]
  if (override !== undefined) return override
  return section
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
