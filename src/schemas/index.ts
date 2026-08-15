import { assertSchemaShape } from '@/features/lua-generator/utils/schema-shape-invariants'
import type { PluginSchema } from '@/shared/types'
import autoSessionSchema from './auto-session.json'
import blinkCmpSchema from './blink-cmp.json'
import catppuccinSchema from './catppuccin.json'
import codediffSchema from './codediff-nvim.json'
import dotenvNvimSchema from './dotenv-nvim.json'
import formatterNvimSchema from './formatter-nvim.json'
import kanagawaSchema from './kanagawa.json'
import markviewNvimSchema from './markview-nvim.json'
import masonSchema from './mason.json'
import miniPairsSchema from './mini-pairs.json'
import nightfoxSchema from './nightfox.json'
import nordicSchema from './nordic.json'
import nvimLspconfigSchema from './nvim-lspconfig.json'
import nvimSurroundSchema from './nvim-surround.json'
import nvimWebDeviconsSchema from './nvim-web-devicons.json'
import oxocarbonSchema from './oxocarbon.json'
import prettierNvimSchema from './prettier-nvim.json'
import rosePineSchema from './rose-pine.json'
import snacksNvimSchema from './snacks-nvim.json'
import sonokaiSchema from './sonokai.json'
import substituteNvimSchema from './substitute-nvim.json'
import telescopeSchema from './telescope.json'
import tokyonightSchema from './tokyonight.json'
// Built-in schemas bundled with the app
// These are imported at build time and always available
import treesitterSchema from './treesitter.json'
import vagueSchema from './vague.json'
import vimMaximizerSchema from './vim-maximizer.json'
import vimTmuxNavigatorSchema from './vim-tmux-navigator.json'
import vscodeNvimSchema from './vscode-nvim.json'

/**
 * All built-in plugin schemas.
 * These ship with the app and are read-only.
 * Users can override them with global or project-local schemas using the same ID.
 */
const builtinSchemas: PluginSchema[] = [
  treesitterSchema as PluginSchema,
  masonSchema as PluginSchema,
  telescopeSchema as PluginSchema,
  nvimLspconfigSchema as PluginSchema,
  autoSessionSchema as PluginSchema,
  vimMaximizerSchema as PluginSchema,
  vimTmuxNavigatorSchema as PluginSchema,
  substituteNvimSchema as PluginSchema,
  snacksNvimSchema as PluginSchema,
  blinkCmpSchema as PluginSchema,
  formatterNvimSchema as PluginSchema,
  prettierNvimSchema as PluginSchema,
  dotenvNvimSchema as PluginSchema,
  nvimWebDeviconsSchema as PluginSchema,
  nvimSurroundSchema as PluginSchema,
  miniPairsSchema as PluginSchema,
  markviewNvimSchema as PluginSchema,
  catppuccinSchema as PluginSchema,
  codediffSchema as PluginSchema,
  kanagawaSchema as PluginSchema,
  nightfoxSchema as PluginSchema,
  nordicSchema as PluginSchema,
  oxocarbonSchema as PluginSchema,
  rosePineSchema as PluginSchema,
  sonokaiSchema as PluginSchema,
  tokyonightSchema as PluginSchema,
  vagueSchema as PluginSchema,
  vscodeNvimSchema as PluginSchema,
]

for (const schema of builtinSchemas) {
  assertSchemaShape(schema)
}

export default builtinSchemas
