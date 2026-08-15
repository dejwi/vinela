import { Glob } from 'bun'

const ALLOWED_FILES = new Set<string>([
  'src/features/lua-generator/utils/__tests__/lua-utils.test.ts',
  'src/features/lua-generator/orchestrator/__tests__/full-pipeline.test.ts',
  'src/features/lua-generator/__tests__/utils/lua-matchers.test.ts',
])

const BLOCKED_LITERAL = '_G._vinela_callables["'

const TEST_PATTERNS = [
  'src/features/lua-generator/**/*.test.ts',
  'src/features/lua-generator/**/*.test.tsx',
  'src/features/lua-generator/**/*.spec.ts',
  'src/features/lua-generator/**/*.spec.tsx',
] as const

const offenders = new Set<string>()

for (const pattern of TEST_PATTERNS) {
  for await (const filePath of new Glob(pattern).scan('.')) {
    if (ALLOWED_FILES.has(filePath)) {
      continue
    }

    const text = await Bun.file(filePath).text()
    if (text.includes(BLOCKED_LITERAL)) {
      offenders.add(filePath)
    }
  }
}

if (offenders.size > 0) {
  console.error('Hard-coded callable key literals found:')
  for (const path of [...offenders].sort((a, b) => a.localeCompare(b))) {
    console.error(`- ${path}`)
  }
  console.error(
    'Use expectedCallableRef()/expectedAutocmdCallbackRef() or custom lua matchers instead.',
  )
  process.exit(1)
}
