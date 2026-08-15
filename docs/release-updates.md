# Releases and automatic updates

## How it fits together

| Piece | Where |
|-------|-------|
| Frontend update service/store/toast flow | `src/features/updates/` |
| Native **Help → Check for Updates…** menu item | `src-tauri/src/lib.rs` |
| Updater endpoint + public key + `createUpdaterArtifacts` | `src-tauri/tauri.updater.json` |
| Release pipeline | `.github/workflows/release.yml` |
| Preflight validator | `scripts/validate-updater-config.ts` (`bun run updates:validate-config`) |

**`src-tauri/tauri.conf.json` stays updater-free on purpose.** `bundle.createUpdaterArtifacts` makes Tauri demand a signing key at bundle time, which would break `bun run build` for anyone without the private key. CI overlays `tauri.updater.json` via `--config` instead, and the validator fails if updater keys leak back into the base config.

The Rust side registers `tauri_plugin_updater` only when the merged config contains a `plugins.updater` key. Builds without the overlay (local dev, contributor builds) therefore have no updater plugin — and `build_app_menu` hides the **Check for Updates…** item in that case, so the menu never surfaces a "plugin not found" error. The startup check still runs but fails silently.

## One-time setup

1. **Signing keypair** — `bunx tauri signer generate -w ~/.tauri/vinela.key`. The public key goes into `src-tauri/tauri.updater.json`; the private key never enters the repo. **Always set a non-empty password**: GitHub rejects empty secret values, and a password-less key fails to sign non-interactively in CI.
2. **Repository secrets** (Settings → Secrets and variables → Actions):
   - `TAURI_SIGNING_PRIVATE_KEY` — full contents of `~/.tauri/vinela.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the key password
3. Back up the private key **and its password** somewhere durable. Losing either means every already-installed copy stops accepting updates and users must reinstall by hand.

## Cutting a release

```bash
bun run version:bump <patch|minor|major|VERSION>
bun run updates:validate-config
git commit -am "release: v0.1.23"
git tag v0.1.23
git push origin main --tags
```

The tag push runs `.github/workflows/release.yml`:

1. **quality-gate** — validator, tag/version match, lint, typecheck, full Vitest suite with LuaJIT syntax checking.
2. **release** (matrix) — macOS universal (`app` + `dmg`), Linux x86_64 (`appimage` + `deb`), Windows x86_64 (`nsis`). Each job builds with the updater overlay, signs the updater payload, and uploads to a **draft** release. `includeUpdaterJson: true` produces `latest.json`.
3. Publish the draft manually once the assets look right. The updater endpoint reads `releases/latest`, which ignores drafts, so nothing reaches users before you click Publish.

## Code signing status

macOS builds are ad-hoc signed (`APPLE_SIGNING_IDENTITY=-`) and **not notarized**; Windows builds are unsigned. Users see a Gatekeeper/SmartScreen warning on first launch — the workaround is documented in the README. Removing it needs an Apple Developer Program membership and a Windows code-signing certificate, plus the corresponding secrets wired into the release job.

## Still open before the first public release

- License/notice audit of bundled npm, Rust, generated, and static-asset dependencies. The root `NOTICE` is not that audit.
- Verify every produced installer/bundle actually contains `LICENSE` and `NOTICE` on all three platforms.
- No CI workflow runs on pull requests yet; only tag pushes are gated.
