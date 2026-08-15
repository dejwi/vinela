import type {
  CatalogActionEntry,
  CatalogCategory,
} from '@/shared/types/catalog'

export interface ActionPickerModalProps {
  catalog: readonly CatalogActionEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
  value: {
    mode: 'catalog' | 'custom-command' | 'custom-keys'
    actionType: 'command' | 'keys'
    action: string
    selectedActionKey: string
    paramValues: Record<string, string>
  }
  onConfirm: (config: {
    mode: 'catalog' | 'custom-command' | 'custom-keys'
    actionType: 'command' | 'keys'
    action: string
    selectedActionKey: string
    paramValues: Record<string, string>
  }) => void
  initialMode?: 'preset' | 'custom'
}

// New split state model
export type InputMode = 'preset' | 'custom'
export type CatalogView = 'popular' | 'all' | 'category' | 'plugin'

export interface ActionPickerPluginGroup {
  readonly pluginId: string
  readonly pluginName: string
  readonly count: number
}

export interface ActionPickerSidebarProps {
  inputMode: InputMode
  catalogView: CatalogView
  selectedCategory: CatalogCategory | null
  selectedPluginId: string | null
  pluginGroups: readonly ActionPickerPluginGroup[]
  onSwitchToCustom: () => void
  onSwitchToPreset: () => void
  onSelectPresetView: (view: 'popular' | 'all') => void
  onSelectCategory: (category: CatalogCategory) => void
  onSelectPlugin: (pluginId: string) => void
  categoryCounts: Record<string, number>
}

export interface ActionPickerGridProps {
  actions: readonly CatalogActionEntry[]
  selectedAction: CatalogActionEntry | null
  focusedIndex: number
  onSelectAction: (action: CatalogActionEntry) => void
  onFocusChange: (index: number) => void
}

export interface ActionPickerItemProps {
  action: CatalogActionEntry
  isSelected: boolean
  isFocused: boolean
  onClick: () => void
  onMouseEnter: () => void
}

export interface ActionPickerPreviewProps {
  action: CatalogActionEntry
  paramValues: Readonly<Record<string, string>>
  onParamChange: (name: string, value: string) => void
  editable?: boolean
  onEdit?: (value: string) => void
}

export interface ActionPickerPreviewCompactProps {
  action: CatalogActionEntry
  paramValues: Readonly<Record<string, string>>
  onParamChange: (name: string, value: string) => void
  onEditAction?: (value: string) => void
  isCollapsed: boolean
  onCollapseChange: (collapsed: boolean) => void
}

export interface ActionPickerCustomProps {
  value: string
  onChange: (value: string) => void
}

export interface ActionPickerSearchProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}
