interface FormatterNvimUpstreamSnapshot {
  $schema?: string
  source: string
  ref: string
  fetchedAt: string
  filetypes: Record<string, string[]>
}

const SNAPSHOT_PATH = new URL(
  '../src/schemas/__tests__/fixtures/formatter-nvim-upstream.json',
  import.meta.url,
)

const UPSTREAM_BASE_URL =
  'https://raw.githubusercontent.com/mhartington/formatter.nvim/master/lua/formatter/filetypes'
const EXPORT_NAME_PATTERN =
  /(?:^|\s)(?:M\.([A-Za-z_][A-Za-z0-9_]*)\s*=|function\s+M\.([A-Za-z_][A-Za-z0-9_]*))/g

function parseExportedNames(luaSource: string): string[] {
  const names = new Set<string>()

  for (const match of luaSource.matchAll(EXPORT_NAME_PATTERN)) {
    const name = match[1] ?? match[2]
    if (name) {
      names.add(name)
    }
  }

  return Array.from(names).sort((left, right) => left.localeCompare(right))
}

async function loadSnapshot(): Promise<FormatterNvimUpstreamSnapshot> {
  const content = await Bun.file(SNAPSHOT_PATH).text()
  return JSON.parse(content) as FormatterNvimUpstreamSnapshot
}

function printDiff(
  previous: Record<string, string[]>,
  current: Record<string, string[]>,
): void {
  for (const filetype of Object.keys(current).sort((left, right) => left.localeCompare(right))) {
    const before = new Set(previous[filetype] ?? [])
    const after = new Set(current[filetype] ?? [])

    const added = Array.from(after).filter((name) => !before.has(name))
    const removed = Array.from(before).filter((name) => !after.has(name))

    if (added.length === 0 && removed.length === 0) {
      continue
    }

    console.log(`[${filetype}]`)
    if (added.length > 0) {
      console.log(`  + ${added.join(', ')}`)
    }
    if (removed.length > 0) {
      console.log(`  - ${removed.join(', ')}`)
    }
  }
}

async function refreshSnapshot(): Promise<void> {
  const snapshot = await loadSnapshot()
  const filetypes = Object.keys(snapshot.filetypes).sort((left, right) =>
    left.localeCompare(right),
  )

  const refreshed: Record<string, string[]> = {}

  for (const filetype of filetypes) {
    const response = await fetch(`${UPSTREAM_BASE_URL}/${filetype}.lua`)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${filetype}.lua (${response.status} ${response.statusText})`,
      )
    }
    const source = await response.text()
    refreshed[filetype] = parseExportedNames(source)
  }

  const updated: FormatterNvimUpstreamSnapshot = {
    ...snapshot,
    fetchedAt: new Date().toISOString(),
    filetypes: refreshed,
  }

  printDiff(snapshot.filetypes, refreshed)

  const serialized = `${JSON.stringify(updated, null, 2)}\n`
  await Bun.write(SNAPSHOT_PATH, serialized)
}

await refreshSnapshot()
