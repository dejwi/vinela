import type {
  PluginConfigValue,
  SchemaObjectOption,
  SchemaOption,
  SchemaOptionNotice,
} from '@/shared/types'
import {
  canResetOption,
  getEffectiveValue,
  hasAnyOverrideUnderPrefix,
} from '../../utils/option-default'
import type { OptionIdentity } from '../../utils/option-identity'
import { evaluateSchemaOptionNotices } from '../../utils/schema-option-notices'
import { OptionResetButton } from './OptionResetButton'

export function buildOptionPath(
  keyPathPrefix: string | undefined,
  optionKey: string,
): string {
  if (keyPathPrefix === undefined || keyPathPrefix.length === 0) {
    return optionKey
  }
  return `${keyPathPrefix}.${optionKey}`
}

export function getMatchingConfigurationNotices(
  option: SchemaOption,
  optionPath: string,
  allValues: Record<string, PluginConfigValue>,
  value: PluginConfigValue | undefined,
  fieldDisabled: boolean,
): readonly SchemaOptionNotice[] {
  if (fieldDisabled) {
    return []
  }

  return evaluateSchemaOptionNotices({
    option,
    optionPath,
    allValues,
    surface: 'configuration',
    value,
  })
}

export function buildSchemaFieldResetButton(
  option: SchemaOption,
  value: PluginConfigValue | undefined,
  optionPath: string,
  luaFieldOverrides: Record<string, boolean> | undefined,
  fieldDisabled: boolean,
  onResetOption: ((identity: OptionIdentity) => void) | undefined,
  ancestors: readonly SchemaObjectOption[],
): React.JSX.Element | null {
  if (onResetOption === undefined) {
    return null
  }

  const hasLuaIncludeOverride =
    option.type === 'lua'
      ? luaFieldOverrides?.[optionPath] !== undefined
      : option.type === 'object'
        ? hasAnyOverrideUnderPrefix(luaFieldOverrides, optionPath)
        : false

  if (!canResetOption(option, value, hasLuaIncludeOverride)) {
    return null
  }

  return (
    <OptionResetButton
      optionLabel={option.label}
      scope={
        option.type === 'lua'
          ? 'lua'
          : option.type === 'object'
            ? 'object'
            : 'simple'
      }
      {...(fieldDisabled ? { disabled: true } : {})}
      onReset={() => onResetOption({ option, ancestors })}
    />
  )
}

export function getEffectiveFieldValue(
  option: SchemaOption,
  value: PluginConfigValue | undefined,
): PluginConfigValue | undefined {
  return getEffectiveValue(option, value)
}
