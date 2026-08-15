import type { SchemaOption } from '@/shared/types'

export interface SchemaOptionPathAccessors<T> {
  readonly getKey: (option: T) => string | undefined
  readonly getEmitKey: (option: T) => string | undefined
  readonly isObjectOption: (option: T) => boolean
  readonly getProperties: (option: T) => readonly T[]
}

export interface SchemaOptionPathEntry<T> {
  readonly option: T
  readonly schemaPath: string
  readonly effectiveEmitPath: string
}

export interface SchemaOptionPathIndex<T> {
  readonly entries: readonly SchemaOptionPathEntry<T>[]
  readonly bySchemaPath: ReadonlyMap<string, SchemaOptionPathEntry<T>>
  readonly byEffectiveEmitPath: ReadonlyMap<string, SchemaOptionPathEntry<T>>
}

export function buildSchemaOptionPathIndex<T>(
  options: readonly T[],
  accessors: SchemaOptionPathAccessors<T>,
): SchemaOptionPathIndex<T> {
  const entries: SchemaOptionPathEntry<T>[] = []
  const bySchemaPath = new Map<string, SchemaOptionPathEntry<T>>()
  const byEffectiveEmitPath = new Map<string, SchemaOptionPathEntry<T>>()

  const visit = (
    option: T,
    parentSchemaPath: string | undefined,
    parentEmitPath: string | undefined,
  ): void => {
    const key = accessors.getKey(option)
    if (key === undefined || key.trim().length === 0) {
      return
    }

    const localEmitKey = accessors.getEmitKey(option) ?? key
    const schemaPath =
      parentSchemaPath === undefined ? key : `${parentSchemaPath}.${key}`
    const effectiveEmitPath =
      parentEmitPath === undefined
        ? localEmitKey
        : `${parentEmitPath}.${localEmitKey}`

    const entry: SchemaOptionPathEntry<T> = {
      option,
      schemaPath,
      effectiveEmitPath,
    }
    entries.push(entry)
    bySchemaPath.set(schemaPath, entry)
    byEffectiveEmitPath.set(effectiveEmitPath, entry)

    if (!accessors.isObjectOption(option)) {
      return
    }

    for (const property of accessors.getProperties(option)) {
      visit(property, schemaPath, effectiveEmitPath)
    }
  }

  for (const option of options) {
    visit(option, undefined, undefined)
  }

  return {
    entries,
    bySchemaPath,
    byEffectiveEmitPath,
  }
}

export function buildTypedSchemaOptionPathIndex(
  options: readonly SchemaOption[],
): SchemaOptionPathIndex<SchemaOption> {
  return buildSchemaOptionPathIndex(options, {
    getKey: (option) => option.key,
    getEmitKey: (option) => option.emitKey,
    isObjectOption: (option) => option.type === 'object',
    getProperties: (option) =>
      option.type === 'object' ? option.properties : [],
  })
}
