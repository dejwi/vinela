import { PROJECT_PATHS } from '@/shared/lib/paths'
import {
  projectFileExists,
  readProjectFile,
  readProjectTextFile,
  writeProjectFile,
  writeProjectTextFile,
} from '@/shared/lib/storage-api'
import type {
  ProjectProfile,
  ProjectProfilesFile,
  ProjectProfilesLocalFile,
} from '@/shared/types'
import { DEFAULT_PROFILE_COLOR } from './profile-state'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function normalizeProfile(value: unknown): ProjectProfile | null {
  if (!isRecord(value)) return null
  const id = typeof value['id'] === 'string' ? value['id'].trim() : ''
  const name = typeof value['name'] === 'string' ? value['name'].trim() : ''
  if (!id || !name) return null
  const color =
    typeof value['color'] === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(value['color'])
      ? value['color'].toLowerCase()
      : DEFAULT_PROFILE_COLOR
  return {
    id,
    name,
    color,
    defaultActive:
      typeof value['defaultActive'] === 'boolean'
        ? value['defaultActive']
        : true,
  }
}

/** @internal — exported for testing only */
export function normalizeProjectProfilesFile(
  value: unknown,
): ProjectProfilesFile {
  const profiles =
    isRecord(value) && Array.isArray(value['profiles']) ? value['profiles'] : []
  const ids = new Set<string>()
  return {
    version: 1,
    profiles: profiles.flatMap((value) => {
      const profile = normalizeProfile(value)
      if (profile === null || ids.has(profile.id)) return []
      ids.add(profile.id)
      return [profile]
    }),
  }
}

/** @internal — exported for testing only */
export function normalizeProjectProfileOverrides(
  value: unknown,
): Record<string, boolean> {
  if (!isRecord(value) || !isRecord(value['overrides'])) return {}
  const overrides: Record<string, boolean> = {}
  for (const [key, entry] of Object.entries(value['overrides']))
    if (typeof entry === 'boolean') overrides[key] = entry
  return overrides
}

export async function loadProjectProfiles(
  projectPath: string,
): Promise<ProjectProfile[]> {
  if (!(await projectFileExists(projectPath, PROJECT_PATHS.PROFILES))) return []
  return normalizeProjectProfilesFile(
    await readProjectFile<unknown>(projectPath, PROJECT_PATHS.PROFILES),
  ).profiles
}

export async function saveProjectProfiles(
  projectPath: string,
  profiles: readonly ProjectProfile[],
): Promise<void> {
  await writeProjectFile<ProjectProfilesFile>(
    projectPath,
    PROJECT_PATHS.PROFILES,
    {
      version: 1,
      profiles: [...profiles],
    },
  )
}

export async function loadProjectProfileOverrides(
  projectPath: string,
): Promise<Record<string, boolean>> {
  if (!(await projectFileExists(projectPath, PROJECT_PATHS.PROFILES_LOCAL)))
    return {}
  return normalizeProjectProfileOverrides(
    await readProjectFile<unknown>(projectPath, PROJECT_PATHS.PROFILES_LOCAL),
  )
}

export async function saveProjectProfileOverrides(
  projectPath: string,
  overrides: Readonly<Record<string, boolean>>,
): Promise<void> {
  await writeProjectFile<ProjectProfilesLocalFile>(
    projectPath,
    PROJECT_PATHS.PROFILES_LOCAL,
    { version: 1, overrides: { ...overrides } },
  )
}

export async function ensureProjectProfilesSetup(
  projectPath: string,
): Promise<void> {
  if (!(await projectFileExists(projectPath, PROJECT_PATHS.PROFILES))) {
    await writeProjectFile<ProjectProfilesFile>(
      projectPath,
      PROJECT_PATHS.PROFILES,
      { version: 1, profiles: [] },
    )
  }
  if (await projectFileExists(projectPath, PROJECT_PATHS.GITIGNORE)) {
    const content = await readProjectTextFile(
      projectPath,
      PROJECT_PATHS.GITIGNORE,
    )
    const rules = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
    if (rules[rules.length - 1] !== '/profiles.local.json') {
      await writeProjectTextFile(
        projectPath,
        PROJECT_PATHS.GITIGNORE,
        `${content}${content && !content.endsWith('\n') ? '\n' : ''}/profiles.local.json\n`,
      )
    }
  } else {
    await writeProjectTextFile(
      projectPath,
      PROJECT_PATHS.GITIGNORE,
      '/profiles.local.json\n',
    )
  }
  if (!(await projectFileExists(projectPath, PROJECT_PATHS.PROFILES_LOCAL))) {
    await writeProjectFile<ProjectProfilesLocalFile>(
      projectPath,
      PROJECT_PATHS.PROFILES_LOCAL,
      { version: 1, overrides: {} },
    )
  }
}
