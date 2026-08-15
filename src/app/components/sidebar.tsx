import {
  Braces,
  FolderOpen,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Palette,
  Puzzle,
  Settings,
  Sliders,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { GenerateButton } from '@/features/lua-generator/components/GenerateButton'
import { GenerateDialog } from '@/features/lua-generator/components/GenerateDialog'
import { useProjectStore } from '@/features/projects/store'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

const navItems = [
  { to: '/plugins', label: 'Plugins', icon: Puzzle },
  { to: '/keymaps', label: 'Keymaps', icon: Keyboard },
  { to: '/lsp', label: 'Language Servers', icon: Braces },
  { to: '/neovim-options', label: 'Neovim Options', icon: Sliders },
  { to: '/colorschemes', label: 'Color Schemes', icon: Palette },
  { to: '/editor', label: 'Graph Editor', icon: LayoutDashboard },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const navigate = useNavigate()
  const currentProject = useProjectStore((state) => state.currentProject)
  const closeProject = useProjectStore((state) => state.closeProject)

  const handleCloseProject = () => {
    closeProject()
    navigate('/')
  }

  return (
    <aside
      data-tutorial="sidebar"
      className="w-16 border-r bg-muted/30 flex flex-col items-center py-4 gap-2"
    >
      {/* Project Header */}
      {currentProject && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 p-0"
                title={currentProject.name}
              >
                <FolderOpen className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{currentProject.name}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {currentProject.absolutePath}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCloseProject}>
                <LogOut className="h-4 w-4 mr-2" />
                Close Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-8 h-px bg-border my-1" />
        </>
      )}

      {/* Navigation Items */}
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          data-tutorial={`nav-${to.replace('/', '') || 'editor'}`}
          className={({ isActive }) =>
            cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              'hover:bg-muted transition-colors',
              isActive && 'bg-primary text-primary-foreground',
            )
          }
          title={label}
        >
          <Icon className="w-5 h-5" />
        </NavLink>
      ))}

      {/* Spacer to push generate button to bottom */}
      <div className="flex-1" />

      {/* Generate Button - pinned to bottom */}
      {currentProject && (
        <>
          <div className="w-8 h-px bg-border my-1" />
          <GenerateButton />
        </>
      )}

      {/* Generate Dialog - rendered here but controlled by store */}
      <GenerateDialog />
    </aside>
  )
}
