import { describe, expect, it } from 'vitest'
import type { PluginSchema } from '@/shared/types'
import type { GitHubRepoInfo } from '../github-api'
import {
  createSchemalessPlugin,
  getSchemaRawUrl,
  mergeApiMetadata,
  parseGitHubUrl,
} from '../github-import'

// ============================================
// Test helpers
// ============================================

function makeRepoInfo(overrides?: Partial<GitHubRepoInfo>): GitHubRepoInfo {
  return {
    name: 'flash.nvim',
    fullName: 'folke/flash.nvim',
    description: 'Navigate your code with search labels',
    owner: 'folke',
    stars: 2340,
    defaultBranch: 'main',
    homepage: null,
    license: 'Apache-2.0',
    topics: ['neovim', 'navigation'],
    ...overrides,
  }
}

function makeSchema(overrides?: Partial<PluginSchema>): PluginSchema {
  return {
    id: 'flash-nvim',
    pluginName: 'flash.nvim',
    pluginRepo: 'https://github.com/folke/flash.nvim',
    version: '1.0.0',
    description: 'Schema description',
    author: 'folke',
    stars: 2000,
    tags: ['navigation'],
    options: [],
    functions: [],
    ...overrides,
  }
}

// ============================================
// parseGitHubUrl
// ============================================

describe('parseGitHubUrl', () => {
  it('parses full HTTPS URL', () => {
    const result = parseGitHubUrl('https://github.com/folke/flash.nvim')
    expect(result).toEqual({
      success: true,
      owner: 'folke',
      repo: 'flash.nvim',
    })
  })

  it('parses URL without protocol', () => {
    const result = parseGitHubUrl('github.com/folke/flash.nvim')
    expect(result).toEqual({
      success: true,
      owner: 'folke',
      repo: 'flash.nvim',
    })
  })

  it('parses HTTP URL', () => {
    const result = parseGitHubUrl('http://github.com/folke/flash.nvim')
    expect(result).toEqual({
      success: true,
      owner: 'folke',
      repo: 'flash.nvim',
    })
  })

  it('strips trailing slash', () => {
    const result = parseGitHubUrl('https://github.com/folke/flash.nvim/')
    expect(result).toEqual({
      success: true,
      owner: 'folke',
      repo: 'flash.nvim',
    })
  })

  it('strips .git suffix', () => {
    const result = parseGitHubUrl('https://github.com/folke/flash.nvim.git')
    expect(result).toEqual({
      success: true,
      owner: 'folke',
      repo: 'flash.nvim',
    })
  })

  it('strips both trailing slash and .git', () => {
    const result = parseGitHubUrl('https://github.com/folke/flash.nvim.git/')
    expect(result).toEqual({
      success: true,
      owner: 'folke',
      repo: 'flash.nvim',
    })
  })

  it('rejects non-GitHub URLs', () => {
    const result = parseGitHubUrl('https://gitlab.com/folke/flash.nvim')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('github.com')
    }
  })

  it('rejects URLs without owner/repo', () => {
    const result = parseGitHubUrl('https://github.com/folke')
    expect(result.success).toBe(false)
  })

  it('rejects empty string', () => {
    const result = parseGitHubUrl('')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('empty')
    }
  })

  it('rejects whitespace-only string', () => {
    const result = parseGitHubUrl('   ')
    expect(result.success).toBe(false)
  })

  it('handles URL with extra path segments (uses first two)', () => {
    // Extra path segments beyond owner/repo are ignored
    const result = parseGitHubUrl(
      'https://github.com/folke/flash.nvim/tree/main',
    )
    expect(result).toEqual({
      success: true,
      owner: 'folke',
      repo: 'flash.nvim',
    })
  })
})

// ============================================
// getSchemaRawUrl
// ============================================

describe('getSchemaRawUrl', () => {
  it('constructs correct raw URL for main branch', () => {
    const url = getSchemaRawUrl('folke', 'flash.nvim', 'main')
    expect(url).toBe(
      'https://raw.githubusercontent.com/folke/flash.nvim/main/vinela.schema.json',
    )
  })

  it('constructs correct raw URL for master branch', () => {
    const url = getSchemaRawUrl('nvim-telescope', 'telescope.nvim', 'master')
    expect(url).toBe(
      'https://raw.githubusercontent.com/nvim-telescope/telescope.nvim/master/vinela.schema.json',
    )
  })

  it('encodes special characters in owner/repo', () => {
    const url = getSchemaRawUrl('my org', 'my repo', 'main')
    expect(url).toContain('my%20org')
    expect(url).toContain('my%20repo')
  })
})

// ============================================
// createSchemalessPlugin
// ============================================

describe('createSchemalessPlugin', () => {
  it('generates valid schema with github: prefix ID', () => {
    const info = makeRepoInfo()
    const schema = createSchemalessPlugin(info)
    expect(schema.id).toBe('github:folke/flash.nvim')
  })

  it('has empty options and functions arrays', () => {
    const info = makeRepoInfo()
    const schema = createSchemalessPlugin(info)
    expect(schema.options).toEqual([])
    expect(schema.functions).toEqual([])
  })

  it('maps API fields correctly', () => {
    const info = makeRepoInfo()
    const schema = createSchemalessPlugin(info)
    expect(schema.pluginName).toBe('flash.nvim')
    expect(schema.pluginRepo).toBe('https://github.com/folke/flash.nvim')
    expect(schema.author).toBe('folke')
    expect(schema.stars).toBe(2340)
    expect(schema.version).toBe('0.0.0')
  })

  it('uses topics as tags when available', () => {
    const info = makeRepoInfo({ topics: ['neovim', 'navigation', 'search'] })
    const schema = createSchemalessPlugin(info)
    expect(schema.tags).toEqual(['neovim', 'navigation', 'search'])
  })

  it('omits tags when topics empty', () => {
    const info = makeRepoInfo({ topics: [] })
    const schema = createSchemalessPlugin(info)
    expect(schema.tags).toBeUndefined()
  })

  it('sets description from API when available', () => {
    const info = makeRepoInfo({ description: 'A great plugin' })
    const schema = createSchemalessPlugin(info)
    expect(schema.description).toBe('A great plugin')
  })

  it('omits description when API returns null', () => {
    const info = makeRepoInfo({ description: null })
    const schema = createSchemalessPlugin(info)
    expect(schema.description).toBeUndefined()
  })

  it('uses fullName for ID construction', () => {
    const info = makeRepoInfo({ fullName: 'nvim-treesitter/nvim-treesitter' })
    const schema = createSchemalessPlugin(info)
    expect(schema.id).toBe('github:nvim-treesitter/nvim-treesitter')
  })
})

// ============================================
// mergeApiMetadata
// ============================================

describe('mergeApiMetadata', () => {
  it('overrides stars with API value', () => {
    const schema = makeSchema({ stars: 2000 })
    const info = makeRepoInfo({ stars: 2500 })
    const merged = mergeApiMetadata(schema, info)
    expect(merged.stars).toBe(2500)
  })

  it('fills author gap from API when schema has no author', () => {
    const base = makeSchema()
    const schema: PluginSchema = { ...base }
    delete (schema as { author?: string }).author
    const info = makeRepoInfo({ owner: 'folke' })
    const merged = mergeApiMetadata(schema, info)
    expect(merged.author).toBe('folke')
  })

  it('preserves schema author over API owner', () => {
    const schema = makeSchema({ author: 'schema-author' })
    const info = makeRepoInfo({ owner: 'api-owner' })
    const merged = mergeApiMetadata(schema, info)
    expect(merged.author).toBe('schema-author')
  })

  it('fills description gap from API when schema has no description', () => {
    // Build schema without description field (exactOptionalPropertyTypes: omit the key)
    const base = makeSchema()
    const schema: PluginSchema = { ...base }
    delete (schema as { description?: string }).description
    const info = makeRepoInfo({ description: 'API description' })
    const merged = mergeApiMetadata(schema, info)
    expect(merged.description).toBe('API description')
  })

  it('preserves schema description over API description', () => {
    const schema = makeSchema({ description: 'Schema description' })
    const info = makeRepoInfo({ description: 'API description' })
    const merged = mergeApiMetadata(schema, info)
    expect(merged.description).toBe('Schema description')
  })

  it('does not set description when API returns null and schema has none', () => {
    const base = makeSchema()
    const schema: PluginSchema = { ...base }
    delete (schema as { description?: string }).description
    const info = makeRepoInfo({ description: null })
    const merged = mergeApiMetadata(schema, info)
    expect(merged.description).toBeUndefined()
  })

  it('fills tags gap from topics when schema has no tags', () => {
    const base = makeSchema()
    const schema: PluginSchema = { ...base }
    delete (schema as { tags?: string[] }).tags
    const info = makeRepoInfo({ topics: ['neovim', 'search'] })
    const merged = mergeApiMetadata(schema, info)
    expect(merged.tags).toEqual(['neovim', 'search'])
  })

  it('preserves schema tags over API topics', () => {
    const schema = makeSchema({ tags: ['schema-tag'] })
    const info = makeRepoInfo({ topics: ['api-topic'] })
    const merged = mergeApiMetadata(schema, info)
    expect(merged.tags).toEqual(['schema-tag'])
  })

  it('does not set tags when topics empty and schema has none', () => {
    const base = makeSchema()
    const schema: PluginSchema = { ...base }
    delete (schema as { tags?: string[] }).tags
    const info = makeRepoInfo({ topics: [] })
    const merged = mergeApiMetadata(schema, info)
    expect(merged.tags).toBeUndefined()
  })

  it('preserves all other schema fields unchanged', () => {
    const schema = makeSchema({
      id: 'my-plugin',
      pluginName: 'my.nvim',
      version: '2.0.0',
      options: [],
      functions: [],
    })
    const info = makeRepoInfo()
    const merged = mergeApiMetadata(schema, info)
    expect(merged.id).toBe('my-plugin')
    expect(merged.pluginName).toBe('my.nvim')
    expect(merged.version).toBe('2.0.0')
  })
})
