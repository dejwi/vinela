import { isMemoryMode } from './storage'

/**
 * Discriminated union result for HTTP operations.
 * Follows the project's Result pattern — never nullable data/error fields.
 */
export type HttpResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Perform an HTTP GET using the appropriate fetch implementation.
 *
 * In Tauri (desktop) mode: uses the Tauri HTTP plugin fetch, which respects
 * the capability permissions defined in default.json.
 *
 * In memory (browser) mode: uses the native global fetch(). GitHub API and
 * raw.githubusercontent.com both support CORS, so this works without a proxy.
 */
async function performFetch(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    if (!isMemoryMode()) {
      // Tauri desktop mode: use the Tauri HTTP plugin fetch
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      return await tauriFetch(url, { signal: controller.signal })
    }
    // Browser / memory mode: use native fetch
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch JSON from a URL. Uses Tauri HTTP plugin in desktop mode,
 * native fetch() in browser/memory mode.
 *
 * Always returns HttpResult<T> — never throws.
 */
export async function fetchJson<T>(
  url: string,
  options?: { timeout?: number },
): Promise<HttpResult<T>> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS

  try {
    const response = await performFetch(url, timeoutMs)

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    let data: T
    try {
      data = (await response.json()) as T
    } catch {
      return {
        success: false,
        error: 'Failed to parse response as JSON',
      }
    }

    return { success: true, data }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: `Request timed out after ${timeoutMs}ms` }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Fetch raw text from a URL.
 * Uses Tauri HTTP plugin in desktop mode, native fetch() in browser/memory mode.
 *
 * Always returns HttpResult<string> — never throws.
 */
export async function fetchText(
  url: string,
  options?: { timeout?: number },
): Promise<HttpResult<string>> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS

  try {
    const response = await performFetch(url, timeoutMs)

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    let data: string
    try {
      data = await response.text()
    } catch {
      return {
        success: false,
        error: 'Failed to read response text',
      }
    }

    return { success: true, data }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: `Request timed out after ${timeoutMs}ms` }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
