# Automatic updates release notes

This repository includes a frontend/native scaffold for automatic updates. The **public** updater path remains blocked until the approved release identity inputs are available.

## Still gated before public enablement

- Final GitHub `owner/repo`
- Final Tauri updater public key committed for public builds
- Confirmation that the matching private key is stored in CI secrets
- Final first-release identity tuple (`productName`, bundle identifier, endpoint, key)

Do **not** commit placeholder updater endpoints or placeholder public keys to `src-tauri/tauri.conf.json`.

## Safe scaffold now in repo

- Frontend update service/store/notification flow under `src/features/updates/`
- Native **Check for Updates…** menu event wiring
- Shared Tauri runtime detection helper
- `scripts/validate-updater-config.ts` placeholder/preflight validator
- Rust updater plugin initialization and `updater:default` permission for packaged builds

## Still intentionally not enabled for public releases

- Committed `plugins.updater.pubkey` / `plugins.updater.endpoints` in `src-tauri/tauri.conf.json`
- Committed `bundle.createUpdaterArtifacts` in `src-tauri/tauri.conf.json`
- Public GitHub release workflow

---

### Public licensing preflight

1. `LICENSE` must match the pinned AGPL digest `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0`.
2. `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` must all declare `AGPL-3.0-only` and `https://github.com/dejwi/vinela`.
3. Every public installer/application bundle must contain `LICENSE` and `NOTICE`; inspect each produced macOS, Linux, and Windows artifact before publication.
4. The release is blocked until a separate audit covers the licenses/notices of bundled npm, Rust, generated, and static-asset dependencies. Do not represent root `NOTICE` as that audit.
5. Before publication, create/verify `https://github.com/dejwi/vinela`, then update the local remote with `git remote set-url origin git@github.com:dejwi/vinela.git`; `.git/config` is local state and is not part of this diff.

## Preflight validator

Run:

```bash
bun run updates:validate-config
```

Behavior:

- Fails if blocked placeholder tokens appear in `src-tauri/tauri.conf.json`
- Passes when updater config is still absent
- Once public updater config exists, also requires non-empty committed public key, HTTPS endpoint, and `/releases/latest/download/latest.json` path
