import type { ReactNode } from 'react'

// ============================================
// Generic Catalog Picker Types
// ============================================

export interface CatalogPickerSidebarSection {
  readonly key: string
  readonly label: string
  readonly icon?: ReactNode | undefined
  readonly count?: number | undefined
}

export interface CatalogPickerSidebarGroup {
  readonly key: string
  readonly label: string
  readonly items: readonly CatalogPickerSidebarSection[]
}

export interface CatalogPickerSidebarProps {
  /** Title shown in sidebar header */
  title: string
  /** Currently active view key */
  activeView: string
  /** Special top-level view items (e.g. "Popular", "All") */
  views: readonly CatalogPickerSidebarSection[]
  /** Category items shown after separator */
  categories: readonly CatalogPickerSidebarSection[]
  additionalGroups?: readonly CatalogPickerSidebarGroup[] | undefined
  /** Called when a view or category is selected */
  onSelect: (key: string) => void
  /** Optional footer items (e.g. "Custom") */
  footerItems?: readonly CatalogPickerSidebarSection[] | undefined
  /** Optional close button (for dialog context) */
  showClose?: boolean | undefined
}

export interface CatalogPickerSearchProps {
  id?: string | undefined
  value: string
  onChange: (value: string) => void
  placeholder?: string | undefined
  disabled?: boolean | undefined
}

export interface CatalogPickerItemData {
  readonly key: string
  readonly label: string
  readonly shortDescription: string
}

export interface CatalogPickerGridProps<T extends CatalogPickerItemData> {
  items: readonly T[]
  selectedKey: string | null
  focusedIndex: number
  onSelect: (item: T) => void
  onFocusChange: (index: number) => void
  /** Optional render slot for the info button area of each item */
  renderInfoSlot?: ((item: T) => ReactNode) | undefined
  /** Empty state message */
  emptyMessage?: string | undefined
}

export interface CatalogPickerItemProps {
  label: string
  shortDescription: string
  isSelected: boolean
  isFocused: boolean
  onClick: () => void
  onMouseEnter: () => void
  /** Slot for info icon / tooltip */
  infoSlot?: ReactNode | undefined
}
