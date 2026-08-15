declare module 'bun' {
  export class Glob {
    public constructor(pattern: string)
    public scan(root: string): AsyncIterable<string>
  }

  export interface BunPlugin {
    readonly name: string
    setup(build: {
      onResolve(
        args: { filter: RegExp },
        callback: (args: { path: string }) => { path: string } | undefined,
      ): void
    }): void
  }

  export interface BunBuildLog {
    readonly message?: string
  }

  export interface BunBuildArtifact {
    text(): Promise<string>
  }

  export interface BunMetafileImportRecord {
    readonly path: string
    readonly kind?: string
    readonly external?: boolean
  }

  export interface BunMetafileInputRecord {
    readonly bytes: number
    readonly imports?: readonly BunMetafileImportRecord[]
    readonly format?: string
  }

  export interface BunMetafileOutputInputRecord {
    readonly bytesInOutput: number
  }

  export interface BunMetafileOutputRecord {
    readonly bytes: number
    readonly inputs: Readonly<Record<string, BunMetafileOutputInputRecord>>
    readonly imports?: readonly BunMetafileImportRecord[]
  }

  export interface BunMetafile {
    readonly inputs: Readonly<Record<string, BunMetafileInputRecord>>
    readonly outputs: Readonly<Record<string, BunMetafileOutputRecord>>
  }

  export interface BunBuildConfig {
    readonly entrypoints: readonly string[]
    readonly target?: 'node' | 'browser' | 'bun'
    readonly format?: 'esm' | 'cjs' | 'iife'
    readonly packages?: 'bundle' | 'external'
    readonly splitting?: boolean
    readonly minify?: boolean
    readonly sourcemap?: 'none' | 'linked' | 'inline' | 'external'
    readonly metafile?: boolean
    readonly outdir?: string
    readonly root?: string
    readonly tsconfig?: string
    readonly plugins?: readonly BunPlugin[]
  }

  export interface BunBuildResult {
    readonly success: boolean
    readonly outputs: readonly BunBuildArtifact[]
    readonly logs: readonly BunBuildLog[]
    readonly metafile?: BunMetafile
  }
}

declare const Bun: {
  file(path: string | URL): {
    text(): Promise<string>
  }
  write(path: string | URL, data: string): Promise<number>
  build(config: import('bun').BunBuildConfig): Promise<import('bun').BunBuildResult>
}
