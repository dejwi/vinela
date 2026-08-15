import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function writeTextFileAtomic(
  filePath: string,
  content: string,
): Promise<void> {
  await ensureDirectory(path.dirname(filePath))
  const tempPath = `${filePath}.tmp`
  await fs.writeFile(tempPath, content, 'utf8')
  await fs.rename(tempPath, filePath)
}

export async function writeJsonFileAtomic<T>(
  filePath: string,
  value: T,
): Promise<void> {
  await writeTextFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export async function copyFileIfPresent(
  sourcePath: string | undefined,
  targetPath: string,
): Promise<void> {
  if (sourcePath === undefined) {
    return
  }

  try {
    await ensureDirectory(path.dirname(targetPath))
    await fs.copyFile(sourcePath, targetPath)
  } catch (error) {
    if (isMissingFileError(error)) {
      return
    }
    throw error
  }
}

export async function copyLatestReportFiles(
  latestDir: string,
  fileMappings: readonly { sourcePath: string; fileName: string }[],
): Promise<void> {
  await fs.rm(latestDir, { recursive: true, force: true })
  await ensureDirectory(latestDir)

  for (const fileMapping of fileMappings) {
    await fs.copyFile(fileMapping.sourcePath, path.join(latestDir, fileMapping.fileName))
  }
}

export async function pruneRunDirectories(
  runsParentDir: string,
  keepRuns: number,
): Promise<void> {
  if (keepRuns <= 0) {
    return
  }

  let entries: Dirent[]
  try {
    entries = await fs.readdir(runsParentDir, { withFileTypes: true })
  } catch (error) {
    if (isMissingFileError(error)) {
      return
    }
    throw error
  }

  const directoriesWithStats = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const absolutePath = path.join(runsParentDir, entry.name)
        const stats = await fs.stat(absolutePath)
        return {
          absolutePath,
          modifiedTimeMs: stats.mtimeMs,
        }
      }),
  )

  directoriesWithStats.sort((left, right) => right.modifiedTimeMs - left.modifiedTimeMs)

  for (const directory of directoriesWithStats.slice(keepRuns)) {
    await fs.rm(directory.absolutePath, { recursive: true, force: true })
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === 'ENOENT'
  )
}
