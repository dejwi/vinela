import { Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import type {
  CodeBlockDataPort,
  CodeBlockNodeData,
  PortDataType,
} from '@/shared/types'
import { isCodeBlockNode } from '@/shared/types'
import {
  generateStructurePreview,
  normalizePortNameForLua,
} from '../../lib/code-block-preview'
import { useGraphEditorStore } from '../../store'
import {
  type NodePropertiesEditorProps,
  PropertiesNotice,
  PropertiesSection,
} from './shared'

const CODE_BLOCK_DATA_TYPES: PortDataType[] = [
  'any',
  'string',
  'number',
  'boolean',
  'buffer',
  'window',
  'table',
]

interface TypedPortListEditorProps {
  title: string
  ports: CodeBlockDataPort[]
  onChange: (ports: CodeBlockDataPort[]) => void
}

function TypedPortListEditor({
  title,
  ports,
  onChange,
}: TypedPortListEditorProps): React.JSX.Element {
  const addPort = (): void => {
    onChange([
      ...ports,
      {
        id: nanoid(),
        name: `${title.toLowerCase()}${ports.length + 1}`,
        dataType: 'any',
      },
    ])
  }

  const removePort = (portId: string): void => {
    onChange(ports.filter((port) => port.id !== portId))
  }

  const updatePort = (
    portId: string,
    updates: Partial<CodeBlockDataPort>,
  ): void => {
    onChange(
      ports.map((port) =>
        port.id === portId ? { ...port, ...updates } : port,
      ),
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{title}</p>
        <Button variant="outline" size="sm" className="h-7" onClick={addPort}>
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>

      {ports.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No data ports configured.
        </p>
      ) : null}

      {ports.map((port) => (
        <div key={port.id} className="flex items-center gap-2">
          <Input
            value={port.name}
            onChange={(event) =>
              updatePort(port.id, { name: event.target.value })
            }
            placeholder="name"
            className="h-8"
          />
          <Select
            value={port.dataType}
            onValueChange={(value: PortDataType) =>
              updatePort(port.id, { dataType: value })
            }
          >
            <SelectTrigger className="min-h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CODE_BLOCK_DATA_TYPES.map((dataType) => (
                <SelectItem key={dataType} value={dataType}>
                  {dataType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => removePort(port.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}

interface PortNameInfo {
  original: string
  trimmed: string
  lower: string
  sanitized: string
}

/**
 * Collect port name information for validation
 * Includes ALL ports, including empty/whitespace names
 */
function collectPortNames(data: CodeBlockNodeData): PortNameInfo[] {
  return [...data.inputs, ...data.outputs].map((port) => {
    const trimmed = port.name.trim()
    return {
      original: port.name,
      trimmed,
      lower: trimmed.toLowerCase(),
      sanitized: normalizePortNameForLua(port.name),
    }
  })
}

/**
 * Find duplicate port names by raw name (case-insensitive)
 * Returns map of lowercased name -> array of original casings
 * Excludes empty/whitespace names from this check
 */
function findRawNameDuplicates(
  portNames: PortNameInfo[],
): Map<string, string[]> {
  const seen = new Map<string, string>() // lower -> first original
  const duplicates = new Map<string, string[]>() // lower -> all originals

  for (const { trimmed, lower } of portNames) {
    // Skip empty names for raw duplicate check
    if (trimmed.length === 0) continue

    const existing = seen.get(lower)
    if (existing) {
      // Found a duplicate
      let list = duplicates.get(lower)
      if (!list) {
        list = [existing]
        duplicates.set(lower, list)
      }
      list.push(trimmed)
    } else {
      seen.set(lower, trimmed)
    }
  }

  return duplicates
}

/**
 * Find port name collisions after sanitization
 * Returns map of sanitized name -> array of original names
 * Includes empty/whitespace names (they all sanitize to '_unnamed')
 */
function findSanitizedCollisions(
  portNames: PortNameInfo[],
): Map<string, string[]> {
  const seen = new Map<string, string>() // sanitized -> first original
  const collisions = new Map<string, string[]>() // sanitized -> all originals

  for (const { original, sanitized } of portNames) {
    const existing = seen.get(sanitized)
    if (existing) {
      // Found a collision
      let list = collisions.get(sanitized)
      if (!list) {
        list = [existing]
        collisions.set(sanitized, list)
      }
      list.push(original)
    } else {
      seen.set(sanitized, original)
    }
  }

  return collisions
}

/**
 * Format a list of names for display in error messages
 * Handles 2+ names with proper Oxford comma formatting
 * Uses double quotes for names
 *
 * @example
 * formatNameList(["a", "b"]) // '"a" and "b"'
 * formatNameList(["a", "b", "c"]) // '"a", "b", and "c"'
 */
function formatNameList(names: string[]): string {
  const quoted = names.map((n) => `"${n}"`)
  if (quoted.length === 2) {
    return `${quoted[0]} and ${quoted[1]}`
  }
  if (quoted.length > 2) {
    const last = quoted[quoted.length - 1]
    const rest = quoted.slice(0, -1)
    return `${rest.join(', ')}, and ${last}`
  }
  return quoted[0] || ''
}

/**
 * Simple validation that checks only UI-relevant issues:
 * - Empty code (warning)
 * - Empty port names (error)
 * - Duplicate port names by raw name (case-insensitive, error)
 * - Duplicate port names after sanitization (error) - e.g., "my-input" and "my_input" both become "my_input"
 * Returns array of validation issues, empty array if valid
 */
function validateCodeBlockSimple(data: CodeBlockNodeData): Array<{
  type: 'warning' | 'error'
  message: string
}> {
  const issues: Array<{ type: 'warning' | 'error'; message: string }> = []

  // Check for empty code
  if (!data.code?.trim()) {
    issues.push({ type: 'warning', message: 'Code block is empty' })
  }

  const portNames = collectPortNames(data)

  // Check 1: Empty port names
  const emptyNames = portNames.filter((p) => p.trimmed.length === 0)
  if (emptyNames.length > 0) {
    issues.push({ type: 'error', message: 'Port name cannot be empty' })
  }

  // Check 2: Duplicate port names by raw name (case-insensitive)
  const rawDuplicates = findRawNameDuplicates(portNames)
  for (const [, originals] of rawDuplicates) {
    issues.push({
      type: 'error',
      message: `Duplicate port names: ${originals.join(', ')}`,
    })
  }

  // Check 3: Duplicate port names after sanitization
  // e.g., "my-input" and "my_input" both become "my_input"
  // Also catches multiple empty names (all become "_unnamed")
  const sanitizedCollisions = findSanitizedCollisions(portNames)
  for (const [sanitized, originals] of sanitizedCollisions) {
    // Only report if this is a NEW collision (different originals that sanitize to same thing)
    // and not just a case-insensitive duplicate (already reported above)
    const uniqueLowerOriginals = new Set(originals.map((o) => o.toLowerCase()))
    if (uniqueLowerOriginals.size > 1) {
      const nameList = formatNameList(originals)
      issues.push({
        type: 'error',
        message: `Ports ${nameList} sanitize to "${sanitized}" in Lua`,
      })
    }
  }

  return issues
}

export function CodeBlockPropertiesEditor({
  node,
}: NodePropertiesEditorProps): React.JSX.Element {
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)

  if (!isCodeBlockNode(node)) {
    return (
      <PropertiesNotice
        title="Unexpected node type"
        description="Code block editor can only be used with code block nodes."
      />
    )
  }

  const validationIssues = validateCodeBlockSimple(node.data)
  const structurePreview = generateStructurePreview(node.data)

  return (
    <div className="space-y-4">
      <PropertiesSection
        title="Code"
        description="Write the function body only (no function/end wrapper). Input ports become function parameters. Use return statements to produce output values."
      >
        <Textarea
          value={node.data.code}
          onChange={(event) =>
            updateNodeData<CodeBlockNodeData>(node.id, {
              code: event.target.value,
            })
          }
          placeholder="-- Lua code here"
          className="min-h-[220px] font-mono text-xs"
        />
      </PropertiesSection>

      <PropertiesSection
        title="Data Ports"
        description="Control-flow ports are fixed (`exec` input, `done` output). Configure additional typed data ports below."
      >
        <TypedPortListEditor
          title="Inputs"
          ports={node.data.inputs}
          onChange={(nextPorts) =>
            updateNodeData<CodeBlockNodeData>(node.id, { inputs: nextPorts })
          }
        />

        <TypedPortListEditor
          title="Outputs"
          ports={node.data.outputs}
          onChange={(nextPorts) =>
            updateNodeData<CodeBlockNodeData>(node.id, { outputs: nextPorts })
          }
        />
      </PropertiesSection>

      {node.data.outputs.length >= 2 ? (
        <PropertiesNotice
          title="Multiple outputs — return order matters"
          description={`Return values in the same order as your output ports: return ${node.data.outputs.map((p) => p.name).join(', ')}. The first return value maps to "${node.data.outputs[0]?.name}", the second to "${node.data.outputs[1]?.name}", and so on.`}
        />
      ) : null}

      <PropertiesSection
        title="Code Structure Preview"
        description="Preview of how your code will be wrapped. Read-only."
      >
        <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words rounded border border-border/60 bg-muted/20 p-3 font-mono text-xs text-muted-foreground">
          {structurePreview}
        </pre>
      </PropertiesSection>

      {validationIssues.length > 0
        ? validationIssues.map((issue, index) => (
            <PropertiesNotice
              key={issue.message}
              title={index === 0 ? 'Validation Issues' : ''}
              description={issue.message}
            />
          ))
        : null}
    </div>
  )
}
