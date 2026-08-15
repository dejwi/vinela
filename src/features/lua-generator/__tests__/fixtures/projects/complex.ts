/**
 * Complex Project Fixture
 *
 * A complex project with multiple graphs, all node types,
 * plugins, keymaps, LSP servers, and colorscheme.
 */

import type { ProjectFixture } from '../../utils/temp-project'
import { allNodesGraph } from '../graphs/all-nodes'
import { callableGraph, multiParamCallableGraph } from '../graphs/callable'
import { conditionalGraph, nestedConditionalGraph } from '../graphs/conditional'
import {
  eachLoopGraph,
  forLoopGraph,
  whileLoopGraph,
} from '../graphs/loop-types'
import { simpleStartupGraph } from '../graphs/simple-startup'

export const complexProject: ProjectFixture = {
  project: {
    id: 'complex-project',
    name: 'Complex Test Project',
    description: 'A complex project with all features',
    createdAt: Date.now(),
    lastModifiedAt: Date.now(),
  },
  graphs: [
    simpleStartupGraph,
    conditionalGraph,
    nestedConditionalGraph,
    forLoopGraph,
    whileLoopGraph,
    eachLoopGraph,
    callableGraph,
    multiParamCallableGraph,
    allNodesGraph,
  ],
  plugins: [
    {
      id: 'plugin-1',
      schemaId: 'telescope-nvim',
      enabled: true,
      config: {
        defaults: {
          prompt_prefix: '> ',
        },
      },
    },
    {
      id: 'plugin-2',
      schemaId: 'treesitter-nvim',
      enabled: true,
      config: {
        highlight: { enable: true, disable: ['rust'] },
      },
    },
  ],
  options: {
    version: 1,
    options: {
      number: { valueType: 'boolean', value: true },
      relativenumber: { valueType: 'boolean', value: true },
      wrap: { valueType: 'boolean', value: false },
      tabstop: { valueType: 'number', value: 2 },
      shiftwidth: { valueType: 'number', value: 2 },
      expandtab: { valueType: 'boolean', value: true },
      smartindent: { valueType: 'boolean', value: true },
      ignorecase: { valueType: 'boolean', value: true },
      smartcase: { valueType: 'boolean', value: true },
      hlsearch: { valueType: 'boolean', value: true },
      incsearch: { valueType: 'boolean', value: true },
      clipboard: {
        valueType: 'string-list',
        value: ['unnamed', 'unnamedplus'],
      },
    },
    leaderKey: ' ',
    highlightOverrides: [
      {
        id: 'hl-1',
        groupName: 'Normal',
        foreground: '#ffffff',
        background: '#1a1a1a',
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        undercurl: false,
        link: '',
        enabled: true,
        source: { kind: 'custom' },
      },
    ],
    updatedAt: Date.now(),
  },
  keymaps: [
    {
      id: 'keymap-1',
      modes: ['n'],
      keySequence: '<leader>ff',
      action: {
        actionType: 'run-action',
        config: {
          mode: 'custom-command',
          actionType: 'command',
          action: 'Telescope find_files',
          selectedActionKey: '',
          paramValues: {},
        },
      },
      description: 'Find files with Telescope',
      silent: true,
      noremap: true,
      expr: false,
      enabled: true,
    },
    {
      id: 'keymap-2',
      modes: ['n'],
      keySequence: '<leader>fg',
      action: {
        actionType: 'run-action',
        config: {
          mode: 'custom-command',
          actionType: 'command',
          action: 'Telescope live_grep',
          selectedActionKey: '',
          paramValues: {},
        },
      },
      description: 'Live grep with Telescope',
      silent: true,
      noremap: true,
      expr: false,
      enabled: true,
    },
  ],
  lsp: {
    enabledServers: ['lua_ls', 'vtsls', 'rust_analyzer'],
  },
  colorscheme: {
    activeScheme: 'tokyonight',
    variantPreferences: {
      'theme--tokyonight.nvim': 'tokyonight-storm',
    },
  },
}
