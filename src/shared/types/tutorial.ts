import type { SetupActionId } from '@/features/tutorial/data/setup-actions'

/**
 * Current tutorial version. Bump when steps change significantly.
 * If stored version < this, the tutorial is re-offered.
 * Version 3: Added Part 2 steps (16-29) covering graph composition,
 * keymaps deep-dive, Neovim options, and settings.
 * Version 4: Fixed node visibility and layout issues - improved seed graph
 * spacing, retargeted graph composition steps to spotlight actual nodes,
 * added viewport-safe tooltip positioning.
 * Version 5: Redesigned My First Config graph to showcase graph-unique
 * capabilities (autocmds, keymaps). Added Color Schemes page steps.
 * Fixed tooltip overlap on Callable Entry node.
 * Version 6: Comprehensive tutorial refinements — removed Set Keymap nodes
 * from graphs, replaced Telescope Search callable graph with Greet User
 * (vim.notify), replaced hardcoded vim.lsp.buf.format() with Run Function
 * node, replaced telescope-dependent keymaps with simple examples,
 * increased click-target timeout to 20s, fixed tooltip positioning for
 * graph-ref-explained step, removed graph-sourced-keymap step (30 steps total).
 * Version 7: Tutorial rethink — short 9-step flow focusing on plugins/keymaps/options
 * first, with Graph Editor as advanced feature. All steps are click-next.
 * Sidebar order updated to match flow. Default route changed to /plugins.
 */
export const CURRENT_TUTORIAL_VERSION = 7

/**
 * Tutorial sections for progress display.
 * Updated for v7 short flow: plugins/keymaps/options first, graph editor as advanced.
 */
export type TutorialSection =
  | 'welcome'
  | 'plugins'
  | 'keymaps'
  | 'neovim-options'
  | 'colorschemes'
  | 'graph-editor'
  | 'settings'
  | 'conclusion'

/**
 * Tooltip placement relative to spotlight target.
 */
export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

/**
 * What the user must do to advance past a step.
 * Discriminated union on `type`.
 */
export type StepAdvanceCondition =
  | { readonly type: 'click-next' }
  | {
      readonly type: 'click-target'
      /** Whether to auto-advance after successful click (default: 'manual') */
      onSuccess?: 'manual' | 'auto-next'
      /** Optional debounce before auto-advance (ms, default: 150ms) */
      advanceDebounceMs?: number
    }

/**
 * A single tutorial step definition. Static/constant.
 */
export interface TutorialStepDefinition {
  readonly id: string
  readonly section: TutorialSection
  readonly title: string
  /** Supports basic markdown: **bold**, `code`, \n */
  readonly content: string
  readonly hint?: string | undefined
  /** data-tutorial attribute value. null = no target (center step). */
  readonly target: string | null
  readonly tooltipPlacement: TooltipPlacement
  readonly advanceCondition: StepAdvanceCondition
  /** Route the app should be on for this step. null = any route. */
  readonly requiredRoute: string | null
  /** Setup action ID to run before showing step. */
  readonly setupActionId?: SetupActionId | undefined
  /** Whether "Previous" button is shown. Default: true. */
  readonly allowBack?: boolean | undefined
  /** Padding around spotlight cutout in px. Default: 8. */
  readonly spotlightPadding?: number | undefined
}

/**
 * Persisted tutorial progress. Stored in app settings.
 */
export interface TutorialProgress {
  /** Tutorial version this progress was created with */
  readonly tutorialVersion: number
  /** Current step index (0-based) */
  readonly currentStepIndex: number
  /** Whether the tutorial has been completed at least once */
  readonly hasCompleted: boolean
  /** Whether the tutorial is currently active/in-progress */
  readonly isActive: boolean
  /** Timestamp when tutorial was started */
  readonly startedAt: number
  /** Timestamp when tutorial was last interacted with */
  readonly lastInteractedAt: number
  /** The tutorial project path (for cleanup) */
  readonly tutorialProjectPath: string | null
}

/**
 * Runtime tutorial state (not persisted). Discriminated union on `status`.
 */
export type TutorialRuntimeState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly message: string }
  | {
      readonly status: 'active'
      readonly currentStepIndex: number
      readonly isTransitioning: boolean
      readonly advanceConditionMet: boolean
    }
  | {
      readonly status: 'paused'
      readonly reason:
        | 'target-not-found'
        | 'wrong-route'
        | 'setup-action-failed'
      readonly currentStepIndex: number
    }
  | { readonly status: 'completing' }

/**
 * Default/initial tutorial progress for new users.
 */
export const INITIAL_TUTORIAL_PROGRESS: TutorialProgress = {
  tutorialVersion: CURRENT_TUTORIAL_VERSION,
  currentStepIndex: 0,
  hasCompleted: false,
  isActive: false,
  startedAt: 0,
  lastInteractedAt: 0,
  tutorialProjectPath: null,
}
