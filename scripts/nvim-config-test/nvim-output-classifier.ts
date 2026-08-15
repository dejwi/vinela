import type {
  ClassifyNvimOutputInput,
  NvimFailureKind,
  NvimOutputClassification,
} from './cli-types'

const NETWORK_ERROR_PATTERN =
  /(failed to clone|clone failed|checkout failed|could not resolve host|unable to access|connection timed out|fatal:|repository .* not found|tls|dns|network is unreachable)/i

const MODULE_NOT_FOUND_PATTERN = /module\s+'.+'\s+not found/
const NVIM_ERROR_PATTERN = /\bE\d+:/
const STACK_TRACE_PATTERN = /stack traceback:/
const LUA_LOAD_ERROR_PATTERN = /(error loading|unexpected symbol|syntax error|\[string .+\]:\d+:)/i
const STARTUP_RUNTIME_PATTERN = /(E5113:\s+Lua chunk|Error in .*init\.lua|Unknown registry type:|Unexpected field in configuration)/i

export function classifyNvimOutput(
  input: ClassifyNvimOutputInput,
): NvimOutputClassification {
  switch (input.versionCheck.status) {
    case 'missing':
      return failure(
        'missing-nvim',
        input.versionCheck.errorSummary,
        input.versionCheck.errorSummary,
      )
    case 'unsupported':
      return failure(
        'unsupported-nvim-version',
        input.versionCheck.errorSummary,
        input.versionCheck.errorSummary,
      )
    case 'available':
      break
  }

  if (input.timedOut) {
    return failure('timeout', 'Neovim validation timed out', combinedExcerpt(input))
  }

  const combinedText = collectCombinedText(input)

  if (input.mode === 'syntax' && LUA_LOAD_ERROR_PATTERN.test(combinedText)) {
    return failure('syntax-error', 'Generated Lua failed syntax validation', combinedText)
  }

  if (MODULE_NOT_FOUND_PATTERN.test(combinedText)) {
    return failure('module-not-found', 'Neovim reported a missing Lua module', combinedText)
  }

  if (NETWORK_ERROR_PATTERN.test(combinedText)) {
    return failure('plugin-network-error', 'Plugin install or network error detected', combinedText)
  }

  if (
    STARTUP_RUNTIME_PATTERN.test(combinedText) ||
    LUA_LOAD_ERROR_PATTERN.test(combinedText) ||
    STACK_TRACE_PATTERN.test(combinedText) ||
    NVIM_ERROR_PATTERN.test(combinedText)
  ) {
    return failure(
      input.mode === 'syntax' ? 'syntax-error' : 'startup-error',
      input.mode === 'syntax'
        ? 'Generated Lua failed syntax validation'
        : 'Neovim reported a runtime startup error',
      combinedText,
    )
  }

  if (input.mode !== 'syntax') {
    if (input.nvimReport === null) {
      return failure(
        'report-error',
        'Neovim finalizer report was not written',
        combinedExcerpt(input),
      )
    }

    if (input.nvimReport.finalizerError !== undefined) {
      return failure(
        'report-error',
        'Neovim finalizer reported an error',
        input.nvimReport.finalizerError,
      )
    }
  }

  if (input.exitCode !== 0) {
    return failure(
      'process-exit',
      `Neovim exited with status ${input.exitCode}`,
      combinedText,
    )
  }

  if (
    input.nvimReport !== null &&
    input.nvimReport.vErrmsg.trim().length > 0
  ) {
    return failure(
      'startup-error',
      'Neovim reported a non-empty v:errmsg',
      input.nvimReport.vErrmsg,
    )
  }

  const warnings = collectWarnings(input)
  return {
    success: true,
    warnings,
  }
}

function collectCombinedText(input: ClassifyNvimOutputInput): string {
  const segments: string[] = [input.stdout, input.stderr]

  if (input.nvimReport !== null) {
    segments.push(input.nvimReport.messages)
    segments.push(input.nvimReport.vErrmsg)
    if (input.nvimReport.finalizerError !== undefined) {
      segments.push(input.nvimReport.finalizerError)
    }
  }

  return segments.join('\n').trim()
}

function combinedExcerpt(input: ClassifyNvimOutputInput): string {
  const excerpt = collectCombinedText(input)
  return excerpt.length > 0 ? excerpt : 'No stdout/stderr output captured'
}

function collectWarnings(input: ClassifyNvimOutputInput): readonly string[] {
  const warnings: string[] = []
  const stderr = input.stderr.trim()
  if (stderr.length > 0) {
    warnings.push(stderr)
  }

  if (input.nvimReport !== null) {
    const messages = input.nvimReport.messages.trim()
    if (messages.length > 0 && NVIM_ERROR_PATTERN.test(messages) === false) {
      warnings.push(messages)
    }
  }

  return warnings
}

function failure(
  failureKind: NvimFailureKind,
  errorSummary: string,
  errorExcerpt: string,
): NvimOutputClassification {
  return {
    success: false,
    failureKind,
    errorSummary,
    errorExcerpt: errorExcerpt.trim().slice(0, 4000),
  }
}
