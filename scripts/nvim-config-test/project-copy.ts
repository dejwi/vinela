import fs from 'node:fs/promises'
import path from 'node:path'

const SKIPPED_DIRECTORY_NAMES = new Set<string>(['.git', 'node_modules', 'temp'])

export async function copyProjectToScratch(
  sourceProjectPath: string,
  destinationProjectPath: string,
): Promise<void> {
  const resolvedSourceProjectPath = path.resolve(sourceProjectPath)
  const resolvedDestinationProjectPath = path.resolve(destinationProjectPath)

  assertDestinationOutsideSource(resolvedSourceProjectPath, resolvedDestinationProjectPath)

  await fs.rm(resolvedDestinationProjectPath, { recursive: true, force: true })
  await copyDirectoryRecursive(resolvedSourceProjectPath, resolvedDestinationProjectPath)
}

function assertDestinationOutsideSource(sourceProjectPath: string, destinationProjectPath: string): void {
  const relativePath = path.relative(sourceProjectPath, destinationProjectPath)
  const isSamePath = relativePath.length === 0
  const isInsideSource =
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)

  if (isSamePath || isInsideSource) {
    throw new Error(
      'Custom --out-dir / project copy destination must be outside the source project',
    )
  }
}

async function copyDirectoryRecursive(
  sourceDir: string,
  destinationDir: string,
): Promise<void> {
  await fs.mkdir(destinationDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory() && SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
      continue
    }

    const sourcePath = path.join(sourceDir, entry.name)
    const destinationPath = path.join(destinationDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, destinationPath)
      continue
    }

    if (entry.isFile()) {
      await fs.copyFile(sourcePath, destinationPath)
    }
  }
}
