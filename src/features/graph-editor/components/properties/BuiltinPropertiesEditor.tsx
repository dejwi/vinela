import { useMemo } from 'react'
import { SchemaField } from '@/features/plugins'
import type {
  BuiltinNodeData,
  PluginConfigValue,
  SchemaOption,
} from '@/shared/types'
import { getBuiltinActionDefinition } from '../../data/builtin-actions'
import { useIsPortConnected } from '../../hooks/useIsPortConnected'
import { useGraphEditorStore } from '../../store'
import {
  type NodePropertiesEditorProps,
  PropertiesNotice,
  PropertiesSection,
} from './shared'

function isPrimitiveConfigValue(
  value: unknown,
): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isPluginConfigArray(
  value: PluginConfigValue,
): value is PluginConfigValue[] {
  return Array.isArray(value)
}

function isPluginConfigObject(
  value: PluginConfigValue,
): value is { [key: string]: PluginConfigValue } {
  return typeof value === 'object' && !Array.isArray(value)
}

function isPluginConfigValue(value: unknown): value is PluginConfigValue {
  if (isPrimitiveConfigValue(value)) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isPluginConfigValue(entry))
  }

  if (typeof value !== 'object' || value === null) {
    return false
  }

  return Object.values(value).every((entry) => isPluginConfigValue(entry))
}

function clonePluginConfigValue(value: PluginConfigValue): PluginConfigValue {
  if (isPrimitiveConfigValue(value)) {
    return value
  }

  if (isPluginConfigArray(value)) {
    return value.map((entry) => clonePluginConfigValue(entry))
  }

  const clonedObject: Record<string, PluginConfigValue> = {}

  for (const [key, entry] of Object.entries(
    isPluginConfigObject(value) ? value : {},
  )) {
    clonedObject[key] = clonePluginConfigValue(entry)
  }

  return clonedObject
}

function getOptionDefault(option: SchemaOption): PluginConfigValue | undefined {
  if (option.type === 'object') {
    return undefined
  }

  if (option.type === 'array') {
    if (option.default !== undefined && Array.isArray(option.default)) {
      return option.default.filter(isPrimitiveConfigValue)
    }
    return undefined
  }

  if (option.type === 'plugin-keymap') {
    return { preset: option.defaultPreset }
  }

  if (option.type === 'mapping-table') {
    return option.default?.map((row) => clonePluginConfigValue(row))
  }

  return option.default
}

function toConfigValues(
  config: Record<string, unknown>,
  options: readonly SchemaOption[],
): Record<string, PluginConfigValue> {
  const values: Record<string, PluginConfigValue> = {}

  for (const option of options) {
    const defaultValue = getOptionDefault(option)
    if (defaultValue !== undefined) {
      values[option.key] = defaultValue
    }

    const configValue = config[option.key]
    if (isPluginConfigValue(configValue)) {
      values[option.key] = clonePluginConfigValue(configValue)
    }
  }

  return values
}

interface ConnectableSchemaFieldProps {
  option: SchemaOption
  nodeId: string
  builtinInputs: readonly { id: string }[]
  value: PluginConfigValue | undefined
  onChange: (key: string, value: PluginConfigValue) => void
  allValues: Record<string, PluginConfigValue>
}

function ConnectableSchemaField({
  option,
  nodeId,
  builtinInputs,
  value,
  onChange,
  allValues,
}: ConnectableSchemaFieldProps): React.JSX.Element {
  const portId = option.key
  const hasPort = builtinInputs.some((p) => p.id === portId)
  const isConnected = useIsPortConnected(nodeId, portId)

  if (hasPort && isConnected) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{option.label}</p>
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Value comes from connected input port.
        </div>
      </div>
    )
  }

  return (
    <SchemaField
      option={option}
      value={value}
      onChange={onChange}
      allValues={allValues}
    />
  )
}

export function BuiltinPropertiesEditor({
  node,
}: NodePropertiesEditorProps<BuiltinNodeData>) {
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)
  const builtinDefinition = getBuiltinActionDefinition(node.data.builtinId)

  const allValues = useMemo(() => {
    if (!builtinDefinition) {
      return {}
    }

    return toConfigValues(node.data.config, builtinDefinition.configSchema)
  }, [builtinDefinition, node.data.config])

  const handleChange = (key: string, value: PluginConfigValue): void => {
    updateNodeData<BuiltinNodeData>(node.id, {
      config: {
        ...node.data.config,
        [key]: value,
      },
    })
  }

  return (
    <div className="space-y-5">
      {!builtinDefinition ? (
        <PropertiesNotice
          title="Builtin definition missing"
          description="This node references a builtin that is no longer registered. Reintroduce the builtin registry entry to edit or use this node again."
        />
      ) : (
        <PropertiesSection
          title="Configuration"
          description={builtinDefinition.description}
        >
          {builtinDefinition.configSchema.length === 0 ? (
            <PropertiesNotice
              title="No configuration"
              description="This builtin does not expose editable options."
            />
          ) : (
            <div className="space-y-4">
              {builtinDefinition.configSchema.map((option) => (
                <ConnectableSchemaField
                  key={option.key}
                  option={option}
                  nodeId={node.id}
                  builtinInputs={builtinDefinition.inputs}
                  value={allValues[option.key]}
                  onChange={handleChange}
                  allValues={allValues}
                />
              ))}
            </div>
          )}
        </PropertiesSection>
      )}
    </div>
  )
}
