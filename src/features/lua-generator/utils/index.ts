// Lua generator utilities - re-export all utilities

export { mergePluginConfig, unflattenDotKeys } from './config-merge'
export { buildEffectiveKeyMap, effectiveKey } from './effective-key'
export {
  getIndentPrefix,
  type IndentTextOptions,
  indentMultiline,
} from './indent'
export {
  LuaBuilder,
  LuaBuilderError,
  type LuaBuilderErrorCode,
  type LuaBuilderOptions,
} from './lua-builder'
export {
  type LuaSerializable,
  LuaSerializationError,
  type SerializeLuaOptions,
  serializeValue,
  serializeValue as luaSerializeValue,
} from './lua-serialize'
export { escapeLuaString } from './lua-string'
export {
  assertSchemaShape,
  LuaGenerationError,
} from './schema-shape-invariants'
