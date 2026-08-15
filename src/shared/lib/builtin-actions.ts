// ============================================
// Shared Builtin Action Port Definitions
// UI-free runtime metadata for builtin nodes
// ============================================
//
// This module provides port type metadata for builtin action nodes in a form
// that is safe to import from any layer (lua-generator, diagnostics, etc.)
// without pulling in UI dependencies (lucide-react icons, etc.).
//
// The full BuiltinActionDefinition (with icon, configSchema, getPreview, etc.)
// lives in src/features/graph-editor/data/builtin-actions.ts and is only
// imported by UI code.

import type { Port } from '@/shared/types'

/**
 * Minimal port specification for a builtin action node.
 * Contains only what is needed for type-checking and code generation.
 */
export interface BuiltinActionPortSpec {
  id: string
  inputs: Port[]
  outputs: Port[]
}

const EXEC_INPUT: Port = {
  id: 'exec',
  label: 'Execute',
  dataType: 'void',
  required: true,
}

const DONE_OUTPUT: Port = {
  id: 'done',
  label: 'Done',
  dataType: 'void',
}

/**
 * Registry of port specs for all builtin action nodes.
 * Must be kept in sync with BUILTIN_ACTIONS in graph-editor/data/builtin-actions.ts.
 */
const BUILTIN_ACTION_PORT_SPECS: readonly BuiltinActionPortSpec[] = [
  {
    id: 'ui.notify',
    inputs: [
      EXEC_INPUT,
      { id: 'message', label: 'Message', dataType: 'string', required: false },
      { id: 'title', label: 'Title', dataType: 'string', required: false },
    ],
    outputs: [DONE_OUTPUT],
  },
  {
    id: 'buffers.open-file',
    inputs: [
      EXEC_INPUT,
      { id: 'path', label: 'Path', dataType: 'string', required: false },
    ],
    outputs: [DONE_OUTPUT],
  },
  {
    id: 'automation.delay',
    inputs: [EXEC_INPUT],
    outputs: [DONE_OUTPUT],
  },
  {
    id: 'input.prompt',
    inputs: [EXEC_INPUT],
    outputs: [DONE_OUTPUT, { id: 'value', label: 'Value', dataType: 'string' }],
  },
]

/**
 * Look up the port spec for a builtin action by its ID.
 * Returns null if the ID is not a known builtin.
 */
export function getBuiltinActionPortSpec(
  builtinId: string,
): BuiltinActionPortSpec | null {
  return BUILTIN_ACTION_PORT_SPECS.find((spec) => spec.id === builtinId) ?? null
}
