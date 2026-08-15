import {
  Code,
  Code2,
  CornerDownLeft,
  GitBranch,
  GitFork,
  type LucideIcon,
  Phone,
  Plus,
  Repeat,
  Search,
  Zap,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { usePluginStore } from '@/features/plugins'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { cn } from '@/shared/lib/utils'
import type {
  CallableEntryNodeData,
  CodeBlockNodeData,
  ConditionNodeData,
  GraphRefNodeData,
  LoopNodeData,
  NodeData,
  NodeType,
  ReturnNodeData,
  RunFunctionNodeData,
  TriggerNodeData,
} from '@/shared/types'
import { builtinPaletteProvider } from '../data/palette-builtins'
import { NEOVIM_ACTION_PALETTE_ITEMS } from '../data/palette-neovim-actions'
import { createPluginActionPaletteProvider } from '../data/palette-plugin-actions'

export interface NodePaletteItem {
  type: NodeType
  label: string
  icon: LucideIcon
  createData: () => NodeData
}

export interface NodePaletteCategory {
  id: string
  name: string
  nodes: NodePaletteItem[]
}

export type NodePaletteCategoryProvider = () => readonly NodePaletteCategory[]

// Factory function for creating properly typed node data
const createTriggerData = (): TriggerNodeData => ({
  nodeType: 'trigger',
  triggerType: 'startup',
})

const createConditionData = (): ConditionNodeData => ({
  nodeType: 'condition',
  operator: '==',
  hardcodedA: '',
  hardcodedB: '',
})

const createLoopData = (): LoopNodeData => ({
  nodeType: 'loop',
  loopType: 'for',
  iteratorVariable: 'item',
  iterableExpression: 'vim.api.nvim_list_bufs()',
})

const createCodeBlockData = (): CodeBlockNodeData => ({
  nodeType: 'code-block',
  code: '',
  inputs: [],
  outputs: [],
})

const createCallableEntryData = (): CallableEntryNodeData => ({
  nodeType: 'callable-entry',
  parameters: [],
})

const createReturnData = (): ReturnNodeData => ({
  nodeType: 'return',
  returnValues: [],
})

const createGraphRefData = (): GraphRefNodeData => ({
  nodeType: 'graph-ref',
  referencedGraphId: '',
})

const createRunFunctionData = (): RunFunctionNodeData => ({
  nodeType: 'run-function',
  selectedFunctionKey: '',
  functionSource: { type: 'core', functionName: '' },
  signature: null,
  paramDefaults: {},
})

function createCoreCategories(): NodePaletteCategory[] {
  return [
    {
      id: 'triggers',
      name: 'Triggers',
      nodes: [
        {
          type: 'trigger',
          label: 'On Startup',
          icon: Zap,
          createData: () => createTriggerData(),
        },
      ],
    },
    {
      id: 'logic',
      name: 'Logic',
      nodes: [
        {
          type: 'condition',
          label: 'Condition',
          icon: GitBranch,
          createData: createConditionData,
        },
        {
          type: 'loop',
          label: 'Loop',
          icon: Repeat,
          createData: createLoopData,
        },
        {
          type: 'code-block',
          label: 'Code Block',
          icon: Code,
          createData: createCodeBlockData,
        },
      ],
    },
    {
      id: 'callable',
      name: 'Callable',
      nodes: [
        {
          type: 'callable-entry',
          label: 'Callable Entry',
          icon: Phone,
          createData: createCallableEntryData,
        },
        {
          type: 'return',
          label: 'Return',
          icon: CornerDownLeft,
          createData: createReturnData,
        },
        {
          type: 'graph-ref',
          label: 'Call Graph',
          icon: GitFork,
          createData: createGraphRefData,
        },
      ],
    },
    {
      id: 'functions',
      name: 'Functions',
      nodes: [
        {
          type: 'run-function',
          label: 'Run Function',
          icon: Code2,
          createData: createRunFunctionData,
        },
      ],
    },
  ]
}

export const coreNodePaletteProvider: NodePaletteCategoryProvider =
  createCoreCategories

function createNeovimActionCategories(): NodePaletteCategory[] {
  return [
    {
      id: 'actions-neovim',
      name: 'Actions: Neovim',
      nodes: NEOVIM_ACTION_PALETTE_ITEMS.map((item) => ({
        type: item.type,
        label: item.label,
        icon: item.icon,
        createData: item.createData,
      })),
    },
  ]
}

export const neovimActionPaletteProvider: NodePaletteCategoryProvider =
  createNeovimActionCategories

export const defaultNodePaletteProviders: readonly NodePaletteCategoryProvider[] =
  [coreNodePaletteProvider, neovimActionPaletteProvider, builtinPaletteProvider]

export function composeNodePaletteCategories(
  providers: readonly NodePaletteCategoryProvider[],
): NodePaletteCategory[] {
  const categoriesByName = new Map<string, NodePaletteCategory>()

  for (const provider of providers) {
    const providedCategories = provider()
    for (const category of providedCategories) {
      const existingCategory = categoriesByName.get(category.name)
      if (existingCategory) {
        existingCategory.nodes.push(...category.nodes)
        continue
      }

      categoriesByName.set(category.name, {
        id: category.id,
        name: category.name,
        nodes: [...category.nodes],
      })
    }
  }

  return [...categoriesByName.values()]
}

interface NodePaletteProps {
  onAddNode?: (type: NodeType, data: NodeData) => void
  categoryProviders?: readonly NodePaletteCategoryProvider[]
}

export function NodePalette({
  onAddNode,
  categoryProviders,
}: NodePaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const schemas = usePluginStore((state) => state.schemas)
  const installedPlugins = usePluginStore((state) => state.installedPlugins)

  const pluginActionPaletteProvider = useMemo(
    () =>
      createPluginActionPaletteProvider({
        schemas,
        installedPlugins,
      }),
    [schemas, installedPlugins],
  )

  const providers = useMemo(
    () =>
      categoryProviders ?? [
        ...defaultNodePaletteProviders,
        pluginActionPaletteProvider,
      ],
    [categoryProviders, pluginActionPaletteProvider],
  )

  const allCategories = useMemo(
    () => composeNodePaletteCategories(providers),
    [providers],
  )

  const filteredCategories = useMemo(
    () =>
      allCategories
        .map((category) => ({
          ...category,
          nodes: category.nodes.filter((node) =>
            node.label.toLowerCase().includes(search.toLowerCase()),
          ),
        }))
        .filter((category) => category.nodes.length > 0),
    [allCategories, search],
  )

  const handleAddNode = useCallback(
    (item: NodePaletteItem) => {
      onAddNode?.(item.type, item.createData())
      setOpen(false)
      setSearch('')
    },
    [onAddNode],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-tutorial="add-node-button"
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Node
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        data-tutorial-popover="true"
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-2 space-y-4">
            {filteredCategories.map((category) => (
              <div key={category.id}>
                <div className="text-xs font-medium text-muted-foreground px-2 mb-2">
                  {category.name}
                </div>
                <div className="space-y-1">
                  {category.nodes.map((node, index) => {
                    const Icon = node.icon
                    return (
                      <button
                        key={`${category.id}-${node.type}-${node.label}-${index}`}
                        type="button"
                        onClick={() => handleAddNode(node)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md',
                          'hover:bg-muted transition-colors text-left',
                        )}
                      >
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{node.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
