/**
 * LspServersPage Component
 *
 * Main page for managing Language Server Protocol (LSP) servers.
 * Shows setup screen when prerequisites are missing, full server list when ready.
 */

import { Braces, Info, Lightbulb, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePluginStore } from '@/features/plugins/store'
import { useProjectStore } from '@/features/projects/store'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  getMasonPackagesForServers,
  LSP_SERVER_CATALOG,
  searchServers,
} from '@/shared/data/lsp-server-catalog'
import {
  LSP_CATEGORY_LABELS,
  LSP_CATEGORY_ORDER,
  type LspServerCategory,
} from '@/shared/types/lsp'
import { useLspPrerequisites } from '../hooks/useLspPrerequisites'
import { useLspStore } from '../store'

// ============================================
// LspInfoModal Component
// ============================================

function LspInfoModal(): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Info className="h-4 w-4" />
          About Mason & LSP
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>About Language Servers & Mason</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            <section>
              <h3 className="font-semibold mb-2">What are Language Servers?</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Language servers provide smart features for your code:
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Code completions — suggestions as you type</li>
                <li>Diagnostics — errors and warnings in real-time</li>
                <li>Go to definition — jump to where something is defined</li>
                <li>Rename — rename variables across your project</li>
                <li>Code actions — quick fixes and refactors</li>
                <li>Formatting — auto-format your code</li>
              </ul>
            </section>

            <hr />

            <section>
              <h3 className="font-semibold mb-2">How It Works</h3>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>mason.nvim installs server binaries onto your system</li>
                <li>
                  nvim-lspconfig provides default configs for 100+ servers
                </li>
                <li>You enable servers on this page</li>
                <li>
                  When you generate your config, servers are auto-installed and
                  activated on Neovim startup
                </li>
              </ol>
            </section>

            <hr />

            <section>
              <h3 className="font-semibold mb-2">Managing Servers in Neovim</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Servers enabled here are auto-installed when Neovim starts. You
                can also manage them manually:
              </p>
              <ul className="text-sm space-y-1 font-mono">
                <li>:Mason — Open Mason UI (browse, install, update)</li>
                <li>:MasonInstall &lt;name&gt; — Install a specific package</li>
                <li>:MasonUpdate — Update Mason registry</li>
                <li>:LspRestart — Restart LSP for current file</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// LspSetupScreen Component
// ============================================

function LspSetupScreen(): React.JSX.Element {
  const { isMasonInstalled, isLspconfigInstalled } = useLspPrerequisites()
  const installPlugin = usePluginStore((s) => s.installPlugin)
  const initializePlugins = usePluginStore((s) => s.initializePlugins)
  const projectPath = useProjectStore((s) => s.currentProject?.absolutePath)
  const [isInstalling, setIsInstalling] = useState(false)

  const handleInstallBoth = async () => {
    if (!projectPath) return
    setIsInstalling(true)
    try {
      if (!isMasonInstalled) {
        await installPlugin(projectPath, 'mason-nvim')
      }
      if (!isLspconfigInstalled) {
        await installPlugin(projectPath, 'nvim-lspconfig')
      }
      await initializePlugins(projectPath)
    } finally {
      setIsInstalling(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🔧</span> Set Up Language Servers
          </CardTitle>
          <CardDescription>
            Language servers provide code intelligence — completions,
            diagnostics, go-to-definition, and more. To use them, you need two
            plugins:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mason Card */}
          <Card
            className={
              isMasonInstalled ? 'border-green-500/50 bg-green-50/50' : ''
            }
          >
            <CardContent className="p-4 flex items-start gap-4">
              <div className="mt-1">
                {isMasonInstalled ? (
                  <span className="text-green-600">✅</span>
                ) : (
                  <span className="text-muted-foreground">⭕</span>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-medium">mason.nvim</h4>
                <p className="text-sm text-muted-foreground">
                  Installs language server binaries.
                </p>
              </div>
              {!isMasonInstalled && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    projectPath && void installPlugin(projectPath, 'mason-nvim')
                  }
                  disabled={isInstalling}
                >
                  Install
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Lspconfig Card */}
          <Card
            className={
              isLspconfigInstalled ? 'border-green-500/50 bg-green-50/50' : ''
            }
          >
            <CardContent className="p-4 flex items-start gap-4">
              <div className="mt-1">
                {isLspconfigInstalled ? (
                  <span className="text-green-600">✅</span>
                ) : (
                  <span className="text-muted-foreground">⭕</span>
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-medium">nvim-lspconfig</h4>
                <p className="text-sm text-muted-foreground">
                  Provides default configurations for 100+ servers.
                </p>
              </div>
              {!isLspconfigInstalled && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    projectPath &&
                    void installPlugin(projectPath, 'nvim-lspconfig')
                  }
                  disabled={isInstalling}
                >
                  Install
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Primary CTA */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleInstallBoth}
            disabled={
              isInstalling || (isMasonInstalled && isLspconfigInstalled)
            }
          >
            {isInstalling ? 'Installing...' : 'Install Both & Get Started'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// LspServerCard Component
// ============================================

interface LspServerCardProps {
  server: (typeof LSP_SERVER_CATALOG)[number]
  isEnabled: boolean
  onToggle: () => void
}

function LspServerCard({
  server,
  isEnabled,
  onToggle,
}: LspServerCardProps): React.JSX.Element {
  return (
    <Card
      className={`transition-opacity ${
        isEnabled ? 'border-l-4 border-l-primary' : 'opacity-75'
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={isEnabled}
            onCheckedChange={onToggle}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm font-mono bg-muted px-1 rounded">
                {server.name}
              </code>
              <span className="font-medium">{server.label}</span>
              {server.isPopular && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Popular
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {server.description}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {server.languages.map((lang) => (
                <span
                  key={lang}
                  className="text-xs bg-secondary px-2 py-0.5 rounded"
                >
                  {lang}
                </span>
              ))}
            </div>
            {server.note && (
              <p className="text-xs text-muted-foreground mt-2">
                💡 {server.note}
              </p>
            )}
          </div>
          <div className="text-right">
            {server.masonPackage ? (
              <span className="text-xs text-muted-foreground font-mono">
                {server.masonPackage}
              </span>
            ) : (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                Manual install
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// LspKeymapsTip Component
// ============================================

function LspKeymapsTip(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <Card className="bg-muted/50 border-dashed">
      <CardContent className="p-4 flex items-start gap-4">
        <Lightbulb className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm">
            <strong>Tip:</strong> Neovim 0.11+ includes built-in LSP keymaps (
            <code>grn</code> = rename, <code>grr</code> = references,{' '}
            <code>gra</code> = code actions, <code>gri</code> = implementation,
            <code>Ctrl-S</code> = signature help). You can add custom LSP
            keymaps in the Keymaps page using Run Function → LSP category.
          </p>
          <Button
            variant="link"
            size="sm"
            className="px-0 h-auto mt-1"
            onClick={() => navigate('/keymaps')}
          >
            Go to Keymaps →
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page Component
// ============================================

export default function LspServersPage(): React.JSX.Element {
  const { allPrerequisitesMet } = useLspPrerequisites()
  const projectPath = useProjectStore((s) => s.currentProject?.absolutePath)
  const { enabledServers, loadFromProject, toggleServer } = useLspStore()

  const [search, setSearch] = useState('')
  const [showPopular, setShowPopular] = useState(true)
  const [showEnabled, setShowEnabled] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<
    LspServerCategory | 'all'
  >('all')

  // Load from project on mount
  useEffect(() => {
    if (projectPath) {
      void loadFromProject(projectPath)
    }
  }, [projectPath, loadFromProject])

  // Filter and group servers
  const filteredServers = useMemo(() => {
    let servers = search ? searchServers(search) : [...LSP_SERVER_CATALOG]

    if (showPopular) {
      servers = servers.filter((s) => s.isPopular)
    }

    if (showEnabled) {
      servers = servers.filter((s) => enabledServers.includes(s.name))
    }

    if (categoryFilter !== 'all') {
      servers = servers.filter((s) => s.category === categoryFilter)
    }

    return servers
  }, [search, showPopular, showEnabled, categoryFilter, enabledServers])

  // Group by category
  const groupedServers = useMemo(() => {
    const groups: Record<LspServerCategory, typeof LSP_SERVER_CATALOG> = {
      web: [],
      systems: [],
      scripting: [],
      data: [],
      devops: [],
      'game-dev': [],
      other: [],
    }
    for (const server of filteredServers) {
      const groupList = groups[
        server.category
      ] as (typeof LSP_SERVER_CATALOG)[number][]
      groupList.push(server)
    }
    return groups
  }, [filteredServers])

  const enabledCount = enabledServers.length
  const masonPackages = getMasonPackagesForServers(enabledServers)

  // Show setup screen if prerequisites not met
  if (!allPrerequisitesMet) {
    return <LspSetupScreen />
  }

  return (
    <div className="h-full flex flex-col" data-tutorial="lsp-servers-page">
      {/* Header */}
      <header className="shrink-0 border-b p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Braces className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-2xl font-bold">Language Servers</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Enable language servers for code intelligence, diagnostics, and
              completions
            </p>
          </div>
          <LspInfoModal />
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          {/* Keymaps Tip */}
          <LspKeymapsTip />

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search servers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={categoryFilter}
              onValueChange={(v) =>
                setCategoryFilter(v as LspServerCategory | 'all')
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {LSP_CATEGORY_ORDER.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {LSP_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox
                id="popular-filter"
                checked={showPopular}
                onCheckedChange={(checked) => setShowPopular(checked === true)}
              />
              <label
                htmlFor="popular-filter"
                className="text-sm cursor-pointer"
              >
                Popular only
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="enabled-filter"
                checked={showEnabled}
                onCheckedChange={(checked) => setShowEnabled(checked === true)}
              />
              <label
                htmlFor="enabled-filter"
                className="text-sm cursor-pointer"
              >
                Enabled only
              </label>
            </div>
          </div>

          {/* Results Summary */}
          <div className="text-sm text-muted-foreground">
            {enabledCount} of {LSP_SERVER_CATALOG.length} servers enabled
            {masonPackages.length > 0 && (
              <span>
                {' '}
                · {masonPackages.length} will be auto-installed via Mason
              </span>
            )}
          </div>

          {/* Server List by Category */}
          <div className="space-y-6">
            {LSP_CATEGORY_ORDER.map((category) => {
              const servers = groupedServers[category]
              if (servers.length === 0) return null

              return (
                <section key={category}>
                  <h2 className="text-lg font-semibold mb-3">
                    {LSP_CATEGORY_LABELS[category]}
                  </h2>
                  <div className="space-y-3">
                    {servers.map((server) => (
                      <LspServerCard
                        key={server.name}
                        server={server}
                        isEnabled={enabledServers.includes(server.name)}
                        onToggle={() => void toggleServer(server.name)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}

            {filteredServers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No servers match your filters</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSearch('')
                    setShowPopular(false)
                    setShowEnabled(false)
                    setCategoryFilter('all')
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
