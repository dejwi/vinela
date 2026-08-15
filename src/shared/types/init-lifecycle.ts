/**
 * Discriminated union for store initialization status.
 * Used by project-scoped stores to communicate their loading state
 * to UI components without conflating "not yet loaded" with "empty data".
 */
export type StoreInitStatus =
  | { status: 'idle' }
  | { status: 'loading'; projectPath: string }
  | { status: 'ready'; projectPath: string }
  | { status: 'error'; projectPath: string; error: string }

/**
 * Type guard: returns true when the store has completed initialization
 * for the given project (successfully or not).
 */
export function isInitComplete(
  initStatus: StoreInitStatus,
  projectPath: string,
): boolean {
  if (initStatus.status === 'idle' || initStatus.status === 'loading') {
    return false
  }
  return initStatus.projectPath === projectPath
}

/**
 * Type guard: returns true when the store is ready (successfully loaded)
 * for the given project.
 */
export function isInitReady(
  initStatus: StoreInitStatus,
  projectPath: string,
): boolean {
  return initStatus.status === 'ready' && initStatus.projectPath === projectPath
}
