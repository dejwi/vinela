import type { ProjectProfile } from '@/shared/types'

export const DEFAULT_PROFILE_COLOR = '#6366f1'

export function getActiveProfileIds(
  profiles: readonly ProjectProfile[],
  overrides: Readonly<Record<string, boolean>>,
): ReadonlySet<string> {
  return new Set(
    profiles
      .filter((profile) => overrides[profile.id] ?? profile.defaultActive)
      .map((profile) => profile.id),
  )
}
