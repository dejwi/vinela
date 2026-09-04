import { v4 as uuidv4 } from 'uuid'
import { ensureProjectProfilesSetup } from '@/features/profiles/storage'
import { PROJECT_PATHS } from '@/shared/lib/paths'
import {
  ensureProjectDir,
  folderExists,
  getDevProjectPath,
  isDevMode,
  isValidProject,
  listFolder,
  projectFileExists,
  readProjectFile,
  writeProjectFile,
} from '@/shared/lib/storage-api'
import type { LoadedProject, Project } from '@/shared/types'
import exampleColorschemes from '../../../example-vinela-project/colorschemes.json'
import exampleGraph from '../../../example-vinela-project/graphs/aa33917f-fd5e-46bb-85f7-e3922b26cc10.json'
import exampleKeymaps from '../../../example-vinela-project/keymaps.json'
import exampleLspServers from '../../../example-vinela-project/lsp-servers.json'
import exampleNeovimOptions from '../../../example-vinela-project/neovim-options.json'
import examplePlugins from '../../../example-vinela-project/plugins.json'
import exampleProfiles from '../../../example-vinela-project/profiles.json'
import exampleTokyonightSchema from '../../../example-vinela-project/schemas/tokyonight.json'

// ============================================
// Result Types (Discriminated Unions)
// ============================================

export type OpenProjectResult =
  | { success: true; project: LoadedProject }
  | {
      success: false
      error: 'not_found' | 'invalid_project' | 'read_error'
      message: string
    }

export type CreateProjectResult =
  | { success: true; project: LoadedProject }
  | {
      success: false
      error: 'folder_not_empty' | 'already_exists' | 'write_error'
      message: string
      requiresConfirmation?: boolean
    }

export type DevProjectInitStage =
  | 'resolve_path'
  | 'open_existing'
  | 'create_project'
  | 'final_open'

export type DevProjectInitResult =
  | {
      success: true
      project: LoadedProject
      path: string
    }
  | {
      success: false
      stage: DevProjectInitStage
      path: string
      message: string
    }

// ============================================
// Project Operations
// ============================================

/**
 * Open an existing project from a folder.
 * Returns error if folder doesn't contain a valid project.
 */
export async function openProject(
  folderPath: string,
): Promise<OpenProjectResult> {
  // Check if folder exists
  const exists = await folderExists(folderPath)
  if (!exists) {
    return {
      success: false,
      error: 'not_found',
      message: `Folder not found: ${folderPath}`,
    }
  }

  // Check if it's a valid project
  const isValid = await isValidProject(folderPath)
  if (!isValid) {
    return {
      success: false,
      error: 'invalid_project',
      message:
        'No Vinela project found. Expected project.json directly in the selected folder.',
    }
  }

  try {
    const project = await readProjectFile<Project>(
      folderPath,
      PROJECT_PATHS.PROJECT_JSON,
    )
    await ensureProjectProfilesSetup(folderPath)
    return {
      success: true,
      project: {
        ...project,
        absolutePath: folderPath,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: 'read_error',
      message: `Failed to read project: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Create a new project in a folder.
 * @param folderPath - Absolute path to the folder
 * @param name - Project name
 * @param description - Optional description
 * @param force - Skip confirmation for non-empty folders
 */
export async function createProject(
  folderPath: string,
  name: string,
  description?: string,
  force = false,
): Promise<CreateProjectResult> {
  // Check if already a project
  const alreadyExists = await isValidProject(folderPath)
  if (alreadyExists) {
    return {
      success: false,
      error: 'already_exists',
      message: 'A project already exists in this folder.',
    }
  }

  // Check if folder has existing files (needs confirmation)
  const exists = await folderExists(folderPath)
  if (exists && !force) {
    try {
      const contents = await listFolder(folderPath)
      // Filter out hidden files for the check
      const visibleFiles = contents.filter((f) => !f.name.startsWith('.'))
      if (visibleFiles.length > 0) {
        return {
          success: false,
          error: 'folder_not_empty',
          message: 'This folder contains files. Create a project here anyway?',
          requiresConfirmation: true,
        }
      }
    } catch {
      // If we can't list, proceed anyway
    }
  }

  try {
    const id = uuidv4()
    const now = Date.now()

    const project: Project = {
      id,
      name,
      description,
      createdAt: now,
      lastModifiedAt: now,
    }

    // Create project directory structure
    await ensureProjectDir(folderPath, PROJECT_PATHS.GRAPHS)
    await ensureProjectDir(folderPath, PROJECT_PATHS.SCHEMAS)
    await ensureProjectProfilesSetup(folderPath)

    // Write project.json
    await writeProjectFile(folderPath, PROJECT_PATHS.PROJECT_JSON, project)

    return {
      success: true,
      project: {
        ...project,
        absolutePath: folderPath,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: 'write_error',
      message: `Failed to create project: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

export async function createExampleProject(
  folderPath: string,
  name: string,
  description?: string,
): Promise<CreateProjectResult> {
  try {
    if (await isValidProject(folderPath)) {
      return {
        success: false,
        error: 'already_exists',
        message: 'A project already exists in this folder.',
      }
    }

    if (await folderExists(folderPath)) {
      const contents = await listFolder(folderPath)
      if (contents.some((entry) => !entry.name.startsWith('.'))) {
        return {
          success: false,
          error: 'folder_not_empty',
          message:
            'The selected folder must be empty to create an example project.',
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'write_error',
      message: `Failed to inspect example project folder: ${formatUnknownError(error)}`,
    }
  }

  try {
    await ensureProjectDir(folderPath, PROJECT_PATHS.GRAPHS)
    await ensureProjectDir(folderPath, PROJECT_PATHS.SCHEMAS)
    await writeProjectFile(folderPath, 'colorschemes.json', exampleColorschemes)
    await writeProjectFile(
      folderPath,
      'graphs/aa33917f-fd5e-46bb-85f7-e3922b26cc10.json',
      exampleGraph,
    )
    await writeProjectFile(folderPath, 'keymaps.json', exampleKeymaps)
    await writeProjectFile(folderPath, 'lsp-servers.json', exampleLspServers)
    await writeProjectFile(folderPath, PROJECT_PATHS.PROFILES, exampleProfiles)
    await writeProjectFile(
      folderPath,
      'neovim-options.json',
      exampleNeovimOptions,
    )
    await writeProjectFile(folderPath, 'plugins.json', examplePlugins)
    await writeProjectFile(
      folderPath,
      'schemas/tokyonight.json',
      exampleTokyonightSchema,
    )
    return await createProject(folderPath, name, description, true)
  } catch (error) {
    return {
      success: false,
      error: 'write_error',
      message: `Failed to create example project: ${formatUnknownError(error)}`,
    }
  }
}

/**
 * Update project metadata.
 */
export async function updateProject(project: LoadedProject): Promise<void> {
  const updatedProject: Project = {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    lastModifiedAt: Date.now(),
  }
  await writeProjectFile(
    project.absolutePath,
    PROJECT_PATHS.PROJECT_JSON,
    updatedProject,
  )
}

/**
 * Delete a project.
 * This is intentionally a no-op for safety. Users should manually delete project folders.
 */
export async function deleteProject(folderPath: string): Promise<void> {
  // This is intentionally a no-op for safety. Users should manually delete project folders.
  // The project will be removed from recent projects list separately.
  console.warn(
    `deleteProject called for ${folderPath} - project data should be manually deleted if needed`,
  )
}

// ============================================
// Dev Mode Helpers
// ============================================

const DEV_BOOTSTRAP_LOG_TAG = '[dev-bootstrap]'
const UNRESOLVED_DEV_PATH = '(unresolved)'

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function logDevBootstrap(
  stage: DevProjectInitStage,
  path: string,
  outcome: 'start' | 'success' | 'continue' | 'failure',
  message?: string,
): void {
  if (!isDevMode()) {
    return
  }

  const details = message ? ` - ${message}` : ''
  console.info(
    `${DEV_BOOTSTRAP_LOG_TAG} stage=${stage} outcome=${outcome} path=${path}${details}`,
  )
}

function failDevProjectInit(
  stage: DevProjectInitStage,
  path: string,
  message: string,
  error?: unknown,
): DevProjectInitResult {
  if (isDevMode() && error !== undefined) {
    console.error(
      `${DEV_BOOTSTRAP_LOG_TAG} stage=${stage} path=${path} exception=`,
      error,
    )
  }

  logDevBootstrap(stage, path, 'failure', message)

  return {
    success: false,
    stage,
    path,
    message,
  }
}

/**
 * Get or create the dev mode default project.
 * Only used when import.meta.env.DEV is true.
 */
export async function getOrCreateDevProject(): Promise<DevProjectInitResult> {
  if (!isDevMode()) {
    return failDevProjectInit(
      'resolve_path',
      UNRESOLVED_DEV_PATH,
      'Dev mode project bootstrap was called while not in dev mode.',
    )
  }

  logDevBootstrap('resolve_path', UNRESOLVED_DEV_PATH, 'start')

  let devPath: string
  try {
    const resolvedPath = await getDevProjectPath()
    if (!resolvedPath) {
      return failDevProjectInit(
        'resolve_path',
        UNRESOLVED_DEV_PATH,
        'Failed to resolve dev project path.',
      )
    }

    devPath = resolvedPath
    logDevBootstrap('resolve_path', devPath, 'success')
  } catch (error) {
    return failDevProjectInit(
      'resolve_path',
      UNRESOLVED_DEV_PATH,
      `Failed to resolve dev project path: ${formatUnknownError(error)}`,
      error,
    )
  }

  logDevBootstrap('open_existing', devPath, 'start')

  try {
    const openResult = await openProject(devPath)
    if (openResult.success) {
      logDevBootstrap('open_existing', devPath, 'success')
      return {
        success: true,
        project: openResult.project,
        path: devPath,
      }
    }

    logDevBootstrap(
      'open_existing',
      devPath,
      'continue',
      `${openResult.error}: ${openResult.message}`,
    )
  } catch (error) {
    const errorMessage = formatUnknownError(error)
    if (isDevMode()) {
      console.error(
        `${DEV_BOOTSTRAP_LOG_TAG} stage=open_existing path=${devPath} exception=`,
        error,
      )
    }
    logDevBootstrap(
      'open_existing',
      devPath,
      'continue',
      `open threw exception: ${errorMessage}`,
    )
  }

  logDevBootstrap('create_project', devPath, 'start')

  try {
    const createResult = await createProject(
      devPath,
      'Dev Project',
      'Auto-created development project',
      true,
    )

    if (!createResult.success) {
      return failDevProjectInit('create_project', devPath, createResult.message)
    }
  } catch (error) {
    return failDevProjectInit(
      'create_project',
      devPath,
      `Failed to create dev project: ${formatUnknownError(error)}`,
      error,
    )
  }

  try {
    const hasProjectFile = await projectFileExists(
      devPath,
      PROJECT_PATHS.PROJECT_JSON,
    )
    if (!hasProjectFile) {
      return failDevProjectInit(
        'create_project',
        devPath,
        `Project bootstrap did not create ${PROJECT_PATHS.PROJECT_JSON}.`,
      )
    }
    logDevBootstrap('create_project', devPath, 'success')
  } catch (error) {
    return failDevProjectInit(
      'create_project',
      devPath,
      `Failed to verify ${PROJECT_PATHS.PROJECT_JSON}: ${formatUnknownError(error)}`,
      error,
    )
  }

  logDevBootstrap('final_open', devPath, 'start')

  try {
    const finalOpenResult = await openProject(devPath)
    if (finalOpenResult.success) {
      logDevBootstrap('final_open', devPath, 'success')
      return {
        success: true,
        project: finalOpenResult.project,
        path: devPath,
      }
    }

    return failDevProjectInit('final_open', devPath, finalOpenResult.message)
  } catch (error) {
    return failDevProjectInit(
      'final_open',
      devPath,
      `Failed to load dev project after creation: ${formatUnknownError(error)}`,
      error,
    )
  }
}
