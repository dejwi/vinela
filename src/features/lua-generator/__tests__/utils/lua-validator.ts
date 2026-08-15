/**
 * Lua Validator Utility
 *
 * Validates Lua syntax using luac -p or Neovim headless mode.
 * Returns structured result with error details.
 */

export interface LuaValidationResult {
  valid: boolean
  engine: 'luac' | 'nvim' | 'none'
  error?: string | undefined
  line?: number | undefined
}

export interface ToolProbeResult {
  hasLuac: boolean
  hasNeovim: boolean
  reasonIfMissing: string[]
}

let cachedProbe: ToolProbeResult | null = null

/**
 * Probe for available Lua validation tools.
 * Caches result for subsequent calls.
 */
export async function probeLuaValidationTools(): Promise<ToolProbeResult> {
  if (cachedProbe !== null) {
    return cachedProbe
  }

  const result: ToolProbeResult = {
    hasLuac: false,
    hasNeovim: false,
    reasonIfMissing: [],
  }

  try {
    // Check for luac
    const luacProcess = await import('@tauri-apps/plugin-shell').then((m) =>
      m.Command.create('luac', ['-v']),
    )
    const luacResult = await luacProcess.execute()
    result.hasLuac = luacResult.code === 0
  } catch {
    result.reasonIfMissing.push('luac not found in PATH')
  }

  try {
    // Check for nvim
    const nvimProcess = await import('@tauri-apps/plugin-shell').then((m) =>
      m.Command.create('nvim', ['--version']),
    )
    const nvimResult = await nvimProcess.execute()
    result.hasNeovim = nvimResult.code === 0
  } catch {
    result.reasonIfMissing.push('nvim not found in PATH')
  }

  cachedProbe = result
  return result
}

/**
 * Clear the cached tool probe result.
 * Useful for testing or when environment changes.
 */
export function clearToolProbeCache(): void {
  cachedProbe = null
}

/**
 * Validate Lua syntax using available tools.
 * Prefers luac -p, falls back to nvim --headless.
 * Never throws - returns structured result.
 */
export async function validateLuaSyntax(
  code: string,
): Promise<LuaValidationResult> {
  const tools = await probeLuaValidationTools()

  if (tools.hasLuac) {
    return validateWithLuac(code)
  }

  if (tools.hasNeovim) {
    return validateWithNvim(code)
  }

  return {
    valid: false,
    engine: 'none',
    error: 'No Lua validation tools available (luac or nvim required)',
  }
}

async function validateWithLuac(code: string): Promise<LuaValidationResult> {
  try {
    const { Command } = await import('@tauri-apps/plugin-shell')

    // Write code to temp file and validate
    const tempPath = `/tmp/lua-validation-${Date.now()}.lua`
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(tempPath, code)

    const process = await Command.create('luac', ['-p', tempPath]).execute()

    // Clean up
    try {
      const { remove } = await import('@tauri-apps/plugin-fs')
      await remove(tempPath)
    } catch {
      // Ignore cleanup errors
    }

    if (process.code === 0) {
      return { valid: true, engine: 'luac' }
    }

    // Parse error from stderr
    const errorMatch = /:(\d+):\s*(.+)/.exec(process.stderr)
    if (errorMatch?.[1] && errorMatch[2]) {
      return {
        valid: false,
        engine: 'luac',
        line: Number.parseInt(errorMatch[1], 10),
        error: errorMatch[2],
      }
    }

    return {
      valid: false,
      engine: 'luac',
      error: process.stderr || 'Unknown syntax error',
    }
  } catch (error) {
    return {
      valid: false,
      engine: 'luac',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function validateWithNvim(code: string): Promise<LuaValidationResult> {
  try {
    const { Command } = await import('@tauri-apps/plugin-shell')

    // Use nvim to compile-check the code
    const tempPath = `/tmp/lua-validation-${Date.now()}.lua`
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(tempPath, code)

    const process = await Command.create('nvim', [
      '--headless',
      '-u',
      'NONE',
      '-c',
      `lua local ok, err = pcall(loadfile('${tempPath}')); if not ok then print('ERROR:' .. err) end`,
      '-c',
      'qa!',
    ]).execute()

    // Clean up
    try {
      const { remove } = await import('@tauri-apps/plugin-fs')
      await remove(tempPath)
    } catch {
      // Ignore cleanup errors
    }

    if (process.stdout?.includes('ERROR:')) {
      const errorMatch = /:(\d+):\s*(.+)/.exec(process.stdout ?? '')
      const line = errorMatch?.[1]
        ? Number.parseInt(errorMatch[1], 10)
        : undefined
      return {
        valid: false,
        engine: 'nvim',
        error: (process.stdout ?? '').replace('ERROR:', '').trim(),
        ...(line !== undefined && { line }),
      }
    }

    if (process.code === 0) {
      return { valid: true, engine: 'nvim' }
    }

    return {
      valid: false,
      engine: 'nvim',
      error: process.stderr || 'Unknown validation error',
    }
  } catch (error) {
    return {
      valid: false,
      engine: 'nvim',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
