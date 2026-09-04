import type { ProjectProfile } from '@/shared/types'
import type { ProjectKeymap } from './types'

export type KeymapActivationState =
  | { kind: 'local'; enabled: boolean }
  | { kind: 'profiles'; enabled: boolean }
  | { kind: 'override'; enabled: boolean }

export function resolveKeymapActivation(
  keymap: Pick<ProjectKeymap, 'enabled' | 'enabledOverride' | 'profileIds'>,
  profiles: readonly ProjectProfile[],
  activeProfileIds: ReadonlySet<string>,
): KeymapActivationState {
  const defined = new Set(profiles.map((profile) => profile.id))
  const assigned = (keymap.profileIds ?? []).filter((id) => defined.has(id))
  if (assigned.length === 0) return { kind: 'local', enabled: keymap.enabled }
  if (typeof keymap.enabledOverride === 'boolean')
    return { kind: 'override', enabled: keymap.enabledOverride }
  return {
    kind: 'profiles',
    enabled: assigned.some((id) => activeProfileIds.has(id)),
  }
}
