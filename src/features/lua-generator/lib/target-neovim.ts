// ============================================
// Target Neovim Snapshot Types and Helpers
// ============================================

import type { NeovimDetectionErrorCode } from '@/features/neovim/types'
import {
  isNeovimVersionAtLeast,
  MIN_SUPPORTED_NEOVIM_VERSION,
  parseNeovimVersionNumeric,
} from '@/shared/lib/neovim-version'
import { isMemoryMode } from '@/shared/lib/storage'

export type TargetNeovimSnapshot =
  | { kind: 'detected'; version: string; versionDisplay: string }
  | { kind: 'undetected'; reason: NeovimDetectionErrorCode }
  | { kind: 'unavailable'; reason: 'memory-mode' }

export type TargetNeovimPreflightState =
  | { kind: 'idle' }
  | { kind: 'loading'; requestId: number }
  | { kind: 'ready'; requestId: number; snapshot: TargetNeovimSnapshot }

export const TARGET_NEOVIM_BASELINE_DIAGNOSTIC_ID =
  'WARN_TARGET_NEOVIM_BASELINE'

export type TargetNeovimCalloutKind = 'old-version' | 'undetected' | 'none'

export interface TargetNeovimCallout {
  readonly kind: TargetNeovimCalloutKind
  readonly title: string
  readonly message: string
}

/**
 * Normalize a snapshot so malformed detected versions use undetected semantics.
 */
export function normalizeTargetNeovimSnapshot(
  snapshot: TargetNeovimSnapshot,
): TargetNeovimSnapshot {
  if (snapshot.kind !== 'detected') {
    return snapshot
  }

  const parsed = parseNeovimVersionNumeric(snapshot.version)
  if (parsed === null) {
    return { kind: 'undetected', reason: 'parse-failed' }
  }

  if (parsed.normalized === snapshot.version) {
    return snapshot
  }

  return {
    kind: 'detected',
    version: parsed.normalized,
    versionDisplay: snapshot.versionDisplay,
  }
}

/**
 * Map a target snapshot to pre-flight callout copy.
 * Memory mode and supported versions produce no callout.
 */
export function getTargetNeovimCallout(
  snapshot: TargetNeovimSnapshot,
): TargetNeovimCallout | null {
  const normalized = normalizeTargetNeovimSnapshot(snapshot)
  if (normalized.kind === 'unavailable') {
    return null
  }

  if (normalized.kind === 'detected') {
    if (isNeovimVersionAtLeast(normalized.version)) {
      return null
    }
    return {
      kind: 'old-version',
      title: 'Neovim version below Vinela baseline',
      message: `Vinela targets Neovim ${MIN_SUPPORTED_NEOVIM_VERSION}+. The locally detected nvim binary reports ${normalized.versionDisplay}. Generated configuration may use APIs unavailable on that version. Upgrade Neovim before deploying, or verify the target runtime separately if you plan to copy the output elsewhere.`,
    }
  }

  return {
    kind: 'undetected',
    title: 'Could not verify local Neovim version',
    message: `Vinela could not detect a local nvim binary (${normalized.reason}). Generated configuration assumes Neovim ${MIN_SUPPORTED_NEOVIM_VERSION}+. Check Neovim Status in Settings before deploying, or verify the actual target runtime if the output will run on another machine.`,
  }
}

/**
 * Resolve a target Neovim snapshot for pre-flight or non-UI fallback.
 */
export async function resolveTargetNeovimSnapshot(): Promise<TargetNeovimSnapshot> {
  if (isMemoryMode()) {
    return { kind: 'unavailable', reason: 'memory-mode' }
  }

  const { detectNeovim } = await import('@/features/neovim/detection')
  const result = await detectNeovim()

  if (result.found) {
    const normalized = normalizeTargetNeovimSnapshot({
      kind: 'detected',
      version: result.version,
      versionDisplay: result.versionDisplay,
    })
    if (normalized.kind === 'undetected') {
      return normalized
    }
    return normalized
  }

  if (result.errorCode === 'memory-mode') {
    return { kind: 'unavailable', reason: 'memory-mode' }
  }

  return { kind: 'undetected', reason: result.errorCode }
}
