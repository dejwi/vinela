import { SECTION_ORDER } from '@/features/lua-generator/sections/types'
import type { SectionId, SectionResult } from '@/features/lua-generator/types'
import { LuaBuilder } from '@/features/lua-generator/utils/lua-builder'
import {
  CALLABLE_REGISTRY_GLOBAL,
  GENERATED_CONFIG_MARKER,
} from '@/shared/lib/app-identity'

export interface AssemblyOptions {
  projectName: string
  generationDate: string
}

/**
 * Assemble the final init.lua from all generated sections.
 *
 * Canonical final order:
 * 1. Header comment
 * 2. Leader key
 * 3. Neovim options
 * 4. Callable graph functions
 * 5. Plugin declarations/config
 * 6. LSP setup
 * 7. Colorscheme
 * 8. Highlights
 * 9. Project keymaps
 * 10. Startup graph execution
 */
export function assembleFinalInitLua(
  sections: SectionResult[],
  callableFunctionSnippets: string[][],
  startupExecutionSnippets: string[][],
  options: AssemblyOptions,
): string {
  const orderedSections = [...sections].sort(
    (a, b) => getSectionOrderIndex(a.id) - getSectionOrderIndex(b.id),
  )

  const seen = new Set<SectionId>()
  const dedupedSections = orderedSections.filter((section) => {
    if (seen.has(section.id)) {
      console.warn(`Duplicate section: ${section.id}`)
      return false
    }
    seen.add(section.id)
    return true
  })

  const sectionsById = new Map<SectionId, SectionResult>()
  for (const section of dedupedSections) {
    sectionsById.set(section.id, section)
  }

  const builder = new LuaBuilder()

  // Header
  builder.comment('============================================')
  builder.comment(GENERATED_CONFIG_MARKER.slice('-- '.length))
  builder.comment(`Project: ${options.projectName}`)
  builder.comment(`Generated: ${options.generationDate}`)
  builder.comment('============================================')
  builder.blank()

  // Initialize callable registry before any callable writes
  builder.line(
    `_G.${CALLABLE_REGISTRY_GLOBAL} = _G.${CALLABLE_REGISTRY_GLOBAL} or {}`,
  )
  builder.blank()

  for (const sectionId of SECTION_ORDER) {
    if (sectionId === 'callable-functions') {
      emitCallableFunctionsSection(builder, callableFunctionSnippets)
      continue
    }

    const section = sectionsById.get(sectionId)
    if (!section || section.code.length === 0) {
      continue
    }

    builder.comment(`Section: ${section.id}`)
    for (const line of section.code) {
      builder.line(line)
    }
    builder.blank()
  }

  // Startup execution is always emitted last
  emitStartupSection(builder, startupExecutionSnippets)

  return builder.build()
}

function getSectionOrderIndex(sectionId: SectionId): number {
  const index = SECTION_ORDER.indexOf(sectionId)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function emitCallableFunctionsSection(
  builder: LuaBuilder,
  snippets: string[][],
): void {
  if (!emitSnippetSection(builder, 'Section: callable-functions', snippets)) {
    return
  }

  builder.blank()
}

function emitStartupSection(builder: LuaBuilder, snippets: string[][]): void {
  if (!emitSnippetSection(builder, 'Startup Execution', snippets)) {
    return
  }

  builder.blank()
}

function emitSnippetSection(
  builder: LuaBuilder,
  title: string,
  snippets: string[][],
): boolean {
  let emittedSnippetCount = 0

  for (const snippet of snippets) {
    if (snippet.length === 0) {
      continue
    }

    if (emittedSnippetCount === 0) {
      builder.comment(title)
    } else {
      builder.blank()
    }

    for (const line of snippet) {
      builder.line(line)
    }

    emittedSnippetCount++
  }

  return emittedSnippetCount > 0
}
