/**
 * LSP Server Catalog
 *
 * Curated list of popular language servers bundled with the app.
 * Each server has metadata for display and Mason package mapping.
 */

import type { LspServerDefinition } from '@/shared/types/lsp'

export const LSP_SERVER_CATALOG: readonly LspServerDefinition[] = [
  // ============================================
  // Scripting Languages
  // ============================================
  {
    name: 'lua_ls',
    label: 'Lua Language Server',
    description:
      'Feature-rich language server for Lua with type inference and diagnostics',
    languages: ['Lua'],
    filetypes: ['lua'],
    masonPackage: 'lua-language-server',
    category: 'scripting',
    isPopular: true,
    searchAliases: ['lua', 'luau'],
  },
  {
    name: 'pyright',
    label: 'Pyright',
    description:
      "Microsoft's static type checker and language server for Python",
    languages: ['Python'],
    filetypes: ['python'],
    masonPackage: 'pyright',
    category: 'scripting',
    isPopular: true,
    searchAliases: ['python', 'pylance'],
  },
  {
    name: 'pylsp',
    label: 'Python LSP Server',
    description:
      'Community-maintained Python language server with many plugins',
    languages: ['Python'],
    filetypes: ['python'],
    masonPackage: 'python-lsp-server',
    category: 'scripting',
    isPopular: false,
    searchAliases: ['python', 'pyls'],
  },
  {
    name: 'bashls',
    label: 'Bash Language Server',
    description:
      'Language server for Bash shell scripts with documentation support',
    languages: ['Bash', 'Shell'],
    filetypes: ['sh', 'bash'],
    masonPackage: 'bash-language-server',
    category: 'scripting',
    isPopular: false,
    searchAliases: ['bash', 'shell', 'sh'],
  },
  {
    name: 'intelephense',
    label: 'Intelephense',
    description: 'High-performance PHP language server with rich IDE features',
    languages: ['PHP'],
    filetypes: ['php'],
    masonPackage: 'intelephense',
    category: 'scripting',
    isPopular: false,
    searchAliases: ['php'],
  },

  // ============================================
  // Web Development
  // ============================================
  {
    name: 'vtsls',
    label: 'TypeScript/JavaScript (VTSLS)',
    description: 'Fast TypeScript language server with advanced refactorings',
    languages: ['TypeScript', 'JavaScript'],
    filetypes: ['typescript', 'javascript', 'tsx', 'jsx'],
    masonPackage: 'vtsls',
    category: 'web',
    isPopular: true,
    note: 'Recommended over ts_ls - faster and more actively maintained',
    searchAliases: ['typescript', 'javascript', 'ts', 'js'],
  },
  {
    name: 'ts_ls',
    label: 'TypeScript Language Server',
    description: 'Official TypeScript language server from Microsoft',
    languages: ['TypeScript', 'JavaScript'],
    filetypes: ['typescript', 'javascript', 'tsx', 'jsx'],
    masonPackage: 'typescript-language-server',
    category: 'web',
    isPopular: false,
    searchAliases: ['typescript', 'javascript', 'ts', 'js', 'tsserver'],
  },
  {
    name: 'cssls',
    label: 'CSS Language Server',
    description: "VSCode's CSS language server with SCSS/Less support",
    languages: ['CSS', 'SCSS', 'Less'],
    filetypes: ['css', 'scss', 'less'],
    masonPackage: 'css-lsp',
    category: 'web',
    isPopular: true,
    searchAliases: ['css', 'scss', 'sass', 'less'],
  },
  {
    name: 'html',
    label: 'HTML Language Server',
    description:
      "VSCode's HTML language server with tag completion and validation",
    languages: ['HTML'],
    filetypes: ['html', 'htm'],
    masonPackage: 'html-lsp',
    category: 'web',
    isPopular: true,
    searchAliases: ['html', 'htm'],
  },
  {
    name: 'tailwindcss',
    label: 'Tailwind CSS IntelliSense',
    description: 'Intelligent Tailwind CSS autocomplete and documentation',
    languages: ['CSS', 'Tailwind CSS'],
    filetypes: [
      'css',
      'scss',
      'html',
      'javascript',
      'typescript',
      'jsx',
      'tsx',
    ],
    masonPackage: 'tailwindcss-language-server',
    category: 'web',
    isPopular: true,
    searchAliases: ['tailwind', 'css'],
  },
  {
    name: 'emmet_ls',
    label: 'Emmet Abbreviations',
    description: 'Expands Emmet abbreviations for HTML/CSS in more filetypes',
    languages: ['HTML', 'CSS'],
    filetypes: ['html', 'css', 'scss', 'jsx', 'tsx', 'vue', 'svelte'],
    masonPackage: 'emmet-ls',
    category: 'web',
    isPopular: false,
    searchAliases: ['emmet', 'abbreviations'],
  },
  {
    name: 'svelte',
    label: 'Svelte Language Server',
    description: 'Language server for Svelte and SvelteKit components',
    languages: ['Svelte'],
    filetypes: ['svelte'],
    masonPackage: 'svelte-language-server',
    category: 'web',
    isPopular: false,
    searchAliases: ['svelte', 'sveltekit'],
  },
  {
    name: 'astro',
    label: 'Astro Language Server',
    description: 'Language server for Astro framework components',
    languages: ['Astro'],
    filetypes: ['astro'],
    masonPackage: 'astro-language-server',
    category: 'web',
    isPopular: false,
    searchAliases: ['astro'],
  },
  {
    name: 'graphql',
    label: 'GraphQL Language Server',
    description: 'Language server for GraphQL with autocomplete and validation',
    languages: ['GraphQL'],
    filetypes: ['graphql', 'gql'],
    masonPackage: 'graphql-language-service-cli',
    category: 'web',
    isPopular: false,
    searchAliases: ['graphql', 'gql'],
  },

  // ============================================
  // Data & Config Files
  // ============================================
  {
    name: 'jsonls',
    label: 'JSON Language Server',
    description: "VSCode's JSON language server with schema support",
    languages: ['JSON', 'JSONC'],
    filetypes: ['json', 'jsonc'],
    masonPackage: 'json-lsp',
    category: 'data',
    isPopular: true,
    searchAliases: ['json'],
  },
  {
    name: 'yamlls',
    label: 'YAML Language Server',
    description: 'Language server for YAML with Kubernetes support',
    languages: ['YAML'],
    filetypes: ['yaml', 'yml'],
    masonPackage: 'yaml-language-server',
    category: 'data',
    isPopular: false,
    searchAliases: ['yaml', 'yml'],
  },
  {
    name: 'taplo',
    label: 'TOML Language Server',
    description: 'Language server for TOML configuration files',
    languages: ['TOML'],
    filetypes: ['toml'],
    masonPackage: 'taplo',
    category: 'data',
    isPopular: false,
    searchAliases: ['toml'],
  },
  {
    name: 'marksman',
    label: 'Marksman',
    description: 'Language server for Markdown with wiki-links support',
    languages: ['Markdown'],
    filetypes: ['markdown', 'md'],
    masonPackage: 'marksman',
    category: 'data',
    isPopular: false,
    searchAliases: ['markdown', 'md'],
  },

  // ============================================
  // Systems Programming
  // ============================================
  {
    name: 'rust_analyzer',
    label: 'Rust Analyzer',
    description:
      'Full-featured language server for Rust with deep IDE integration',
    languages: ['Rust'],
    filetypes: ['rust'],
    masonPackage: 'rust-analyzer',
    category: 'systems',
    isPopular: true,
    searchAliases: ['rust', 'cargo'],
  },
  {
    name: 'clangd',
    label: 'Clangd',
    description: "LLVM's C/C++ language server with excellent code navigation",
    languages: ['C', 'C++'],
    filetypes: ['c', 'cpp', 'cc', 'cxx', 'h', 'hpp'],
    masonPackage: 'clangd',
    category: 'systems',
    isPopular: true,
    searchAliases: ['c', 'c++', 'cpp', 'clang'],
  },
  {
    name: 'gopls',
    label: 'Go Language Server',
    description: 'Official Go language server from the Go team',
    languages: ['Go'],
    filetypes: ['go'],
    masonPackage: 'gopls',
    category: 'systems',
    isPopular: true,
    searchAliases: ['go', 'golang'],
  },
  {
    name: 'zls',
    label: 'Zig Language Server',
    description: 'Community language server for the Zig programming language',
    languages: ['Zig'],
    filetypes: ['zig'],
    masonPackage: 'zls',
    category: 'systems',
    isPopular: false,
    searchAliases: ['zig'],
  },

  // ============================================
  // DevOps & Infrastructure
  // ============================================
  {
    name: 'dockerls',
    label: 'Dockerfile Language Server',
    description: 'Language server for Dockerfiles with validation',
    languages: ['Dockerfile'],
    filetypes: ['dockerfile'],
    masonPackage: 'dockerfile-language-server',
    category: 'devops',
    isPopular: false,
    searchAliases: ['docker', 'dockerfile'],
  },
  {
    name: 'docker_compose_language_service',
    label: 'Docker Compose Language Server',
    description: 'Language server for Docker Compose YAML files',
    languages: ['Docker Compose'],
    filetypes: ['yaml'],
    masonPackage: 'docker-compose-language-service',
    category: 'devops',
    isPopular: false,
    searchAliases: ['docker', 'docker-compose', 'compose'],
  },
  {
    name: 'terraformls',
    label: 'Terraform Language Server',
    description: "HashiCorp's language server for Terraform HCL",
    languages: ['Terraform'],
    filetypes: ['terraform', 'tf', 'hcl'],
    masonPackage: 'terraform-ls',
    category: 'devops',
    isPopular: false,
    searchAliases: ['terraform', 'hcl', 'tf'],
  },
  {
    name: 'helm_ls',
    label: 'Helm Language Server',
    description: 'Language server for Helm charts and templates',
    languages: ['Helm'],
    filetypes: ['helm', 'yaml'],
    masonPackage: 'helm-ls',
    category: 'devops',
    isPopular: false,
    searchAliases: ['helm', 'kubernetes', 'k8s'],
  },

  // ============================================
  // Game Development
  // ============================================
  {
    name: 'gdscript',
    label: 'GDScript',
    description: "Language server for Godot Engine's GDScript",
    languages: ['GDScript'],
    filetypes: ['gdscript', 'gd'],
    masonPackage: null, // Must be installed via Godot or system package manager
    category: 'game-dev',
    isPopular: false,
    note: 'Must be installed via Godot Editor or system package manager',
    searchAliases: ['godot', 'gdscript'],
  },
] as const

/**
 * Get a server definition by name.
 */
export function getServerDefinition(
  name: string,
): LspServerDefinition | undefined {
  return LSP_SERVER_CATALOG.find((s) => s.name === name)
}

/**
 * Get all servers in a category.
 */
export function getServersByCategory(
  category: LspServerDefinition['category'],
): readonly LspServerDefinition[] {
  return LSP_SERVER_CATALOG.filter((s) => s.category === category)
}

/**
 * Get popular servers.
 */
export function getPopularServers(): readonly LspServerDefinition[] {
  return LSP_SERVER_CATALOG.filter((s) => s.isPopular)
}

/**
 * Search servers by query.
 */
export function searchServers(query: string): readonly LspServerDefinition[] {
  const normalized = query.toLowerCase().trim()
  if (normalized.length === 0) {
    return [...LSP_SERVER_CATALOG]
  }

  return LSP_SERVER_CATALOG.filter((server) => {
    // Search by name
    if (server.name.toLowerCase().includes(normalized)) return true
    // Search by label
    if (server.label.toLowerCase().includes(normalized)) return true
    // Search by languages
    if (server.languages.some((l) => l.toLowerCase().includes(normalized)))
      return true
    // Search by aliases
    if (server.searchAliases?.some((a) => a.toLowerCase().includes(normalized)))
      return true
    return false
  })
}

/**
 * Get Mason package names for enabled servers.
 * Returns null for servers that can't be installed via Mason.
 */
export function getMasonPackagesForServers(serverNames: string[]): string[] {
  return serverNames
    .map((name) => getServerDefinition(name)?.masonPackage)
    .filter((pkg): pkg is string => pkg !== null && pkg !== undefined)
}
