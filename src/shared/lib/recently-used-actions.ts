const STORAGE_KEY = 'vinela:recently-used-actions'
const MAX_RECENT = 5

export interface RecentAction {
  key: string
  usedAt: number // timestamp
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getRecentlyUsedActions(): RecentAction[] {
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

export function addRecentlyUsedAction(key: string): void {
  const storage = getStorage()
  if (!storage) return

  const recent = getRecentlyUsedActions()

  // Remove if already exists
  const filtered = recent.filter((r) => r.key !== key)

  // Add to front
  const updated: RecentAction[] = [
    { key, usedAt: Date.now() },
    ...filtered,
  ].slice(0, MAX_RECENT)

  storage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function clearRecentlyUsedActions(): void {
  const storage = getStorage()
  if (!storage) return

  storage.removeItem(STORAGE_KEY)
}
