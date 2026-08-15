/**
 * Performance Timing Utility for Category 13 Tests
 *
 * Provides stable, median-based timing measurement for generation calls.
 * Only the generation call is timed — fixture construction, mock setup,
 * and assertion work are excluded from measurements.
 *
 * ## CI Threshold Policy (env-driven multiplier — preferred approach)
 *
 * All threshold assertions multiply their base target by `PERF_THRESHOLD_MULTIPLIER`
 * (default 1.0). CI sets this variable to 1.5 or higher for known-slow agents.
 * This avoids duplicating magic numbers in test code and lets policy be tuned
 * without touching test logic.
 *
 * Example CI usage:
 *   PERF_THRESHOLD_MULTIPLIER=2.0 bun test performance.test.ts
 *
 * If multiplier tuning proves insufficient for a CI environment, consider
 * moving Category 13 to a dedicated non-blocking nightly job (see plan §Threshold Strategy).
 *
 * ## PERF_THRESHOLD_MULTIPLIER cap
 *
 * Multipliers above 3.0 indicate the CI environment is too degraded to yield
 * meaningful perf signal. When you see a multiplier that high, investigate the
 * infrastructure rather than raising the cap further. Document the change in a
 * code comment when raising thresholds intentionally.
 *
 * ## Baseline-Relative Regression Detection
 *
 * `BASELINES_MS` stores expected median generation times for each scenario.
 * The regression alert assertion (`medianMs < baseline * 2 * multiplier`)
 * catches regressions before they reach the absolute threshold.
 *
 * ### Baseline update process
 * Baselines are intentional, not automatic. To update:
 * 1. Run the suite 3+ times on a quiet machine and note the new steady-state median.
 * 2. Update the constant below with a comment explaining the change.
 * 3. Commit the update separately from the code change so the motivation is traceable.
 * Do NOT auto-update baselines from CI artifacts — that defeats regression detection.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Baseline Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expected median generation time in milliseconds for a warm, unloaded machine.
 *
 * These are intentionally conservative estimates — the actual observed medians
 * are currently well below these values (< 10ms each), but the baselines are
 * set generously enough to allow for machine variance while still catching
 * meaningful regressions (2× factor applied in assertions).
 *
 * Update process: measure 3+ runs on a quiet machine, update with a comment,
 * commit separately from the code change. DO NOT auto-update from CI.
 *
 * Last measured (reference machine, 2026-03-06):
 *   13.1: ~0.6ms  13.2: ~2.5ms  13.3: ~0.4ms  13.4: ~2.9ms
 *   13.5: ~0.2ms  13.6: ~0.5ms  13.7: ~0.3ms  13.8: ~20ms (full orchestrator)
 */
export const BASELINES_MS = {
  '13.1': 50, // 10 graphs × 5 nodes
  '13.2': 150, // 50 graphs × 10 nodes
  '13.3': 100, // 100-node chain
  '13.4': 200, // 100-branch fan (~201 nodes)
  '13.5': 300, // 20 deep nested conditions
  '13.6': 250, // 10 callables × 5 calls (50 total graph-ref calls)
  '13.7': 350, // complex project fixture (helper path)
  '13.8': 400, // full orchestrator pipeline (end-to-end)
  '13.9': 150, // cold-start single run (same fixture as 13.2, no warm-up)
  '13.10': 150, // memory check (same fixture as 13.2; no timing threshold used)
  '13.11': 100, // typical project (8 graphs, ~40 nodes)
  '13.12': 300, // worst-case nesting (30 levels, both branches)
  '13.13': 150, // graph count vs node count scaling (two sub-measurements)
  '13.14': 200, // wide vs deep shape comparison (two sub-measurements)
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PerfStats {
  /** Individual measured run timings in milliseconds */
  runsMs: number[]
  /** Minimum measured run */
  minMs: number
  /** Maximum measured run */
  maxMs: number
  /** Median measured run (primary assertion metric) */
  medianMs: number
}

export interface MeasureOptions {
  /** Number of warm-up runs to discard (default: 2) */
  warmupRuns?: number
  /** Number of measured runs to record (default: 3 locally, 5 in CI) */
  measuredRuns?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read the active threshold multiplier from `PERF_THRESHOLD_MULTIPLIER`.
 * Returns 1.0 if not set. CI can raise this to e.g. 1.5 or 2.0.
 */
export function getThresholdMultiplier(): number {
  const raw = process.env['PERF_THRESHOLD_MULTIPLIER']
  if (raw === undefined || raw === '') return 1.0
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.0
}

/**
 * Apply the active threshold multiplier to a base target in milliseconds.
 *
 * Usage:
 *   expect(stats.medianMs).toBeLessThan(applyMultiplier(1200))
 */
export function applyMultiplier(baseMs: number): number {
  return baseMs * getThresholdMultiplier()
}

/**
 * Measure the elapsed time of a repeated generation call.
 *
 * Behavior:
 * 1. Runs `warmupRuns` (default 2) times and discards timings.
 * 2. Runs `measuredRuns` (default 3 locally / 5 in CI) and records timings.
 * 3. Returns min/max/median of the measured runs.
 *
 * Only the generation callback is timed. Fixture construction must happen
 * BEFORE calling this function.
 *
 * @param run - The generation function to time (sync or async)
 * @param options - Optional warm-up and measured run counts
 */
export async function measureGenerationTime(
  run: () => Promise<void> | void,
  options?: MeasureOptions,
): Promise<PerfStats> {
  const warmupRuns = options?.warmupRuns ?? 2
  // Use 5 runs in CI (where PERF_THRESHOLD_MULTIPLIER is typically set),
  // 3 runs locally. Odd counts avoid median-of-even ambiguity.
  const isCI =
    process.env['CI'] !== undefined ||
    process.env['PERF_THRESHOLD_MULTIPLIER'] !== undefined
  const measuredRuns = options?.measuredRuns ?? (isCI ? 5 : 3)

  // Warm-up runs (discarded)
  for (let i = 0; i < warmupRuns; i++) {
    await run()
  }

  // Measured runs
  const runsMs: number[] = []
  for (let i = 0; i < measuredRuns; i++) {
    const start = performance.now()
    await run()
    runsMs.push(performance.now() - start)
  }

  const sorted = [...runsMs].sort((a, b) => a - b)
  const minMs = sorted[0] ?? 0
  const maxMs = sorted[sorted.length - 1] ?? 0
  const medianMs = computeMedian(sorted)

  return { runsMs, minMs, maxMs, medianMs }
}

/**
 * Format a PerfStats result into a human-readable summary string.
 * Useful for console output in test bodies for visibility.
 */
export function formatPerfStats(label: string, stats: PerfStats): string {
  const multiplier = getThresholdMultiplier()
  const multiplierNote =
    multiplier !== 1.0 ? ` (×${multiplier.toFixed(1)} CI multiplier)` : ''
  return (
    `[perf] ${label}: ` +
    `median=${stats.medianMs.toFixed(1)}ms  ` +
    `min=${stats.minMs.toFixed(1)}ms  ` +
    `max=${stats.maxMs.toFixed(1)}ms  ` +
    `runs=[${stats.runsMs.map((r) => r.toFixed(0)).join(', ')}]ms` +
    multiplierNote
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Private Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeMedian(sortedValues: number[]): number {
  const len = sortedValues.length
  if (len === 0) return 0
  const mid = Math.floor(len / 2)
  if (len % 2 === 1) {
    return sortedValues[mid] ?? 0
  }
  // Even length: average of two middle values
  return ((sortedValues[mid - 1] ?? 0) + (sortedValues[mid] ?? 0)) / 2
}
