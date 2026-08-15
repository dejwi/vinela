import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type { LoopNodeData } from '@/shared/types'
import { isLoopNode } from '@/shared/types'
import { useGraphEditorStore } from '../../store'
import {
  type NodePropertiesEditorProps,
  PropertiesNotice,
  PropertiesSection,
} from './shared'

const LOOP_TYPES: LoopNodeData['loopType'][] = ['for', 'while', 'each']

interface LoopTemplate {
  label: string
  description: string
  iteratorVariable?: string
  iterableExpression: string
}

const LOOP_TEMPLATES: Record<
  LoopNodeData['loopType'],
  readonly LoopTemplate[]
> = {
  for: [
    {
      label: 'Numeric sequence',
      description: 'Use a known list or range-like sequence.',
      iteratorVariable: 'i',
      iterableExpression: 'vim.iter({ 1, 2, 3, 4, 5 })',
    },
    {
      label: 'Tab windows',
      description: 'Run for each window in the current tab.',
      iteratorVariable: 'winid',
      iterableExpression: 'vim.api.nvim_tabpage_list_wins(0)',
    },
  ],
  while: [
    {
      label: 'Repeat while count exists',
      description: 'Continue while a guard expression is true.',
      iterableExpression: 'vim.v.count > 0',
    },
    {
      label: 'Repeat until mode changes',
      description: 'Stop when mode check no longer matches.',
      iterableExpression: "vim.api.nvim_get_mode().mode ~= 'n'",
    },
  ],
  each: [
    {
      label: 'Each buffer',
      description: 'Process all listed buffers.',
      iteratorVariable: 'bufnr',
      iterableExpression: 'vim.api.nvim_list_bufs()',
    },
    {
      label: 'Each quickfix entry',
      description: 'Walk every quickfix item.',
      iteratorVariable: 'entry',
      iterableExpression: 'vim.fn.getqflist()',
    },
  ],
}

function getLoopTypeLabel(loopType: LoopNodeData['loopType']): string {
  switch (loopType) {
    case 'for':
      return 'For'
    case 'while':
      return 'While'
    case 'each':
      return 'Each'
    default:
      return 'For'
  }
}

function toLoopType(value: string): LoopNodeData['loopType'] {
  if (value === 'for' || value === 'while' || value === 'each') {
    return value
  }
  return 'for'
}

function getLoopGuidance(loopType: LoopNodeData['loopType']): string {
  switch (loopType) {
    case 'for':
      return 'Use For when iteration order is predictable (numbers, ids, or generated values).'
    case 'while':
      return 'Use While when repetition depends on a guard condition that can flip to false.'
    case 'each':
      return 'Use Each when iterating values from a list-like expression.'
    default:
      return 'Use For when iteration order is predictable (numbers, ids, or generated values).'
  }
}

export function LoopPropertiesEditor({
  node,
}: NodePropertiesEditorProps): React.JSX.Element {
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)

  if (!isLoopNode(node)) {
    return (
      <PropertiesNotice
        title="Unexpected node type"
        description="Loop editor can only be used with loop nodes."
      />
    )
  }

  const showIteratorField = node.data.loopType !== 'while'
  const activeTemplates = LOOP_TEMPLATES[node.data.loopType]

  return (
    <div className="space-y-4">
      <PropertiesSection
        title="Loop"
        description="Configure how this node iterates before continuing execution."
      >
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Loop Type</p>
          <Select
            value={node.data.loopType}
            onValueChange={(value: string) =>
              updateNodeData<LoopNodeData>(node.id, {
                loopType: toLoopType(value),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOOP_TYPES.map((loopType) => (
                <SelectItem key={loopType} value={loopType}>
                  {getLoopTypeLabel(loopType)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          {getLoopGuidance(node.data.loopType)}
        </p>

        {showIteratorField ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Iterator Variable</p>
            <Input
              value={node.data.iteratorVariable}
              onChange={(event) =>
                updateNodeData<LoopNodeData>(node.id, {
                  iteratorVariable: event.target.value,
                })
              }
              placeholder="item"
            />
          </div>
        ) : null}

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {node.data.loopType === 'while'
              ? 'Condition Expression'
              : 'Iterable Expression'}
          </p>
          <Input
            value={node.data.iterableExpression}
            onChange={(event) =>
              updateNodeData<LoopNodeData>(node.id, {
                iterableExpression: event.target.value,
              })
            }
            placeholder={
              node.data.loopType === 'while'
                ? 'vim.v.count > 0'
                : 'vim.api.nvim_list_bufs()'
            }
          />
        </div>

        <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
          <p className="text-xs font-medium">Templates</p>
          <div className="space-y-2">
            {activeTemplates.map((template) => (
              <button
                key={template.label}
                type="button"
                className="w-full rounded-md border bg-background px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                onClick={() =>
                  updateNodeData<LoopNodeData>(node.id, {
                    iteratorVariable:
                      template.iteratorVariable ?? node.data.iteratorVariable,
                    iterableExpression: template.iterableExpression,
                  })
                }
              >
                <p className="font-medium">{template.label}</p>
                <p className="text-muted-foreground">{template.description}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {template.iterableExpression}
                </p>
              </button>
            ))}
          </div>
        </div>

        {node.data.loopType !== 'while' ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-3">
            <p className="text-xs font-medium">Iteration data ports</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This node also exposes optional `Item` and `Index` outputs for
              per-iteration values. Execution flow still uses `Loop Body` and
              `Completed`.
            </p>
          </div>
        ) : null}
      </PropertiesSection>

      <PropertiesSection
        title="Examples"
        description="Use these patterns as starting points for custom loops."
      >
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">for:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              i in vim.iter({`{ 1, 2, 3 }`})
            </code>
          </p>
          <p>
            <span className="font-medium text-foreground">while:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              vim.v.count &gt; 0
            </code>
          </p>
          <p>
            <span className="font-medium text-foreground">each:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              bufnr in vim.api.nvim_list_bufs()
            </code>
          </p>
        </div>
      </PropertiesSection>
    </div>
  )
}
