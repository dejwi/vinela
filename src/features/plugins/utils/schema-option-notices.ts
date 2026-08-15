import type {
  PluginConfigValue,
  SchemaNoticeComparableValue,
  SchemaNoticeSurface,
  SchemaOption,
  SchemaOptionNotice,
} from '@/shared/types'

function isConfigObject(
  value: PluginConfigValue | undefined,
): value is Record<string, PluginConfigValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getStoredConfigValueAtPath(
  values: Readonly<Record<string, PluginConfigValue>>,
  optionPath: string,
): PluginConfigValue | undefined {
  const exactValue = values[optionPath]
  if (exactValue !== undefined) {
    return exactValue
  }

  const segments = optionPath.split('.')
  let current: PluginConfigValue | Readonly<Record<string, PluginConfigValue>> =
    values

  for (const segment of segments) {
    if (!isConfigObject(current)) {
      return undefined
    }

    const nextValue: PluginConfigValue | undefined = current[segment]
    if (nextValue === undefined) {
      return undefined
    }

    current = nextValue
  }

  return current
}

export function hasExplicitStoredValueAtPath(
  values: Readonly<Record<string, PluginConfigValue>>,
  optionPath: string,
): boolean {
  const value = getStoredConfigValueAtPath(values, optionPath)
  return value !== undefined && value !== null
}

function matchesComparableNoticeValue(
  value: PluginConfigValue | undefined,
  expectedValue: SchemaNoticeComparableValue,
): boolean {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? value === expectedValue
    : false
}

export interface EvaluateSchemaNoticesArgs {
  readonly option: SchemaOption
  readonly optionPath: string
  readonly allValues: Readonly<Record<string, PluginConfigValue>>
  readonly surface: SchemaNoticeSurface
  readonly value: PluginConfigValue | undefined
}

export function evaluateSchemaOptionNotices(
  args: EvaluateSchemaNoticesArgs,
): readonly SchemaOptionNotice[] {
  const notices = args.option.notices
  if (notices === undefined || notices.length === 0) {
    return []
  }

  return notices.filter((notice) => {
    if (!notice.surfaces.includes(args.surface)) {
      return false
    }

    switch (notice.when.kind) {
      case 'has-explicit-value':
        return hasExplicitStoredValueAtPath(args.allValues, args.optionPath)
      case 'equals':
        return matchesComparableNoticeValue(args.value, notice.when.value)
      case 'not-equals':
        return (
          args.value !== undefined &&
          !matchesComparableNoticeValue(args.value, notice.when.value)
        )
      default: {
        const exhaustiveCheck: never = notice.when
        throw new Error(
          `Unhandled schema notice predicate: ${String(exhaustiveCheck)}`,
        )
      }
    }
  })
}
