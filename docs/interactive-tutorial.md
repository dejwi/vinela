# Interactive Tutorial System

This document describes the interactive tutorial implementation for vinela.

Use this when you need to:
- Update tutorial steps or add new ones
- Debug runtime behavior
- Add new setup actions/targets
- Extend onboarding flows

## Overview

The tutorial is an in-app guided walkthrough that:
- Highlights real UI elements using a spotlight overlay
- Explains features with contextual tooltips
- Uses click-next progression (no required manual navigation)
- Persists progress for resume/replay

It runs against an isolated tutorial project created in memory mode, so user projects are not modified.

### Core capabilities

- Spotlight mask with optional click-blocking (only for click-target steps)
- Collision-aware tooltip placement avoiding viewport overflow
- Step gating with two condition types:
  - `click-next` — user clicks Continue to advance
  - `click-target` — user clicks the highlighted element (currently unused in v7)
- Pause and recovery flows for:
  - Missing targets
  - Wrong route
  - Setup action failures
- Safe tutorial project lifecycle (create, open, cleanup)
- Persistent progress with version migration
- Centralized route sync for next/previous navigation

### High-level architecture

```text
TutorialAutoStart
  -> checks persisted tutorial progress
  -> auto-starts on first launch OR after version migration
  -> shows resume dialog for interrupted sessions

useTutorialStore (Zustand)
  -> authoritative runtime state machine
  -> persists tutorial progress
  -> starts/resumes/skips/completes tutorial
  -> creates/opens/cleans tutorial project

TutorialProvider
  -> derives active step from store
  -> runs setup actions (step-entry gated)
  -> resolves/observes targets
  -> centralized route sync on step changes
  -> handles click-target listeners + auto-next
  -> handles route checks + nav-intent grace
  -> renders overlay + tooltip + controls/conclusion

Hooks + Utils
  -> target search/reacquire
  -> skip/fallback timers
  -> tooltip placement + collision scoring
```

Primary files:
- `src/features/tutorial/data/steps.ts` — Step definitions
- `src/features/tutorial/store.ts` — State machine
- `src/features/tutorial/components/TutorialProvider.tsx` — Runtime orchestration
- `src/shared/types/tutorial.ts` — Type definitions

Related files:
- `src/features/tutorial/storage.ts` — Persistence layer
- `src/features/tutorial/lifecycle.ts` — Project lifecycle
- `src/features/tutorial/data/setup-actions.ts` — UI state preparation
- `src/features/tutorial/hooks/useTutorialAutoStart.tsx` — Entry point
- `src/app/components/require-project.tsx` — Project recovery

## Current Flow (9 Steps, v7)

Canonical source: `src/features/tutorial/data/steps.ts`

The v7 flow emphasizes quick-win workflows (plugins, keymaps, options) first,
with Graph Editor presented as an advanced capability.

Section order:
1. `welcome`
2. `plugins`
3. `keymaps`
4. `neovim-options`
5. `colorschemes`
6. `graph-editor`
7. `conclusion`

Step IDs in order:
1. `welcome` — Centered welcome message
2. `plugins-overview` — Browse/Installed tabs explained
3. `plugin-install-hint` — How to install
4. `keymaps-overview` — Keyboard shortcuts page
5. `keymaps-create-hint` — Creating shortcuts
6. `options-overview` — Neovim options catalog
7. `colorschemes-overview` — Theme gallery
8. `graph-editor-brief` — Brief graph editor intro
9. `conclusion` — Summary and CTAs

## Data Model and Constants

### `TutorialStepDefinition`

Defined in `src/shared/types/tutorial.ts`.

Key fields:
- Content: `title`, `content` (supports **bold**, `code`, \n), optional `hint`
- Targeting: `target` (data-tutorial attribute), `tooltipPlacement`, optional `spotlightPadding`
- Progression: `advanceCondition`, `requiredRoute`, optional `allowBack`
- Setup: optional `setupActionId`

### `StepAdvanceCondition`

Discriminated union:
- `{ type: 'click-next' }` — User clicks Continue
- `{ type: 'click-target', onSuccess?, advanceDebounceMs? }` — User clicks highlighted element

### `TutorialRuntimeState`

Discriminated union:
- `idle`
- `loading`
- `active` — `currentStepIndex`, `isTransitioning`, `advanceConditionMet`
- `paused` — `reason` (`target-not-found`, `wrong-route`, `setup-action-failed`), `currentStepIndex`
- `completing`

### Important constants

- `CURRENT_TUTORIAL_VERSION = 7` — Bump when steps change significantly
- Skip button delay: `5000ms`
- Target search timeout: `5000ms`
- Nav-intent grace window: `400ms`
- Tutorial seed version: `TUTORIAL_SEED_VERSION` (see seed-project.ts)

## Runtime Behavior

### Start/Resume entry points

Tutorial can start from:
- First launch (no progress exists)
- Version migration (migrated-reset signature detected)
- Settings page replay button
- Start screen "Take the guided tour" link

Resume flow:
- If persisted progress is active and incomplete, `TutorialAutoStart` shows resume dialog
- User can `Resume`, `Start Over`, or `Dismiss`

### Version migration behavior (v7+)

When `CURRENT_TUTORIAL_VERSION` is bumped:
1. Old progress is reset to inactive state (by storage.ts migration)
2. Reset signature is: `tutorialVersion === CURRENT`, `hasCompleted === false`, `isActive === false`, `currentStepIndex === 0`, timestamps zeroed, `tutorialProjectPath === null`
3. `TutorialAutoStart` detects this signature and auto-starts once
4. This re-offers the tutorial to existing users after major changes

### Store responsibilities

`useTutorialStore` is the state machine.

Key actions:
- `startTutorial(atStep?)`
- `resumeTutorialAtStep(stepIndex)`
- `nextStep()` / `previousStep()`
- `skipTutorial()`
- `completeTutorial()`
- `keepExploring()`
- `pauseTutorial(reason)` / `resumeTutorial()`
- `handleRouteChange(newRoute, isNavIntentActive?)`

### Provider responsibilities

`TutorialProvider` handles:
- Deriving current step from store
- **Centralized route sync** — Every step change (next/previous/resume) checks `requiredRoute` and navigates if needed
- Setup actions on step entry (gated by `lastProcessedStepIndexRef`)
- Target discovery and observation
- Tooltip measurement and repositioning
- Rendering overlay + tooltip + controls/conclusion

### Centralized route sync

Added in v7: A dedicated effect in `TutorialProvider` runs when `currentStepIndex` changes:
- Uses `lastSyncedStepIndexRef` to gate (only sync on transitions, not every render)
- Compares `location.pathname` to step's `requiredRoute`
- Navigates if they differ

This ensures backward navigation (Previous button) also syncs routes correctly.

### Route handling and recovery

Composite route logic:
- `requiredRoute` on each step defines where user should be
- `handleRouteChange` in store pauses if user manually leaves required page
- Nav-intent grace window prevents false pauses during nav-target clicks

When route is invalid:
- Tutorial pauses with `wrong-route`
- Overlay provides "Go to Required Page" recovery
- Store auto-resumes if user manually navigates back

### Target discovery

`useTutorialTarget` behavior:
- Searches by `[data-tutorial="..."]`
- Pauses with `target-not-found` after 5s if unresolved
- Observes target rect with `ResizeObserver` + scroll listeners
- Keeps `lastStableRect` for smooth transitions

### Overlay interaction modes

Phase 5 addition: `blockInteractions` prop on `TutorialOverlay`
- `true` (click-target steps): Click-blocking regions surround spotlight
- `false` (click-next steps): Overlay is non-blocking, users can interact freely

Since v7 uses only click-next steps, the overlay is generally non-blocking.

## Tooltip and Overlay System

### Overlay (`TutorialOverlay`)

- SVG mask dims viewport with transparent cutout around target
- Click-blocking regions (configurable via `blockInteractions`)
- Paused-state card with context-aware recovery options

### Tooltip (`TutorialTooltip`)

- Portal-rendered (`z-[9999]`) above overlay (`z-[9998]`)
- Collision-aware placement with floating surface detection
- Repositions on viewport changes, scroll, and DOM mutations

## Persistence and Lifecycle

### Progress persistence

Stored as `AppSettings.tutorialProgress`.

Storage behavior:
- Load from app settings
- Normalize and clamp `currentStepIndex`
- Migrate old versions to re-offer tutorial
- Save on start/resume/step/skip/complete

### Migration rules

When `stored.tutorialVersion < CURRENT_TUTORIAL_VERSION`:
- Reset to inactive progress structure (not marked completed)
- Keeps version current (so it's not re-migrated)
- Triggers auto-start via migrated-reset signature detection

### Tutorial project lifecycle

- Creates memory project at `/memory/projects/tutorial-<timestamp>`
- Writes sentinel file `.vinela-tutorial`
- Seeds graphs, keymaps, options
- Opens via `openProjectForTutorial` (not added to recents)

Cleanup safety:
1. Strict path prefix guard
2. Sentinel existence check
3. Non-fatal cleanup failures

## Targets, Routes, and Integration Points

### Supported required routes

- `/plugins`
- `/keymaps`
- `/neovim-options`
- `/colorschemes`
- `/editor`
- `null` (any route)

### Common `data-tutorial` anchors

Navigation:
- `sidebar`
- `nav-plugins`, `nav-keymaps`, `nav-neovim-options`, `nav-colorschemes`, `nav-editor`, `nav-settings`

Pages:
- `plugins-page`, `keymaps-page`, `neovim-options-page`, `colorschemes-page`
- `graph-canvas` (graph editor)

## Setup Actions

Defined in `src/features/tutorial/data/setup-actions.ts`.

### Inventory (v7)

**Referenced by steps (4):**
- `prepare-plugins-browse` — Reset browse tab state
- `prepare-keymaps-page` — Load keymaps and reset filters
- `reset-neovim-options-tutorial-state` — Reset options page
- `ensure-graph-sidebar-expanded` — Expand graph sidebar

**Registered but unreferenced (11):**
- `select-autocmd-node`
- `prepare-plugin-install-step`
- `ensure-telescope-installed`
- `close-plugin-modal`
- `select-callable-entry-node`
- `select-graph-ref-node`
- `ensure-keymap-editor-open`
- `close-keymap-editor`
- `clear-node-selection`
- `center-on-callable-entry`
- `center-on-graph-ref`

Total: 15 registered actions

## Authoring Guide

### Add/update a step

1. Add `data-tutorial` anchor in relevant UI
2. Add step to `src/features/tutorial/data/steps.ts`
3. Set `requiredRoute` if route-locked
4. Add `setupActionId` when UI preconditions required
5. Use `click-next` for consistent progression
6. Add/adjust tests
7. Validate manually

### Add setup actions

- Keep actions idempotent
- Prefer store updates or scoped DOM events
- Throw meaningful errors for recoverable failures

### Version bump procedure

1. Update `CURRENT_TUTORIAL_VERSION` in `src/shared/types/tutorial.ts`
2. Update steps in `src/features/tutorial/data/steps.ts`
3. Update `TutorialSection` union if sections changed
4. Update documentation (this file)
5. Add tests for migrated-reset behavior
6. Manual QA: verify re-offer works for existing users

## Testing

### Automated coverage

Key test files:
- `src/features/tutorial/__tests__/step-system.test.ts`
- `src/features/tutorial/__tests__/ui-components.test.tsx`
- `src/features/tutorial/__tests__/tutorial-provider-setup-actions.test.tsx`
- `src/test/app.test.tsx` — Sidebar order assertions

### Critical test scenarios

1. **Sidebar + routing defaults** — Nav order, Graph Editor label, /plugins redirect
2. **Tutorial step integrity** — Step count, section order, setup action references
3. **Backward navigation route sync** — Previous button lands on correct route
4. **Overlay interaction modes** — blockInteractions false for click-next steps
5. **Version re-offer behavior** — First launch, migrated reset, interrupted, completed
6. **Conclusion UX** — Bullet count and content match flow

### Manual QA checklist

- [ ] Open folder, dev quick start, recent project, new project all land on `/plugins`
- [ ] Root route with loaded project redirects to `/plugins`
- [ ] Tutorial full run works with only Next controls
- [ ] Previous across section boundaries lands on matching route
- [ ] Overlay is non-blocking on click-next steps
- [ ] Conclusion messaging matches plugins/keymaps/options-first positioning
- [ ] After version bump, tutorial re-offers automatically once

## Troubleshooting

- **Step pauses with `target-not-found`:**
  - Check `data-tutorial` anchor, route, prerequisite UI state
  - Add/fix setup action if visibility depends on transient state

- **Step pauses with `wrong-route`:**
  - Verify `requiredRoute` is correct
  - Check route sync effect is running (step index changes)

- **Step pauses with `setup-action-failed`:**
  - Inspect error details in paused overlay
  - Retry after resolving precondition

- **Tutorial doesn't re-offer after version bump:**
  - Check `CURRENT_TUTORIAL_VERSION` incremented
  - Verify storage migration reset to inactive (not completed)
  - Check `isMigratedResetSignature` detects the pattern

Quick debug snippets:

```ts
import { useTutorialStore } from '@/features/tutorial/store'
console.log(useTutorialStore.getState().runtimeState)
```

```js
document.querySelector('[data-tutorial="your-target-id"]')
```
