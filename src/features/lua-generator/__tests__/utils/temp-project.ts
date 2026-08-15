/**
 * Temporary Project Utility
 *
 * Creates isolated temporary projects for integration tests.
 * Uses memory storage for speed and isolation.
 */

import type { KeymapsFile, ProjectKeymap } from '@/features/keymaps/types'
import { PROJECT_PATHS } from '@/shared/lib/paths'
import * as storage from '@/shared/lib/storage-api'
import type {
  Graph,
  Project,
  ProjectColorSchemesFile,
  ProjectLspConfig,
  ProjectNeovimOptionsFile,
} from '@/shared/types'

export interface ProjectFixture {
  project: Project
  graphs: Graph[]
  plugins: Array<{
    id: string
    schemaId: string
    enabled: boolean
    config: Record<string, unknown>
  }>
  options: ProjectNeovimOptionsFile
  keymaps: ProjectKeymap[]
  lsp: ProjectLspConfig
  colorscheme: ProjectColorSchemesFile
}

export interface TempProjectResult {
  projectPath: string
  projectId: string
  cleanup: () => Promise<void>
}

let tempProjectCounter = 0

/**
 * Create a temporary project from a fixture.
 * Uses memory storage at /memory/projects/test-{timestamp}-{counter}.
 */
export async function createTempProject(
  fixture: ProjectFixture,
): Promise<TempProjectResult> {
  const timestamp = Date.now()
  const counter = ++tempProjectCounter
  const projectPath = `/memory/projects/test-${timestamp}-${counter}`
  const projectId = fixture.project.id

  // Write project.json
  await storage.writeProjectFile(
    projectPath,
    PROJECT_PATHS.PROJECT_JSON,
    fixture.project,
  )

  // Write graphs
  for (const graph of fixture.graphs) {
    const graphPath = `${PROJECT_PATHS.GRAPHS}/${graph.id}.json`
    await storage.writeProjectFile(projectPath, graphPath, graph)
  }

  // Write neovim options
  await storage.writeProjectFile(
    projectPath,
    PROJECT_PATHS.NEOVIM_OPTIONS,
    fixture.options,
  )

  // Write keymaps
  const keymapsFile: KeymapsFile = {
    version: 1,
    keymaps: fixture.keymaps,
  }
  await storage.writeProjectFile(
    projectPath,
    PROJECT_PATHS.KEYMAPS,
    keymapsFile,
  )

  // Write LSP config
  await storage.writeProjectFile(
    projectPath,
    PROJECT_PATHS.LSP_SERVERS,
    fixture.lsp,
  )

  // Write colorscheme config
  await storage.writeProjectFile(
    projectPath,
    'colorschemes.json',
    fixture.colorscheme,
  )

  // Write plugins (stored in a custom file for test fixtures)
  await storage.writeProjectFile(projectPath, 'plugins.json', {
    plugins: fixture.plugins,
  })

  return {
    projectPath,
    projectId,
    cleanup: async () => {
      await cleanupTempProject(projectPath)
    },
  }
}

/**
 * Clean up a temporary project.
 * Removes all files associated with the project.
 */
async function cleanupTempProject(projectPath: string): Promise<void> {
  try {
    // In memory mode, we need to manually remove files
    // List all files and remove them
    const filesToRemove = [
      PROJECT_PATHS.PROJECT_JSON,
      PROJECT_PATHS.NEOVIM_OPTIONS,
      PROJECT_PATHS.KEYMAPS,
      PROJECT_PATHS.LSP_SERVERS,
      'colorschemes.json',
      'plugins.json',
    ]

    for (const file of filesToRemove) {
      try {
        await storage.removeProjectFile(projectPath, file)
      } catch {
        // Ignore errors for files that don't exist
      }
    }

    // Remove graphs directory contents
    try {
      const graphEntries = await storage.listProjectDir(
        projectPath,
        PROJECT_PATHS.GRAPHS,
      )
      for (const entry of graphEntries) {
        if (entry.isFile) {
          await storage.removeProjectFile(
            projectPath,
            `${PROJECT_PATHS.GRAPHS}/${entry.name}`,
          )
        }
      }
    } catch {
      // Ignore errors if graphs directory doesn't exist
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create an empty fixture with defaults.
 */
export function createEmptyFixture(
  projectName = 'Test Project',
): ProjectFixture {
  const now = Date.now()
  return {
    project: {
      id: `proj-${now}`,
      name: projectName,
      description: 'Test project',
      createdAt: now,
      lastModifiedAt: now,
    },
    graphs: [],
    plugins: [],
    options: {
      version: 1,
      options: {},
      updatedAt: now,
    },
    keymaps: [],
    lsp: {
      enabledServers: [],
    },
    colorscheme: {
      activeScheme: null,
      variantPreferences: {},
    },
  }
}
