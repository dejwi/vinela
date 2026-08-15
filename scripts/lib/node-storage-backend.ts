import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { DirEntry, StorageBackend } from '@/shared/lib/storage-backend'
import type { ProjectWriteEvent, ProjectWriteMode } from '../nvim-config-test/cli-types'

export interface NodeStorageBackendOptions {
  appDataRoot: string
  sourceProjectRoot: string
  activeProjectRoot: string
  projectWriteMode: ProjectWriteMode
  optionalProjectDirs?: readonly string[]
}

type ProjectTargetKind = 'project-copy' | 'source-project'

export class NodeStorageBackend implements StorageBackend {
  private readonly appDataRoot: string
  private readonly sourceProjectRoot: string
  private readonly activeProjectRoot: string
  private readonly projectWriteMode: ProjectWriteMode
  private readonly optionalProjectDirs: ReadonlySet<string>
  private readonly projectWriteEvents: ProjectWriteEvent[] = []

  public constructor(options: NodeStorageBackendOptions) {
    this.appDataRoot = path.resolve(options.appDataRoot)
    this.sourceProjectRoot = path.resolve(options.sourceProjectRoot)
    this.activeProjectRoot = path.resolve(options.activeProjectRoot)
    this.projectWriteMode = options.projectWriteMode
    this.optionalProjectDirs = new Set(options.optionalProjectDirs ?? ['graphs', 'schemas'])
  }

  public getProjectWriteEvents(): readonly ProjectWriteEvent[] {
    return [...this.projectWriteEvents]
  }

  public hasDeniedProjectWrites(): boolean {
    return this.projectWriteEvents.some((event) => !event.allowed)
  }

  public async readAppFile<T>(relativePath: string): Promise<T> {
    const text = await fs.readFile(this.resolveWithinRoot(this.appDataRoot, relativePath), 'utf8')
    return JSON.parse(text) as T
  }

  public async writeAppFile<T>(relativePath: string, data: T): Promise<void> {
    const targetPath = this.resolveWithinRoot(this.appDataRoot, relativePath)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }

  public async ensureAppDir(relativePath: string): Promise<void> {
    await fs.mkdir(this.resolveWithinRoot(this.appDataRoot, relativePath), { recursive: true })
  }

  public async listAppDir(relativePath: string): Promise<DirEntry[]> {
    return this.readDirEntries(this.resolveWithinRoot(this.appDataRoot, relativePath))
  }

  public async removeAppFile(relativePath: string): Promise<void> {
    await fs.rm(this.resolveWithinRoot(this.appDataRoot, relativePath), {
      recursive: true,
      force: true,
    })
  }

  public async appFileExists(relativePath: string): Promise<boolean> {
    return this.pathExists(this.resolveWithinRoot(this.appDataRoot, relativePath))
  }

  public async readAppTextFile(relativePath: string): Promise<string> {
    return fs.readFile(this.resolveWithinRoot(this.appDataRoot, relativePath), 'utf8')
  }

  public async writeAppTextFile(relativePath: string, content: string): Promise<void> {
    const targetPath = this.resolveWithinRoot(this.appDataRoot, relativePath)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, content, 'utf8')
  }

  public async readProjectFile<T>(projectPath: string, relativePath: string): Promise<T> {
    const text = await fs.readFile(this.resolveProjectPath(projectPath, relativePath), 'utf8')
    return JSON.parse(text) as T
  }

  public async writeProjectFile<T>(
    projectPath: string,
    relativePath: string,
    data: T,
  ): Promise<void> {
    const targetPath = this.resolveProjectPath(projectPath, relativePath)
    await this.assertProjectWriteAllowed(projectPath, 'write-json', relativePath)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  }

  public async ensureProjectDir(projectPath: string, relativePath: string): Promise<void> {
    const targetPath = this.resolveProjectPath(projectPath, relativePath)
    if (await this.pathExists(targetPath)) {
      return
    }

    if (this.projectWriteMode === 'deny' && this.optionalProjectDirs.has(relativePath)) {
      return
    }

    await this.assertProjectWriteAllowed(projectPath, 'ensure-dir', relativePath)
    await fs.mkdir(targetPath, { recursive: true })
  }

  public async listProjectDir(projectPath: string, relativePath: string): Promise<DirEntry[]> {
    const targetPath = this.resolveProjectPath(projectPath, relativePath)

    if (!(await this.pathExists(targetPath))) {
      if (this.optionalProjectDirs.has(relativePath)) {
        return []
      }
    }

    return this.readDirEntries(targetPath)
  }

  public async removeProjectFile(projectPath: string, relativePath: string): Promise<void> {
    await this.assertProjectWriteAllowed(projectPath, 'remove', relativePath)
    await fs.rm(this.resolveProjectPath(projectPath, relativePath), {
      recursive: true,
      force: true,
    })
  }

  public async projectFileExists(projectPath: string, relativePath: string): Promise<boolean> {
    return this.pathExists(this.resolveProjectPath(projectPath, relativePath))
  }

  public async isValidProject(folderPath: string): Promise<boolean> {
    const projectJsonPath = this.resolveProjectPath(
      path.resolve(folderPath),
      'project.json',
    )
    return this.pathExists(projectJsonPath)
  }

  public async folderExists(folderPath: string): Promise<boolean> {
    return this.pathExists(path.resolve(folderPath))
  }

  public async listFolder(folderPath: string): Promise<DirEntry[]> {
    return this.readDirEntries(path.resolve(folderPath))
  }

  public async readProjectTextFile(projectPath: string, relativePath: string): Promise<string> {
    return fs.readFile(this.resolveProjectPath(projectPath, relativePath), 'utf8')
  }

  public async writeProjectTextFile(
    projectPath: string,
    relativePath: string,
    content: string,
  ): Promise<void> {
    const targetPath = this.resolveProjectPath(projectPath, relativePath)
    await this.assertProjectWriteAllowed(projectPath, 'write-text', relativePath)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, content, 'utf8')
  }

  public async getAppDataPath(): Promise<string> {
    return this.appDataRoot
  }

  public isDevMode(): boolean {
    return false
  }

  public getDevDataPath(): string | undefined {
    return undefined
  }

  public async getDevProjectPath(): Promise<string | undefined> {
    return undefined
  }

  public async readAbsoluteFile(absolutePath: string): Promise<string> {
    return fs.readFile(path.resolve(absolutePath), 'utf8')
  }

  public async joinPath(...segments: string[]): Promise<string> {
    return path.join(...segments)
  }

  private resolveProjectPath(projectPath: string, relativePath: string): string {
    const normalizedProjectRoot = this.resolveProjectRoot(projectPath)
    return this.resolveWithinRoot(normalizedProjectRoot, relativePath)
  }

  private resolveProjectRoot(projectPath: string): string {
    const normalizedProjectPath = path.resolve(projectPath)
    if (normalizedProjectPath === this.activeProjectRoot) {
      return this.activeProjectRoot
    }

    if (normalizedProjectPath === this.sourceProjectRoot) {
      return this.sourceProjectRoot
    }

    throw new Error(`Unsupported project root: ${projectPath}`)
  }

  private resolveWithinRoot(rootPath: string, relativePath: string): string {
    const resolvedPath = path.resolve(rootPath, relativePath)
    const relativeToRoot = path.relative(rootPath, resolvedPath)

    if (
      relativeToRoot === '..' ||
      relativeToRoot.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeToRoot)
    ) {
      throw new Error(`Path escapes root: ${relativePath}`)
    }

    return resolvedPath
  }

  private async readDirEntries(directoryPath: string): Promise<DirEntry[]> {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
      isSymlink: entry.isSymbolicLink(),
    }))
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath)
      return true
    } catch {
      return false
    }
  }

  private async assertProjectWriteAllowed(
    projectPath: string,
    operation: ProjectWriteEvent['operation'],
    relativePath: string,
  ): Promise<void> {
    const targetKind = this.getProjectTargetKind(projectPath)
    const reason = this.getWriteReason(operation, relativePath)
    const allowed =
      this.projectWriteMode === 'allow-source' ||
      (this.projectWriteMode === 'allow-copy' && targetKind === 'project-copy')

    if (!allowed) {
      this.projectWriteEvents.push({
        operation,
        relativePath,
        targetKind,
        allowed: false,
        reason,
      })
      throw new Error(`Project write denied for ${operation} at ${relativePath}`)
    }

    this.projectWriteEvents.push({
      operation,
      relativePath,
      targetKind,
      allowed: true,
      reason,
    })
  }

  private getProjectTargetKind(projectPath: string): ProjectTargetKind {
    return path.resolve(projectPath) === this.sourceProjectRoot
      ? 'source-project'
      : 'project-copy'
  }

  private getWriteReason(
    operation: ProjectWriteEvent['operation'],
    relativePath: string,
  ): ProjectWriteEvent['reason'] {
    if (operation === 'ensure-dir' && this.optionalProjectDirs.has(relativePath)) {
      return 'optional-dir'
    }

    if (relativePath === 'plugins.json') {
      return 'migration'
    }

    if (operation === 'write-json' || operation === 'write-text' || operation === 'remove') {
      return 'explicit-write'
    }

    return 'unknown'
  }
}

export function createDefaultNodeStorageBackendOptions(
  sourceProjectRoot: string,
  activeProjectRoot: string,
  projectWriteMode: ProjectWriteMode,
): NodeStorageBackendOptions {
  return {
    appDataRoot: path.join(os.tmpdir(), 'vinela-app-data'),
    sourceProjectRoot,
    activeProjectRoot,
    projectWriteMode,
  }
}
