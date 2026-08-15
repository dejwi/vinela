import { X } from 'lucide-react'
import { DialogClose } from '@/shared/components/ui/dialog'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Separator } from '@/shared/components/ui/separator'
import type {
  CatalogPickerSidebarProps,
  CatalogPickerSidebarSection,
} from './types'

function SidebarItem({
  section,
  isSelected,
  onClick,
}: {
  section: CatalogPickerSidebarSection
  isSelected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
      }`}
    >
      {section.icon}
      <span className="flex-1 text-left">{section.label}</span>
      {section.count !== undefined && (
        <span className="text-xs text-muted-foreground">{section.count}</span>
      )}
    </button>
  )
}

export function CatalogPickerSidebar({
  title,
  activeView,
  views,
  categories,
  additionalGroups,
  onSelect,
  footerItems,
  showClose,
}: CatalogPickerSidebarProps): React.JSX.Element {
  return (
    <aside className="w-44 shrink-0 border-r bg-muted/30 flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title}</h3>
        {(showClose ?? false) && (
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </DialogClose>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {views.map((view) => (
            <SidebarItem
              key={view.key}
              section={view}
              isSelected={activeView === view.key}
              onClick={() => onSelect(view.key)}
            />
          ))}

          {categories.length > 0 && (
            <>
              <Separator className="my-2" />
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Categories
              </p>
              {categories.map((cat) => (
                <SidebarItem
                  key={cat.key}
                  section={cat}
                  isSelected={activeView === cat.key}
                  onClick={() => onSelect(cat.key)}
                />
              ))}
            </>
          )}
          {additionalGroups?.map(
            (group) =>
              group.items.length > 0 && (
                <div key={group.key}>
                  <Separator className="my-2" />
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <SidebarItem
                      key={item.key}
                      section={item}
                      isSelected={activeView === item.key}
                      onClick={() => onSelect(item.key)}
                    />
                  ))}
                </div>
              ),
          )}
        </div>
      </ScrollArea>

      {footerItems && footerItems.length > 0 && (
        <div className="p-2 border-t">
          {footerItems.map((item) => (
            <SidebarItem
              key={item.key}
              section={item}
              isSelected={activeView === item.key}
              onClick={() => onSelect(item.key)}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
