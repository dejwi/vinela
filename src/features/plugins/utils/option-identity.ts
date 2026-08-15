import type {
  PluginConfigValue,
  SchemaObjectOption,
  SchemaOption,
} from '@/shared/types'

export interface OptionIdentity {
  readonly option: SchemaOption
  readonly ancestors: readonly SchemaObjectOption[]
}

function isConfigObject(
  value: PluginConfigValue | undefined,
): value is Record<string, PluginConfigValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function identityToOverrideKey(identity: OptionIdentity): string {
  if (identity.ancestors.length === 0) {
    return identity.option.key
  }

  return [
    ...identity.ancestors.map((ancestor) => ancestor.key),
    identity.option.key,
  ].join('.')
}

export function readIdentityValue(
  identity: OptionIdentity,
  values: Readonly<Record<string, PluginConfigValue>>,
): PluginConfigValue | undefined {
  if (identity.ancestors.length === 0) {
    return values[identity.option.key]
  }

  const [rootAncestor, ...nestedAncestors] = identity.ancestors
  if (rootAncestor === undefined) {
    return undefined
  }
  let cursor: PluginConfigValue | undefined = values[rootAncestor.key]

  for (const ancestor of nestedAncestors) {
    if (!isConfigObject(cursor)) {
      return undefined
    }
    cursor = cursor[ancestor.key]
  }

  if (!isConfigObject(cursor)) {
    return undefined
  }

  return cursor[identity.option.key]
}

function updateNestedObject(
  values: Readonly<Record<string, PluginConfigValue>>,
  ancestors: readonly SchemaObjectOption[],
  targetKey: string,
  next: PluginConfigValue | undefined,
): Record<string, PluginConfigValue> {
  const [rootAncestor, ...nestedAncestors] = ancestors
  if (rootAncestor === undefined) {
    return { ...values }
  }
  const output: Record<string, PluginConfigValue> = { ...values }

  const rootExisting = values[rootAncestor.key]
  const rootClone: Record<string, PluginConfigValue> = isConfigObject(
    rootExisting,
  )
    ? { ...rootExisting }
    : {}
  output[rootAncestor.key] = rootClone

  let currentClone = rootClone
  let currentExisting: Record<string, PluginConfigValue> | undefined =
    isConfigObject(rootExisting) ? rootExisting : undefined

  for (const ancestor of nestedAncestors) {
    const nestedExistingValue = currentExisting?.[ancestor.key]
    const nestedClone: Record<string, PluginConfigValue> = isConfigObject(
      nestedExistingValue,
    )
      ? { ...nestedExistingValue }
      : {}

    currentClone[ancestor.key] = nestedClone
    currentClone = nestedClone
    currentExisting = isConfigObject(nestedExistingValue)
      ? nestedExistingValue
      : undefined
  }

  if (next === undefined) {
    delete currentClone[targetKey]
  } else {
    currentClone[targetKey] = next
  }

  return output
}

export function writeIdentityValue(
  identity: OptionIdentity,
  values: Readonly<Record<string, PluginConfigValue>>,
  next: PluginConfigValue | undefined,
): Record<string, PluginConfigValue> {
  if (identity.ancestors.length === 0) {
    const output: Record<string, PluginConfigValue> = { ...values }
    if (next === undefined) {
      delete output[identity.option.key]
      return output
    }

    output[identity.option.key] = next
    return output
  }

  return updateNestedObject(
    values,
    identity.ancestors,
    identity.option.key,
    next,
  )
}
