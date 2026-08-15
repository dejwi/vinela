import { DEFAULT_TEST_TARGET_NEOVIM } from '@/features/lua-generator/diagnostics'
import type { OrchestratorOptions } from '@/features/lua-generator/types'

export function createOrchestratorOptions(
  projectPath: string,
  overrides?: Omit<
    Partial<OrchestratorOptions>,
    'projectPath' | 'targetNeovim'
  >,
): OrchestratorOptions {
  return {
    projectPath,
    targetNeovim: DEFAULT_TEST_TARGET_NEOVIM,
    ...overrides,
  }
}

export { DEFAULT_TEST_TARGET_NEOVIM }
