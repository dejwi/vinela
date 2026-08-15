// LuaBuilder: Fluent API for generating Lua source code

/**
 * Error types for LuaBuilder operations.
 */
export type LuaBuilderErrorCode = 'INVALID_INDENT_LEVEL' | 'UNCLOSED_BLOCK'

/**
 * Error thrown by LuaBuilder for invariant violations.
 */
export class LuaBuilderError extends Error {
  public readonly code: LuaBuilderErrorCode

  constructor(code: LuaBuilderErrorCode, message: string) {
    super(message)
    this.name = 'LuaBuilderError'
    this.code = code
  }
}

/**
 * Options for configuring LuaBuilder behavior.
 */
export interface LuaBuilderOptions {
  /** The string to use for each indent level (default: '  ') */
  indentUnit?: string
  /** Line ending to use (default: '\n') */
  newline?: '\n' | '\r\n'
  /** Whether to ensure output ends with a newline (default: true) */
  ensureTrailingNewline?: boolean
  /** Whether to enforce indent balance on build() (default: true) */
  strictIndentBalance?: boolean
}

/**
 * Fluent API for building Lua source code.
 *
 * Provides methods for:
 * - Adding lines with automatic indentation
 * - Managing indent levels (indent/dedent)
 * - Creating blocks (start/indent/body/dedent/end)
 * - Adding comments and blank lines
 * - Building the final source string
 *
 * Example:
 * ```typescript
 * const b = new LuaBuilder()
 * b.block('do', (inner) => {
 *   inner.line('vim.opt.number = true')
 *   inner.block('if condition then', (ifBody) => {
 *     ifBody.line('print("yes")')
 *   }, 'end')
 * }, 'end')
 * const lua = b.build()
 * ```
 */
export class LuaBuilder {
  private readonly buffer: string[]
  private indentLevel: number
  private readonly indentUnit: string
  private readonly newline: '\n' | '\r\n'
  private readonly ensureTrailingNewline: boolean
  private readonly strictIndentBalance: boolean
  private readonly indentCache: Map<number, string>

  constructor(options: LuaBuilderOptions = {}) {
    this.buffer = []
    this.indentLevel = 0
    this.indentUnit = options.indentUnit ?? '  '
    this.newline = options.newline ?? '\n'
    this.ensureTrailingNewline = options.ensureTrailingNewline ?? true
    this.strictIndentBalance = options.strictIndentBalance ?? true
    this.indentCache = new Map<number, string>()
  }

  /**
   * Get the current indent prefix, computing and caching if needed.
   */
  private getIndentPrefix(): string {
    let prefix = this.indentCache.get(this.indentLevel)
    if (prefix === undefined) {
      prefix = this.indentUnit.repeat(this.indentLevel)
      this.indentCache.set(this.indentLevel, prefix)
    }
    return prefix
  }

  /**
   * Increase the indent level by 1.
   *
   * @returns this builder for chaining
   */
  indent(): LuaBuilder {
    this.indentLevel++
    return this
  }

  /**
   * Decrease the indent level by 1.
   *
   * @returns this builder for chaining
   * @throws LuaBuilderError if indent level would become negative
   */
  dedent(): LuaBuilder {
    if (this.indentLevel <= 0) {
      throw new LuaBuilderError(
        'INVALID_INDENT_LEVEL',
        'Cannot dedent: indent level is already 0',
      )
    }
    this.indentLevel--
    return this
  }

  /**
   * Add one or more lines of code.
   *
   * - Empty string emits an indented empty line
   * - Multi-line input is split on line breaks; each line is emitted with current indent prefix
   * - Existing leading whitespace inside each split line is preserved (relative indentation)
   *
   * @param code - The code line(s) to add
   * @returns this builder for chaining
   */
  line(code: string): LuaBuilder {
    if (code.length === 0) {
      // Empty line
      this.buffer.push('')
      return this
    }

    const codeLines = code.split(/\r?\n/)
    const prefix = this.getIndentPrefix()

    for (const codeLine of codeLines) {
      // Empty lines in multi-line input should not get indent prefix
      if (codeLine.length === 0) {
        this.buffer.push('')
      } else {
        // Preserve existing whitespace in the line (relative indentation)
        this.buffer.push(prefix + codeLine)
      }
    }

    return this
  }

  /**
   * Add multiple lines of code (variadic version of line()).
   *
   * @param codes - The code lines to add
   * @returns this builder for chaining
   */
  lines(...codes: string[]): LuaBuilder {
    for (const code of codes) {
      this.line(code)
    }
    return this
  }

  /**
   * Create a block: emit start, indent, execute callback, dedent, emit end.
   *
   * The callback receives this builder (now indented) for adding block contents.
   * Indentation is properly balanced even if the callback throws.
   *
   * @param start - The opening line (e.g., 'do', 'if condition then')
   * @param build - Callback to build the block contents
   * @param end - The closing line (e.g., 'end')
   * @returns this builder for chaining
   */
  block(
    start: string,
    build: (builder: LuaBuilder) => void,
    end: string,
  ): LuaBuilder {
    this.line(start)
    this.indent()

    try {
      build(this)
    } finally {
      this.dedent()
      this.line(end)
    }

    return this
  }

  /**
   * Add a blank (empty) line.
   *
   * @returns this builder for chaining
   */
  blank(): LuaBuilder {
    this.buffer.push('')
    return this
  }

  /**
   * Add a Lua comment.
   *
   * Multi-line input is split and each line gets its own '-- ' prefix.
   * Empty lines in multi-line input emit '--' (comment with no text).
   *
   * @param text - The comment text
   * @returns this builder for chaining
   */
  comment(text: string): LuaBuilder {
    if (text.length === 0) {
      this.buffer.push(`${this.getIndentPrefix()}--`)
      return this
    }

    const commentLines = text.split(/\r?\n/)
    const prefix = this.getIndentPrefix()

    for (const commentLine of commentLines) {
      if (commentLine.length === 0) {
        this.buffer.push(`${prefix}--`)
      } else {
        this.buffer.push(`${prefix}-- ${commentLine}`)
      }
    }

    return this
  }

  /**
   * Get the current indent level (for testing purposes).
   */
  getIndentLevel(): number {
    return this.indentLevel
  }

  /**
   * Build the final Lua source string.
   *
   * Joins all lines with the configured newline. If strictIndentBalance is enabled,
   * throws if the indent level is not back to 0 (unclosed blocks).
   *
   * @returns The complete Lua source code
   * @throws LuaBuilderError if strictIndentBalance is true and indent level != 0
   */
  build(): string {
    if (this.strictIndentBalance && this.indentLevel !== 0) {
      throw new LuaBuilderError(
        'UNCLOSED_BLOCK',
        `UNCLOSED_BLOCK: Build called with unclosed block: indent level is ${this.indentLevel} (expected 0)`,
      )
    }

    let result = this.buffer.join(this.newline)

    if (this.ensureTrailingNewline && !result.endsWith(this.newline)) {
      result += this.newline
    }

    return result
  }
}
