/**
 * Tutorial seed project data.
 *
 * Creates deterministic project data for the tutorial project.
 * All IDs are hardcoded strings (not random UUIDs) so tutorial steps
 * can reference specific elements reliably.
 */

import type { KeymapsFile } from '@/features/keymaps/types'
import type { Graph, GraphEdge, GraphNode } from '@/shared/types/graph'
import type { ProjectNeovimOptionsFile } from '@/shared/types/neovim-options'
import type { Project } from '@/shared/types/project'

// ── Deterministic IDs ─────────────────────────────────────────────────────────

export const TUTORIAL_PROJECT_ID = 'tutorial-project'

export const TUTORIAL_GRAPH_IDS = {
  MY_FIRST_CONFIG: 'tutorial-graph-my-first-config',
  GREET_USER: 'tutorial-graph-greet-user',
  EDITOR_SETUP: 'tutorial-graph-editor-setup',
} as const

/**
 * Bump this version whenever the tutorial seed data changes.
 * Used to detect stale tutorial projects and offer re-creation.
 */
export const TUTORIAL_SEED_VERSION = 3

// ── Seed Data Interface ───────────────────────────────────────────────────────

export interface TutorialSeedData {
  readonly version: number
  readonly project: Project
  readonly graphs: readonly Graph[]
  readonly keymaps: KeymapsFile
  readonly neovimOptions: ProjectNeovimOptionsFile
}

// ── Graph Builders ────────────────────────────────────────────────────────────

function buildMyFirstConfigGraph(): Graph {
  const now = Date.now()

  const triggerNode: GraphNode = {
    id: 'tut-node-trigger-startup',
    type: 'trigger',
    definitionId: 'trigger',
    position: { x: 50, y: 200 },
    data: {
      nodeType: 'trigger',
      displayName: 'On Startup',
      triggerType: 'startup',
    },
  }

  const autocmdNode: GraphNode = {
    id: 'tut-node-autocmd-yank-highlight',
    type: 'action',
    definitionId: 'action',
    position: { x: 350, y: 100 },
    data: {
      nodeType: 'action',
      actionType: 'create-autocmd',
      displayName: 'Yank Highlight',
      label: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: ['TextYankPost'],
        patterns: ['*'],
        callbackLua: '', // EMPTY — callback is handled by on-event connection
        groupName: 'YankHighlight',
        once: false,
        nested: false,
      },
    },
  }

  const highlightFnNode: GraphNode = {
    id: 'tut-node-run-fn-highlight-yank',
    type: 'run-function',
    definitionId: 'run-function',
    position: { x: 700, y: 100 },
    data: {
      nodeType: 'run-function',
      displayName: 'Highlight Yanked Text',
      selectedFunctionKey: 'template:highlight-on-yank-default',
      functionSource: {
        type: 'core',
        functionName: 'highlight_on_yank',
      },
      signature: {
        params: [
          {
            name: 'higroup',
            type: 'any',
            optional: true,
            description:
              'The highlight group used to color the yanked text. Controls what color/style the flash effect uses.',
          },
          {
            name: 'timeout',
            type: 'any',
            optional: true,
            description:
              'How long the highlight stays visible, in milliseconds.',
          },
          {
            name: 'on_macro',
            type: 'any',
            optional: true,
            description: 'Whether to show the highlight when running macros.',
          },
          {
            name: 'on_visual',
            type: 'any',
            optional: true,
            description:
              'Whether to show the highlight when yanking from visual mode.',
          },
        ],
        returns: 'void',
        luaCall: 'vim.highlight.on_yank($params)',
      },
      paramDefaults: {
        higroup: { kind: 'scalar', value: 'IncSearch' },
        timeout: { kind: 'scalar', value: 200 },
      },
    },
  }

  const setHighlightNode: GraphNode = {
    id: 'tut-node-set-highlight',
    type: 'action',
    definitionId: 'action',
    position: { x: 350, y: 340 },
    data: {
      nodeType: 'action',
      actionType: 'set-highlight',
      displayName: 'Visual Selection Color',
      label: 'Set Highlight',
      actionConfig: {
        actionConfigType: 'set-highlight',
        groupName: 'Visual',
        foreground: '',
        background: '#3b4261',
        bold: false,
        italic: false,
        underline: false,
      },
    },
  }

  const edges: GraphEdge[] = [
    {
      id: 'edge-tut-trigger-to-autocmd',
      source: triggerNode.id,
      sourcePort: 'exec',
      target: autocmdNode.id,
      targetPort: 'exec',
    },
    {
      id: 'edge-tut-autocmd-on-event-to-fn',
      source: autocmdNode.id,
      sourcePort: 'on-event',
      target: highlightFnNode.id,
      targetPort: 'exec',
    },
    {
      id: 'edge-tut-trigger-to-highlight',
      source: triggerNode.id,
      sourcePort: 'exec',
      target: setHighlightNode.id,
      targetPort: 'exec',
    },
  ]

  return {
    id: TUTORIAL_GRAPH_IDS.MY_FIRST_CONFIG,
    name: 'My First Config',
    description:
      'Highlights yanked text and customizes the Visual selection color on startup.',
    nodes: [triggerNode, autocmdNode, highlightFnNode, setHighlightNode],
    edges,
    createdAt: now,
    updatedAt: now,
    enabled: true,
    order: 0,
  }
}

function buildGreetUserGraph(): Graph {
  const now = Date.now()

  const callableEntryNode: GraphNode = {
    id: 'tut-node-callable-entry',
    type: 'callable-entry',
    definitionId: 'callable-entry',
    position: { x: 50, y: 250 },
    data: {
      nodeType: 'callable-entry',
      displayName: 'Greet User',
      parameters: [],
    },
  }

  const runFunctionNode: GraphNode = {
    id: 'tut-node-run-function-notify',
    type: 'run-function',
    definitionId: 'run-function',
    position: { x: 500, y: 250 },
    data: {
      nodeType: 'run-function',
      displayName: 'Show Notification',
      selectedFunctionKey: 'core:vim_notify',
      functionSource: {
        type: 'core',
        functionName: 'vim_notify',
      },
      signature: {
        params: [
          {
            name: 'message',
            type: 'any',
            optional: false,
            description: 'The notification message text.',
          },
          {
            name: 'level',
            type: 'any',
            optional: true,
            description: 'Log level for the notification.',
          },
          {
            name: 'opts',
            type: 'any',
            optional: true,
            description: 'Optional table of options (title, icon, etc.).',
          },
        ],
        returns: 'void',
        luaCall: 'vim.notify($params)',
      },
      paramDefaults: {
        message: { kind: 'scalar', value: 'Called from another graph!' },
      },
    },
  }

  const returnNode: GraphNode = {
    id: 'tut-node-return',
    type: 'return',
    definitionId: 'return',
    position: { x: 950, y: 250 },
    data: {
      nodeType: 'return',
      displayName: '',
      returnValues: [],
    },
  }

  const edges: GraphEdge[] = [
    {
      id: 'edge-tut-entry-to-run-function',
      source: callableEntryNode.id,
      sourcePort: 'exec',
      target: runFunctionNode.id,
      targetPort: 'exec',
    },
    {
      id: 'edge-tut-run-function-to-return',
      source: runFunctionNode.id,
      sourcePort: 'done',
      target: returnNode.id,
      targetPort: 'exec',
    },
  ]

  return {
    id: TUTORIAL_GRAPH_IDS.GREET_USER,
    name: 'Greet User',
    description:
      'Callable graph that shows a greeting notification. Called from other graphs and keymaps.',
    nodes: [callableEntryNode, runFunctionNode, returnNode],
    edges,
    createdAt: now,
    updatedAt: now,
    enabled: true,
    order: 1,
  }
}

function buildEditorSetupGraph(): Graph {
  const now = Date.now()

  const triggerNode: GraphNode = {
    id: 'tut-node-editor-trigger',
    type: 'trigger',
    definitionId: 'trigger',
    position: { x: 50, y: 250 },
    data: {
      nodeType: 'trigger',
      displayName: 'On Startup',
      triggerType: 'startup',
    },
  }

  const autocmdNode: GraphNode = {
    id: 'tut-node-autocmd-format-on-save',
    type: 'action',
    definitionId: 'action',
    position: { x: 350, y: 100 },
    data: {
      nodeType: 'action',
      actionType: 'create-autocmd',
      displayName: 'Format on Save',
      label: 'Create Autocmd',
      actionConfig: {
        actionConfigType: 'create-autocmd',
        events: ['BufWritePre'],
        patterns: ['*'],
        callbackLua: '', // EMPTY — callback via on-event port
        groupName: 'FormatOnSave',
        once: false,
        nested: false,
      },
    },
  }

  const formatFnNode: GraphNode = {
    id: 'tut-node-run-fn-format',
    type: 'run-function',
    definitionId: 'run-function',
    position: { x: 700, y: 100 },
    data: {
      nodeType: 'run-function',
      displayName: 'Format Code',
      selectedFunctionKey: 'core:lsp_buf_format',
      functionSource: {
        type: 'core',
        functionName: 'lsp_buf_format',
      },
      signature: {
        params: [
          {
            name: 'opts',
            type: 'any',
            optional: true,
            description: 'Options table (async, filter, bufnr, range, etc.).',
          },
        ],
        returns: 'void',
        luaCall: 'vim.lsp.buf.format($params)',
      },
      paramDefaults: {},
    },
  }

  const graphRefNode: GraphNode = {
    id: 'tut-node-graph-ref-greet',
    type: 'graph-ref',
    definitionId: 'graph-ref',
    position: { x: 350, y: 400 },
    data: {
      nodeType: 'graph-ref',
      displayName: 'Greet User',
      referencedGraphId: TUTORIAL_GRAPH_IDS.GREET_USER,
      cachedContract: {
        parameters: [],
        returnValues: [],
      },
    },
  }

  const edges: GraphEdge[] = [
    {
      id: 'edge-tut-editor-trigger-to-autocmd',
      source: triggerNode.id,
      sourcePort: 'exec',
      target: autocmdNode.id,
      targetPort: 'exec',
    },
    {
      id: 'edge-tut-autocmd-on-event-to-format',
      source: autocmdNode.id,
      sourcePort: 'on-event',
      target: formatFnNode.id,
      targetPort: 'exec',
    },
    {
      id: 'edge-tut-editor-trigger-to-graph-ref',
      source: triggerNode.id,
      sourcePort: 'exec',
      target: graphRefNode.id,
      targetPort: 'exec',
    },
  ]

  return {
    id: TUTORIAL_GRAPH_IDS.EDITOR_SETUP,
    name: 'Editor Setup',
    description:
      'Sets up format-on-save using LSP and calls the Greet User graph on startup.',
    nodes: [triggerNode, autocmdNode, formatFnNode, graphRefNode],
    edges,
    createdAt: now,
    updatedAt: now,
    enabled: true,
    order: 2,
  }
}

// ── Main Seed Data Factory ────────────────────────────────────────────────────

/**
 * Creates the tutorial project's seed data.
 * All IDs are deterministic (not random) so tutorial steps
 * can reference specific elements reliably.
 */
export function createTutorialSeedData(): TutorialSeedData {
  const now = Date.now()

  const project: Project = {
    id: TUTORIAL_PROJECT_ID,
    name: 'Tutorial Project',
    description: 'A sample project for the interactive tutorial.',
    createdAt: now,
    lastModifiedAt: now,
  }

  const graphs: readonly Graph[] = [
    buildMyFirstConfigGraph(),
    buildGreetUserGraph(),
    buildEditorSetupGraph(),
  ]

  // KeymapsFile format: { version: 1, keymaps: ProjectKeymap[] }
  const keymaps: KeymapsFile = {
    version: 1,
    keymaps: [
      {
        id: 'tut-keymap-save-file',
        modes: ['n'],
        keySequence: '<leader>w',
        action: {
          actionType: 'run-action',
          config: {
            mode: 'catalog',
            actionType: 'command',
            action: ':write',
            selectedActionKey: 'write',
            paramValues: {},
          },
        },
        description: 'Save file',
        silent: true,
        noremap: true,
        expr: false,
        enabled: true,
      },
      {
        id: 'tut-keymap-format',
        modes: ['n'],
        keySequence: '<leader>f',
        action: {
          actionType: 'run-function',
          selectedFunctionKey: 'core:lsp_buf_format',
          functionSource: {
            type: 'core',
            functionName: 'lsp_buf_format',
          },
          signature: {
            params: [
              {
                name: 'opts',
                type: 'any',
                optional: true,
                description:
                  'Options table (async, filter, bufnr, range, etc.).',
              },
            ],
            returns: 'void',
            luaCall: 'vim.lsp.buf.format($params)',
          },
          paramDefaults: {},
        },
        description: 'Format current file with LSP',
        silent: true,
        noremap: true,
        expr: false,
        enabled: true,
      },
      {
        id: 'tut-keymap-greet',
        modes: ['n'],
        keySequence: '<leader>g',
        action: {
          actionType: 'run-custom-action',
          graphId: TUTORIAL_GRAPH_IDS.GREET_USER,
          graphName: 'Greet User',
        },
        description: 'Run Greet User callable graph',
        silent: true,
        noremap: true,
        expr: false,
        enabled: true,
      },
    ],
  }

  const neovimOptions: ProjectNeovimOptionsFile = {
    version: 1,
    options: {
      number: { valueType: 'boolean', value: true },
      relativenumber: { valueType: 'boolean', value: true },
      expandtab: { valueType: 'boolean', value: true },
      shiftwidth: { valueType: 'number', value: 2 },
    },
    updatedAt: now,
  }

  return {
    version: TUTORIAL_SEED_VERSION,
    project,
    graphs,
    keymaps,
    neovimOptions,
  }
}
