const PLACEHOLDER_TOKENS = [
  '<owner>',
  '<repo>',
  '<owner>/<repo>',
  '<TAURI_UPDATER_PUBLIC_KEY>',
  'TODO_UPDATER_PUBLIC_KEY',
  'TODO_UPDATE_ENDPOINT',
] as const

interface UpdaterConfig {
  endpoints?: string[] | undefined
  pubkey?: string | undefined
}

interface TauriConfig {
  plugins?: {
    updater?: UpdaterConfig | undefined
  }
}

const tauriConfigPath = new URL('../src-tauri/tauri.conf.json', import.meta.url)
const configText = await Bun.file(tauriConfigPath).text()

for (const token of PLACEHOLDER_TOKENS) {
  if (configText.includes(token)) {
    throw new Error(`Updater config contains blocked placeholder token: ${token}`)
  }
}

const tauriConfig = JSON.parse(configText) as TauriConfig
const updaterConfig = tauriConfig.plugins?.updater

if (updaterConfig === undefined) {
  console.info('Updater config is not enabled yet; placeholder validation passed.')
  process.exit(0)
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

  if (!endpoint.endsWith('/releases/latest/download/latest.json')) {
    throw new Error(
      `Updater endpoint must target the latest GitHub Releases manifest path: ${endpoint}`,
    )
  }
}

console.info('Updater config validation passed.')
