import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runLuaSyntaxCommand } from '@/features/lua-generator/__tests__/utils/lua-syntax-command-runner'

export type LanguageResolveBehavior =
  | { readonly kind: 'resolved'; readonly lang: string }
  | { readonly kind: 'nil' }
  | { readonly kind: 'throw' }

export type TreesitterStartBehavior = 'success' | 'throw'

export interface TreesitterHarnessOptions {
  readonly setupLua: string
  readonly filetype: string
  readonly languageResolve: LanguageResolveBehavior
  readonly startBehavior: TreesitterStartBehavior
}

export interface TreesitterHarnessResult {
  readonly startCalls: readonly Readonly<{ buf: number; lang: string }>[]
  readonly callbackThrew: boolean
  readonly exitCode: number
  readonly stderr: string
}

const HARNESS_TIMEOUT_MS = 5_000

function buildGetLangStub(languageResolve: LanguageResolveBehavior): string {
  switch (languageResolve.kind) {
    case 'resolved':
      return `function(_filetype) return "${languageResolve.lang.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" end`
    case 'nil':
      return 'function(_filetype) return nil end'
    case 'throw':
      return 'function(_filetype) error("language resolution failed") end'
  }
}

function buildStartStub(startBehavior: TreesitterStartBehavior): string {
  switch (startBehavior) {
    case 'success':
      return `function(buf, lang)
  results.start_calls[#results.start_calls + 1] = { buf = buf, lang = lang }
end`
    case 'throw':
      return 'function(_buf, _lang) error("treesitter start failed") end'
  }
}

function buildHarnessScript(options: TreesitterHarnessOptions): string {
  const getLangStub = buildGetLangStub(options.languageResolve)
  const startStub = buildStartStub(options.startBehavior)
  const filetype = options.filetype.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  return `
results = {
  start_calls = {},
  callback_error = nil,
}

vim = {
  api = {
    nvim_create_augroup = function(_, _) return 1 end,
    nvim_create_autocmd = function(event, opts)
      if event == 'FileType' then
        filetype_callback = opts.callback
      end
    end,
  },
  bo = setmetatable({}, {
    __index = function(_, buf)
      return { filetype = "${filetype}" }
    end,
  }),
  treesitter = {
    language = {
      get_lang = ${getLangStub},
    },
    start = ${startStub},
  },
}

filetype_callback = nil

${options.setupLua}

if filetype_callback ~= nil then
  local ok, err = pcall(filetype_callback, { buf = 1 })
  if not ok then
    results.callback_error = tostring(err)
  end
end

for _, call in ipairs(results.start_calls) do
  io.write('START:' .. tostring(call.buf) .. ':' .. call.lang .. '\\n')
end
if results.callback_error ~= nil then
  io.write('CALLBACK_ERROR:' .. results.callback_error .. '\\n')
end
`
}

function parseHarnessOutput(stdout: string): TreesitterHarnessResult {
  const startCalls: Array<{ buf: number; lang: string }> = []
  let callbackThrew = false

  for (const line of stdout.split('\n')) {
    if (line.startsWith('START:')) {
      const [, buf, lang] = line.split(':')
      if (buf !== undefined && lang !== undefined) {
        startCalls.push({ buf: Number(buf), lang })
      }
      continue
    }
    if (line.startsWith('CALLBACK_ERROR:')) {
      callbackThrew = true
    }
  }

  return {
    startCalls,
    callbackThrew,
    exitCode: 0,
    stderr: '',
  }
}

async function resolveLuaRunner(): Promise<string | null> {
  for (const candidate of ['luajit', 'lua5.1']) {
    const probe = await runLuaSyntaxCommand(candidate, ['-v'], 2_000)
    if (probe.success) {
      return candidate
    }
  }
  return null
}

export async function runTreesitterSetupHarness(
  options: TreesitterHarnessOptions,
): Promise<TreesitterHarnessResult> {
  const runner = await resolveLuaRunner()
  if (runner === null) {
    throw new Error(
      'LuaJIT or lua5.1 is required to execute treesitter harness tests',
    )
  }

  const script = buildHarnessScript(options)
  const tmpDir = await mkdtemp(join(tmpdir(), 'vinela-treesitter-harness-'))
  const scriptPath = join(tmpDir, 'harness.lua')

  try {
    await writeFile(scriptPath, script, 'utf8')
    const result = await runLuaSyntaxCommand(
      runner,
      [scriptPath],
      HARNESS_TIMEOUT_MS,
    )

    if (!result.success) {
      return {
        startCalls: [],
        callbackThrew: false,
        exitCode: 1,
        stderr: result.stderr || result.detail,
      }
    }

    return {
      ...parseHarnessOutput(result.stdout),
      exitCode: 0,
      stderr: result.stderr,
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

export function extractTreesitterSetupLua(generatedLua: string): string {
  const marker = '-- nvim-treesitter'
  const start = generatedLua.indexOf(marker)
  if (start === -1) {
    throw new Error('generated Lua is missing nvim-treesitter setup block')
  }
  return generatedLua.slice(start + marker.length).trimStart()
}
