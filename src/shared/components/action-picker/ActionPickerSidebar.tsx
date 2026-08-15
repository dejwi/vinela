import {
  Activity,
  ChevronsDownUp,
  Clipboard,
  Code,
  Compass,
  Edit3,
  File,
  Grid,
  HelpCircle,
  Layout,
  List,
  Plug,
  Search,
  Star,
} from 'lucide-react'
import type { CatalogPickerSidebarSection } from '@/shared/components/catalog-picker'
import { CatalogPickerSidebar } from '@/shared/components/catalog-picker'
import {
  CATALOG_CATEGORIES,
  CATALOG_CATEGORY_LABELS,
  type CatalogCategory,
} from '@/shared/types/catalog'
import type { ActionPickerSidebarProps } from './types'

const CATEGORY_ICONS: Record<CatalogCategory, React.ReactNode> = {
  files: <File className="h-4 w-4" />,
  'copy-paste': <Clipboard className="h-4 w-4" />,
  navigation: <Compass className="h-4 w-4" />,
  editing: <Edit3 className="h-4 w-4" />,
  layout: <Layout className="h-4 w-4" />,
  git: <List className="h-4 w-4" />,
  folding: <ChevronsDownUp className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  help: <HelpCircle className="h-4 w-4" />,
  lsp: <Activity className="h-4 w-4" />,
  packages: <Grid className="h-4 w-4" />,
  terminal: <Code className="h-4 w-4" />,
  uncategorized: <Activity className="h-4 w-4" />,
}

export function ActionPickerSidebar({
  inputMode,
  catalogView,
  selectedCategory,
  selectedPluginId,
  pluginGroups,
  onSwitchToCustom,
  onSwitchToPreset,
  onSelectPresetView,
  onSelectCategory,
  onSelectPlugin,
  categoryCounts,
}: ActionPickerSidebarProps): React.JSX.Element {
  const totalActions = Object.values(categoryCounts).reduce((a, b) => a + b, 0)

  // Build the active view key for CatalogPickerSidebar
  const activeView =
    inputMode === 'custom'
      ? 'custom'
      : catalogView === 'category' && selectedCategory !== null
        ? `cat:${selectedCategory}`
        : catalogView === 'plugin' && selectedPluginId !== null
          ? `plugin:${selectedPluginId}`
          : catalogView

  const views: CatalogPickerSidebarSection[] = [
    {
      key: 'popular',
      label: 'Popular',
      icon: <Star className="h-4 w-4" />,
    },
    {
      key: 'all',
      label: 'All Actions',
      icon: <Grid className="h-4 w-4" />,
      count: totalActions,
    },
  ]

  const categories: CatalogPickerSidebarSection[] = CATALOG_CATEGORIES.map(
    (category) => ({
      key: `cat:${category}`,
      label: CATALOG_CATEGORY_LABELS[category],
      icon: CATEGORY_ICONS[category],
      count: categoryCounts[category],
    }),
  )

  const footerItems: CatalogPickerSidebarSection[] = [
    {
      key: 'custom',
      label: 'Custom',
      icon: <Code className="h-4 w-4" />,
    },
  ]

  const pluginSections: CatalogPickerSidebarSection[] = pluginGroups.map(
    (group) => ({
      key: `plugin:${group.pluginId}`,
      label: group.pluginName,
      icon: <Plug className="h-4 w-4" />,
      count: group.count,
    }),
  )

  const handleSelect = (key: string) => {
    if (key === 'custom') {
      onSwitchToCustom()
    } else if (key === 'popular' || key === 'all') {
      if (inputMode === 'custom') {
        onSwitchToPreset()
      }
      onSelectPresetView(key as 'popular' | 'all')
    } else if (key.startsWith('plugin:')) {
      if (inputMode === 'custom') {
        onSwitchToPreset()
      }
      onSelectPlugin(key.slice(7))
    } else if (key.startsWith('cat:')) {
      const category = key.slice(4) as CatalogCategory
      if (inputMode === 'custom') {
        onSwitchToPreset()
      }
      onSelectCategory(category)
    }
  }

  return (
    <CatalogPickerSidebar
      title="Actions"
      activeView={activeView}
      views={views}
      categories={categories}
      additionalGroups={[
        {
          key: 'plugins',
          label: 'Plugins',
          items: pluginSections,
        },
      ]}
      onSelect={handleSelect}
      footerItems={footerItems}
      showClose
    />
  )
}
