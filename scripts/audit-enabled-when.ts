import fs from 'node:fs'

const ALLOWLIST = new Set([
  'animate.enabled',
  'bigfile.enabled',
  'dashboard.enabled',
  'dim.enabled',
  'explorer.enabled',
  'gitbrowse.enabled',
  'image.enabled',
  'indent.enabled',
  'input.enabled',
  'lazygit.enabled',
  'notifier.enabled',
  'picker.enabled',
  'profiler.enabled',
  'quickfile.enabled',
  'scope.enabled',
  'scratch.enabled',
  'scroll.enabled',
  'statuscolumn.enabled',
  'terminal.enabled',
  'toggle.enabled',
  'words.enabled',
  'zen.enabled',
])

const schemaPath = process.argv[2] ?? 'src/schemas/snacks-nvim.json'
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
  options: Array<{ key: string; visibleWhen?: { key: string; equals: unknown } }>
}

let migrate = 0
let keep = 0
for (const option of schema.options) {
  if (option.visibleWhen === undefined) continue
  const isModuleGate =
    ALLOWLIST.has(option.visibleWhen.key) && option.visibleWhen.equals === true
  console.log(
    isModuleGate ? 'MIGRATE' : 'KEEP   ',
    option.key.padEnd(40),
    '<-',
    JSON.stringify(option.visibleWhen),
  )
  if (isModuleGate) migrate += 1
  else keep += 1
}

console.error(`\nSummary: migrate=${migrate}, keep=${keep}`)
