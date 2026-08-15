/**
 * Minimal Project Fixture
 *
 * A minimal working project with a single startup graph.
 */

import type { ProjectFixture } from '../../utils/temp-project'
import { simpleStartupGraph } from '../graphs/simple-startup'

export const minimalProject: ProjectFixture = {
  project: {
    id: 'minimal-project',
    name: 'Minimal Test Project',
    description: 'A minimal project for testing',
    createdAt: Date.now(),
    lastModifiedAt: Date.now(),
  },
  graphs: [simpleStartupGraph],
  plugins: [],
  options: {
    version: 1,
    options: {
      number: { valueType: 'boolean', value: true },
      relativenumber: { valueType: 'boolean', value: true },
    },
    leaderKey: ' ',
    updatedAt: Date.now(),
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
