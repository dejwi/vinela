const STORAGE_KEY = 'vinela:recently-used-functions'
const MAX_RECENT = 5

export interface RecentFunction {
  key: string // Function catalog key, e.g. "core:expand" or "plugin:telescope.nvim:find_files"
  usedAt: number // timestamp
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getRecentlyUsedFunctions(): RecentFunction[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const stored = storage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

export function addRecentlyUsedFunction(key: string): void {
  const storage = getStorage()
  if (!storage) return
  const recent = getRecentlyUsedFunctions()
  const filtered = recent.filter((r) => r.key !== key)
  const updated: RecentFunction[] = [
    { key, usedAt: Date.now() },
    ...filtered,
  ].slice(0, MAX_RECENT)
  storage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function clearRecentlyUsedFunctions(): void {
  const storage = getStorage()
  if (!storage) return
  storage.removeItem(STORAGE_KEY)
}
