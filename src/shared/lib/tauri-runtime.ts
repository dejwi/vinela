export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function isBrowserOnlyRuntime(): boolean {
  return !isTauriAvailable()
}
