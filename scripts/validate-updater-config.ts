const PLACEHOLDER_TOKENS = [
  '<owner>',
  '<repo>',
  '<owner>/<repo>',
  '<TAURI_UPDATER_PUBLIC_KEY>',
  'TODO_UPDATER_PUBLIC_KEY',
  'TODO_UPDATE_ENDPOINT',
] as const

const EXPECTED_ENDPOINT_SUFFIX = '/releases/latest/download/latest.json'

interface UpdaterConfig {
  endpoints?: string[] | undefined
  pubkey?: string | undefined
}

interface TauriConfig {
  bundle?: { createUpdaterArtifacts?: boolean | undefined } | undefined
  plugins?: { updater?: UpdaterConfig | undefined } | undefined
}

async function readConfig(
  relativePath: string,
): Promise<{ text: string; config: TauriConfig }> {
  const text = await Bun.file(new URL(`../${relativePath}`, import.meta.url)).text()

  for (const token of PLACEHOLDER_TOKENS) {
    if (text.includes(token)) {
      throw new Error(`${relativePath} contains blocked placeholder token: ${token}`)
    }
  }

  return { text, config: JSON.parse(text) as TauriConfig }
}

// The base config must stay updater-free so contributor builds do not require
// the signing key; the CI overlay is the only place updater config may live.
const base = await readConfig('src-tauri/tauri.conf.json')

if (base.config.plugins?.updater !== undefined) {
  throw new Error(
    'src-tauri/tauri.conf.json must not declare plugins.updater; it belongs in src-tauri/tauri.updater.json.',
  )
}

if (base.config.bundle?.createUpdaterArtifacts !== undefined) {
  throw new Error(
    'src-tauri/tauri.conf.json must not declare bundle.createUpdaterArtifacts; it belongs in src-tauri/tauri.updater.json.',
  )
}

const overlay = await readConfig('src-tauri/tauri.updater.json')
const updaterConfig = overlay.config.plugins?.updater

if (updaterConfig === undefined) {
  throw new Error('src-tauri/tauri.updater.json must declare plugins.updater.')
}

if (overlay.config.bundle?.createUpdaterArtifacts !== true) {
  throw new Error(
    'src-tauri/tauri.updater.json must set bundle.createUpdaterArtifacts to true.',
  )
}

if (typeof updaterConfig.pubkey !== 'string' || updaterConfig.pubkey.trim() === '') {
  throw new Error('Configured updater pubkey must be a non-empty string.')
}

if (updaterConfig.endpoints === undefined || updaterConfig.endpoints.length === 0) {
  throw new Error('Configured updater endpoints must contain at least one URL.')
}

for (const endpoint of updaterConfig.endpoints) {
  if (!endpoint.startsWith('https://')) {
    throw new Error(`Updater endpoint must use HTTPS: ${endpoint}`)
  }

  if (!endpoint.endsWith(EXPECTED_ENDPOINT_SUFFIX)) {
    throw new Error(
      `Updater endpoint must target the latest GitHub Releases manifest path: ${endpoint}`,
    )
  }
}

console.info('Updater config validation passed.')
