import { APP_LOG_PREFIX } from './app-identity'
import type { StorageBackend } from './storage-backend'
import { isBrowserOnlyRuntime, isTauriAvailable } from './tauri-runtime'

/** Cached singleton backend instance */
let backend: StorageBackend | null = null

/** Cached memory-only backend instance for tutorial routing */
let memoryBackend: StorageBackend | null = null

/**
 * Get the storage backend singleton.
 * Auto-detects Tauri vs browser environment on first call.
 * Uses dynamic import to avoid loading Tauri modules in browser.
 */
export async function getStorageBackend(): Promise<StorageBackend> {
  if (backend !== null) {
    return backend
  }

  if (isTauriAvailable()) {
    const { TauriStorageBackend } = await import('./tauri-storage-backend')
    backend = new TauriStorageBackend()
  } else {
    backend = await getMemoryBackend()
    console.info(
      `%c${APP_LOG_PREFIX} Running in memory mode (no Tauri detected)`,
      'color: #f59e0b; font-weight: bold',
    )
  }

  return backend
}

/**
 * Override the runtime storage backend.
 * Intended for scripts and tests that need filesystem-backed access without Tauri.
 */
export function setStorageBackendForRuntime(nextBackend: StorageBackend): void {
  backend = nextBackend
}

/**
 * Reset the runtime storage backend override.
 * Intended for scripts and tests only.
 */
export function resetStorageBackendForRuntime(): void {
  backend = null
}

/**
 * Gets a dedicated memory backend instance, initializing it if needed.
 */
async function getMemoryBackend(): Promise<StorageBackend> {
  if (memoryBackend !== null) {
    return memoryBackend
  }
  const { MemoryStorageBackend } = await import('./memory-storage-backend')
  memoryBackend = new MemoryStorageBackend()
  return memoryBackend
}

/**
 * Gets the appropriate storage backend based on project path.
 * Routes paths starting with /memory/ to the memory backend, even in Tauri mode.
 */
export async function getProjectStorageBackend(
  projectPath: string,
): Promise<StorageBackend> {
  if (projectPath.startsWith('/memory/')) {
    return getMemoryBackend()
  }
  return getStorageBackend()
}

/**
 * Check if running in memory mode (no Tauri).
 * Returns false until getStorageBackend() has been called.
 */
export function isMemoryMode(): boolean {
  return isBrowserOnlyRuntime()
}

/**
 * Reset the backend (for testing only).
 */
export function _resetBackend(): void {
  resetStorageBackendForRuntime()
}
