import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const FORBIDDEN_NAMES = [
  'snacks-nvim',
  'snacks.nvim',
  'mason-nvim',
  'mason.nvim',
  'blink-cmp',
  'blink.cmp',
  'formatter-nvim',
  'formatter.nvim',
  'nvim-lspconfig',
] as const

function collectSourceFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath)
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      // transforms/ stays in scope so named-plugin transform files cannot return unseen.
      if (entry === '__tests__') {
        continue
      }
      files.push(...collectSourceFiles(fullPath))
      continue
    }

    if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }

  return files
}

describe('schema-driven plugin policy', () => {
  it('keeps core generator/runtime/storage source free of named plugin branches', () => {
    const targetFiles = [
      ...collectSourceFiles(
        join(REPO_ROOT, 'src', 'features', 'lua-generator'),
      ),
      join(REPO_ROOT, 'src', 'features', 'plugins', 'storage.ts'),
    ]

    const violations: string[] = []
    for (const filePath of targetFiles) {
      const content = readFileSync(filePath, 'utf8')
      for (const forbiddenName of FORBIDDEN_NAMES) {
        if (content.includes(forbiddenName)) {
          violations.push(`${filePath}: ${forbiddenName}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
