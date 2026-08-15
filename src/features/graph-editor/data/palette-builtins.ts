import type { BuiltinNodeData, PluginConfigValue } from '@/shared/types'
import type {
  NodePaletteCategory,
  NodePaletteCategoryProvider,
  NodePaletteItem,
} from '../components/NodePalette'
import {
  type BuiltinActionCategory,
  getBuiltinActionsByCategory,
} from './builtin-actions'

const BUILTIN_CATEGORY_ORDER: BuiltinActionCategory[] = [
  'Editor',
  'Buffers',
  'User Interface',
  'Input',
  'Automation',
]

function createBuiltinNodeData(
  builtinId: string,
  config: Record<string, PluginConfigValue>,
): BuiltinNodeData {
  return {
    nodeType: 'builtin',
    builtinId,
    config,
  }
}

function createBuiltinPaletteNode(
  builtinId: string,
  label: string,
  icon: NodePaletteItem['icon'],
  defaultConfig: Record<string, PluginConfigValue>,
): NodePaletteItem {
  return {
    type: 'builtin',
    label,
    icon,
    createData: () => createBuiltinNodeData(builtinId, defaultConfig),
  }
}

export function createBuiltinPaletteCategories(): NodePaletteCategory[] {
  const grouped = getBuiltinActionsByCategory()
  const categories: NodePaletteCategory[] = []

  for (const category of BUILTIN_CATEGORY_ORDER) {
    const actions = grouped.get(category)
    if (!actions || actions.length === 0) {
      continue
    }

    categories.push({
      id: `builtins-${category.toLowerCase().replace(/\s+/g, '-')}`,
      name: `Builtins: ${category}`,
      nodes: actions
        .map((action) =>
          createBuiltinPaletteNode(
            action.id,
            action.label,
            action.icon,
            action.getDefaultConfig(),
          ),
        )
        .sort((a, b) => a.label.localeCompare(b.label)),
    })
  }

  return categories
}

export const builtinPaletteProvider: NodePaletteCategoryProvider =
  createBuiltinPaletteCategories
