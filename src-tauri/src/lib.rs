use std::collections::HashSet;
use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};
#[cfg(all(desktop, not(target_os = "windows")))]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, HELP_SUBMENU_ID};
use tauri::Emitter;
use tauri_plugin_fs::FsExt;

const CHECK_FOR_UPDATES_EVENT: &str = "app://check-for-updates";
const CHECK_FOR_UPDATES_MENU_ID: &str = "check_for_updates";

/// Build the app menu. `updater_enabled` gates the "Check for Updates…" item:
/// builds without committed updater config never register the updater plugin,
/// so the menu entry would only ever surface a "plugin not found" error.
#[cfg(all(desktop, not(target_os = "windows")))]
fn build_app_menu<R: tauri::Runtime>(
    app: &tauri::App<R>,
    updater_enabled: bool,
) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app.handle())?;

    if !updater_enabled {
        return Ok(menu);
    }

    let Some(help_submenu) = menu
        .get(HELP_SUBMENU_ID)
        .and_then(|item| item.as_submenu().cloned())
    else {
        return Ok(menu);
    };

    let separator = PredefinedMenuItem::separator(app.handle())?;
    let check_for_updates = MenuItem::with_id(
        app.handle(),
        CHECK_FOR_UPDATES_MENU_ID,
        "Check for Updates…",
        true,
        None::<&str>,
    )?;

    help_submenu.append_items(&[&separator, &check_for_updates])?;

    #[cfg(target_os = "macos")]
    {
        help_submenu.set_as_help_menu_for_nsapp()?;
    }

    Ok(menu)
}

// ============================================================
// Shared security helpers
// ============================================================

/// Resolve the user home directory as a PathBuf.
fn home_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Cannot determine home directory".to_string())?;
    Ok(PathBuf::from(home))
}

/// Return true if `path` contains any `..` component.
///
/// This is a defence-in-depth check: `..` in a received path is always
/// suspicious and must be rejected regardless of what the OS would do with it.
fn has_dotdot(path: &PathBuf) -> bool {
    path.components()
        .any(|c| c == std::path::Component::ParentDir)
}

/// Return the canonical path of `target`, or — if `target` doesn't exist yet —
/// the canonical path of its nearest existing ancestor.
///
/// This lets us validate the home-boundary even for paths that will be created
/// in the future, while still catching symlink escapes in the parts of the path
/// that do exist.
fn canonical_ancestor(target: &PathBuf) -> PathBuf {
    // Try to canonicalize the full path first (works when path already exists).
    if let Ok(c) = std::fs::canonicalize(target) {
        return c;
    }

    // Walk up the tree until we find a component that exists.
    let mut candidate = target.clone();
    loop {
        match candidate.parent() {
            None => return target.clone(), // at filesystem root — return raw as last resort
            Some(parent) => {
                candidate = parent.to_path_buf();
                if let Ok(c) = std::fs::canonicalize(&candidate) {
                    return c;
                }
            }
        }
    }
}

/// Validate that `target` is under the user's home directory.
///
/// Rules (all must pass):
/// 1. The path must be absolute.
/// 2. The path must not contain any `..` components.
/// 3. The raw path must have `$HOME` as a prefix (component-aligned).
/// 4. The canonical nearest-existing-ancestor must also be under canonical `$HOME`.
///
/// Returns `Err(message)` if validation fails.
fn validate_under_home(target: &PathBuf) -> Result<(), String> {
    // 1. Absolute path required.
    if !target.is_absolute() {
        return Err(format!("Path {:?} is not absolute", target));
    }

    // 2. Reject `..` components — traversal attempts are never valid.
    if has_dotdot(target) {
        return Err(format!(
            "Path {:?} contains '..' components which are not allowed",
            target
        ));
    }

    let home_path = home_dir()?;

    // 3. Raw prefix check (component-aligned via PathBuf::starts_with).
    if !target.starts_with(&home_path) {
        return Err(format!(
            "Path {:?} is not under home directory {:?}",
            target, home_path
        ));
    }

    // 4. Canonical check — validate the nearest existing ancestor so we catch
    //    symlink escapes even when the final target doesn't exist yet.
    let canonical_home = std::fs::canonicalize(&home_path).unwrap_or(home_path.clone());
    let canonical_to_check = canonical_ancestor(target);
    if !canonical_to_check.starts_with(&canonical_home) {
        return Err(format!(
            "Canonical path {:?} is not under canonical home directory {:?}",
            canonical_to_check, canonical_home
        ));
    }

    Ok(())
}

// ============================================================
// Typed directory resolution and checked creation
// ============================================================

const SYMLINK_HOP_LIMIT: usize = 40;

#[derive(Debug, Clone, PartialEq, Eq)]
struct ValidatedDirectoryTarget {
    requested_path: PathBuf,
    canonical_existing_ancestor: PathBuf,
    missing_components: Vec<OsString>,
}

#[derive(Debug)]
enum DirectoryPreparationError {
    InvalidRawPath {
        path: PathBuf,
        reason: String,
    },
    NonDirectoryComponent {
        path: PathBuf,
    },
    SymlinkTargetOutsideHome {
        link: PathBuf,
        target: PathBuf,
    },
    SymlinkTargetNotDirectory {
        link: PathBuf,
        target: PathBuf,
    },
    SymlinkCycle {
        link: PathBuf,
    },
    SymlinkHopLimit {
        limit: usize,
    },
    LinkInspection {
        path: PathBuf,
        source: std::io::Error,
    },
    AuthorizationChanged {
        path: PathBuf,
    },
    CreateDirectory {
        path: PathBuf,
        source: std::io::Error,
    },
    Postcondition {
        path: PathBuf,
        reason: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ValidatedFileTarget {
    raw_output_path: PathBuf,
    canonical_parent: PathBuf,
    write_path: PathBuf,
    existing_kind: ExistingFileKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ExistingFileKind {
    Absent,
    RegularFile,
}

#[derive(Debug)]
enum FileTargetError {
    InvalidLeaf {
        path: PathBuf,
    },
    OutputFileSymlink {
        path: PathBuf,
    },
    OutputFileDirectory {
        path: PathBuf,
    },
    UnsupportedFileType {
        path: PathBuf,
    },
    Inspection {
        path: PathBuf,
        source: std::io::Error,
    },
    ParentMismatch {
        expected: PathBuf,
        actual: PathBuf,
    },
}

fn canonical_home_path() -> Result<PathBuf, String> {
    let home_path = home_dir()?;
    Ok(std::fs::canonicalize(&home_path).unwrap_or(home_path))
}

fn normalize_lexical_path(path: &Path) -> Result<PathBuf, DirectoryPreparationError> {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => {
                result.push(prefix.as_os_str());
            }
            Component::RootDir => {
                result.push(component.as_os_str());
            }
            Component::CurDir => {}
            Component::ParentDir => {
                if !result.pop() {
                    return Err(DirectoryPreparationError::InvalidRawPath {
                        path: path.to_path_buf(),
                        reason: "path normalizes above filesystem root".to_string(),
                    });
                }
            }
            Component::Normal(name) => {
                result.push(name);
            }
        }
    }
    Ok(result)
}

fn format_directory_preparation_error(err: &DirectoryPreparationError) -> String {
    match err {
        DirectoryPreparationError::InvalidRawPath { path, reason } => {
            format!("invalid directory path {:?}: {}", path, reason)
        }
        DirectoryPreparationError::NonDirectoryComponent { path } => format!(
            "path component \"{}\" exists but is not a directory",
            path.display()
        ),
        DirectoryPreparationError::SymlinkTargetOutsideHome { link, target } => format!(
            "path component \"{}\" is a symbolic link whose target {:?} is not under the home directory",
            link.display(),
            target
        ),
        DirectoryPreparationError::SymlinkTargetNotDirectory { link, target } => format!(
            "path component \"{}\" is a symbolic link whose target is not a directory: {}",
            link.display(),
            target.display()
        ),
        DirectoryPreparationError::SymlinkCycle { link } => format!(
            "path component \"{}\" is part of a symbolic link cycle",
            link.display()
        ),
        DirectoryPreparationError::SymlinkHopLimit { limit } => {
            format!("symbolic link resolution exceeded hop limit of {limit}")
        }
        DirectoryPreparationError::LinkInspection { path, source } => format!(
            "failed to inspect path component \"{}\": {}",
            path.display(),
            source
        ),
        DirectoryPreparationError::AuthorizationChanged { path } => format!(
            "authorized directory path changed at {:?}",
            path
        ),
        DirectoryPreparationError::CreateDirectory { path, source } => format!(
            "failed to create directory {:?}: {}",
            path, source
        ),
        DirectoryPreparationError::Postcondition { path, reason } => {
            format!("directory postcondition failed for {:?}: {}", path, reason)
        }
    }
}

/// Resolve a requested directory path under canonical `$HOME`, following stored
/// directory symlinks and returning the canonical existing ancestor plus any
/// missing ordinary directory suffix that may be created later.
fn resolve_directory_target_under_home(
    requested: &Path,
) -> Result<ValidatedDirectoryTarget, DirectoryPreparationError> {
    if !requested.is_absolute() {
        return Err(DirectoryPreparationError::InvalidRawPath {
            path: requested.to_path_buf(),
            reason: "path is not absolute".to_string(),
        });
    }
    if has_dotdot(&requested.to_path_buf()) {
        return Err(DirectoryPreparationError::InvalidRawPath {
            path: requested.to_path_buf(),
            reason: "path contains '..' components which are not allowed".to_string(),
        });
    }

    let canonical_home =
        canonical_home_path().map_err(|reason| DirectoryPreparationError::Postcondition {
            path: requested.to_path_buf(),
            reason,
        })?;

    let mut candidate = requested.to_path_buf();
    let mut visited_links = HashSet::<PathBuf>::new();
    let mut hops = 0usize;

    loop {
        let components: Vec<Component<'_>> = candidate.components().collect();
        let mut current = PathBuf::new();

        for (idx, component) in components.iter().enumerate() {
            current.push(component);

            match std::fs::symlink_metadata(&current) {
                Ok(meta) if meta.is_symlink() => {
                    hops += 1;
                    if hops > SYMLINK_HOP_LIMIT {
                        return Err(DirectoryPreparationError::SymlinkHopLimit {
                            limit: SYMLINK_HOP_LIMIT,
                        });
                    }

                    if visited_links.contains(&current) {
                        return Err(DirectoryPreparationError::SymlinkCycle {
                            link: current.clone(),
                        });
                    }
                    visited_links.insert(current.clone());

                    let link_target = std::fs::read_link(&current).map_err(|source| {
                        DirectoryPreparationError::LinkInspection {
                            path: current.clone(),
                            source,
                        }
                    })?;

                    let parent_canonical = current
                        .parent()
                        .ok_or_else(|| DirectoryPreparationError::Postcondition {
                            path: current.clone(),
                            reason: "symlink has no parent".to_string(),
                        })
                        .and_then(|parent| {
                            std::fs::canonicalize(parent).map_err(|source| {
                                DirectoryPreparationError::LinkInspection {
                                    path: parent.to_path_buf(),
                                    source,
                                }
                            })
                        })?;

                    let mut expanded = if link_target.is_absolute() {
                        link_target
                    } else {
                        parent_canonical.join(link_target)
                    };

                    let normalized_target = normalize_lexical_path(&expanded)?;
                    if let Ok(target_meta) = std::fs::symlink_metadata(&normalized_target) {
                        if target_meta.is_file() {
                            return Err(DirectoryPreparationError::SymlinkTargetNotDirectory {
                                link: current.clone(),
                                target: normalized_target,
                            });
                        }
                    }

                    for remaining in &components[idx + 1..] {
                        expanded.push(remaining.as_os_str());
                    }

                    candidate = normalize_lexical_path(&expanded)?;
                    break;
                }
                Ok(meta) if meta.is_dir() => {
                    if idx + 1 == components.len() {
                        let final_canonical =
                            std::fs::canonicalize(&candidate).map_err(|source| {
                                DirectoryPreparationError::LinkInspection {
                                    path: candidate.clone(),
                                    source,
                                }
                            })?;
                        if !final_canonical.starts_with(&canonical_home) {
                            return Err(DirectoryPreparationError::SymlinkTargetOutsideHome {
                                link: candidate.clone(),
                                target: final_canonical,
                            });
                        }
                        return Ok(ValidatedDirectoryTarget {
                            requested_path: requested.to_path_buf(),
                            canonical_existing_ancestor: final_canonical,
                            missing_components: Vec::new(),
                        });
                    }
                }
                Ok(_) => {
                    return Err(DirectoryPreparationError::NonDirectoryComponent { path: current });
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                    let parent = current.parent().ok_or_else(|| {
                        DirectoryPreparationError::Postcondition {
                            path: current.clone(),
                            reason: "missing component has no parent".to_string(),
                        }
                    })?;
                    let canon_parent = std::fs::canonicalize(parent).map_err(|source| {
                        DirectoryPreparationError::LinkInspection {
                            path: parent.to_path_buf(),
                            source,
                        }
                    })?;
                    if !canon_parent.starts_with(&canonical_home) {
                        return Err(DirectoryPreparationError::SymlinkTargetOutsideHome {
                            link: current.clone(),
                            target: canon_parent,
                        });
                    }

                    let missing_components = components[idx..]
                        .iter()
                        .filter_map(|c| match c {
                            Component::Normal(name) => Some(name.to_os_string()),
                            _ => None,
                        })
                        .collect();

                    return Ok(ValidatedDirectoryTarget {
                        requested_path: requested.to_path_buf(),
                        canonical_existing_ancestor: canon_parent,
                        missing_components,
                    });
                }
                Err(source) => {
                    return Err(DirectoryPreparationError::LinkInspection {
                        path: current,
                        source,
                    });
                }
            }
        }
    }
}

/// Verify a directory entry matches the exact expected canonical identity.
///
/// Residual threat boundary: path-based APIs cannot prevent a same-user mutation
/// inside the canonicalize/`create_dir` interval; a raced mkdir may already have
/// created one directory. The promised postcondition is detection of observable
/// mismatch followed by no descendant mkdir and no writer call—not rollback.
fn canonical_directory_identity(
    path: &Path,
    canonical_home: &Path,
    expected_canonical: &Path,
) -> Result<PathBuf, DirectoryPreparationError> {
    let meta = std::fs::symlink_metadata(path).map_err(|source| {
        DirectoryPreparationError::LinkInspection {
            path: path.to_path_buf(),
            source,
        }
    })?;
    if meta.is_symlink() || !meta.is_dir() {
        return Err(DirectoryPreparationError::AuthorizationChanged {
            path: path.to_path_buf(),
        });
    }
    let canonical = std::fs::canonicalize(path).map_err(|source| {
        DirectoryPreparationError::LinkInspection {
            path: path.to_path_buf(),
            source,
        }
    })?;
    if !canonical.starts_with(canonical_home) {
        return Err(DirectoryPreparationError::SymlinkTargetOutsideHome {
            link: path.to_path_buf(),
            target: canonical,
        });
    }
    if canonical != expected_canonical {
        return Err(DirectoryPreparationError::AuthorizationChanged {
            path: path.to_path_buf(),
        });
    }
    Ok(canonical)
}

/// Create one missing directory component at a time with pre/post identity checks.
///
/// Residual threat boundary: path-based APIs cannot pin the parent between the last
/// canonical check and `create_dir`; a malicious same-user actor may mutate ancestry
/// in that interval. Descriptor-/handle-relative hardening is out of scope here.
/// The promised postcondition is detection of observable mismatch followed by no
/// descendant mkdir and no writer call—not rollback and not atomic sandboxing.
fn create_validated_directory_with<Create>(
    target: &ValidatedDirectoryTarget,
    canonical_home: &Path,
    mut create_directory: Create,
) -> Result<PathBuf, DirectoryPreparationError>
where
    Create: FnMut(&Path) -> std::io::Result<()>,
{
    let mut current_parent = target.canonical_existing_ancestor.clone();

    for component in &target.missing_components {
        let next_path = current_parent.join(component);
        let expected_child = next_path.clone();

        let canon_parent = std::fs::canonicalize(&current_parent).map_err(|source| {
            DirectoryPreparationError::LinkInspection {
                path: current_parent.clone(),
                source,
            }
        })?;
        if canon_parent != current_parent {
            return Err(DirectoryPreparationError::AuthorizationChanged {
                path: current_parent,
            });
        }
        if !canon_parent.starts_with(canonical_home) {
            return Err(DirectoryPreparationError::SymlinkTargetOutsideHome {
                link: next_path.clone(),
                target: canon_parent,
            });
        }

        match std::fs::symlink_metadata(&next_path) {
            Ok(meta) if meta.is_dir() => {
                current_parent =
                    canonical_directory_identity(&next_path, canonical_home, &expected_child)?;
            }
            Ok(_) => {
                return Err(DirectoryPreparationError::AuthorizationChanged { path: next_path });
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                if let Err(source) = create_directory(&next_path) {
                    if source.kind() == std::io::ErrorKind::AlreadyExists {
                        current_parent = canonical_directory_identity(
                            &next_path,
                            canonical_home,
                            &expected_child,
                        )?;
                    } else {
                        return Err(DirectoryPreparationError::CreateDirectory {
                            path: next_path,
                            source,
                        });
                    }
                } else {
                    current_parent =
                        canonical_directory_identity(&next_path, canonical_home, &expected_child)?;
                }
            }
            Err(source) => {
                return Err(DirectoryPreparationError::LinkInspection {
                    path: next_path,
                    source,
                });
            }
        }
    }

    canonical_directory_identity(&current_parent, canonical_home, &current_parent)
}

fn prepare_directory_under_home_with<Create>(
    requested: &Path,
    create_directory: Create,
) -> Result<PathBuf, DirectoryPreparationError>
where
    Create: FnMut(&Path) -> std::io::Result<()>,
{
    let canonical_home =
        canonical_home_path().map_err(|reason| DirectoryPreparationError::Postcondition {
            path: requested.to_path_buf(),
            reason,
        })?;
    let resolved = resolve_directory_target_under_home(requested)?;
    create_validated_directory_with(&resolved, &canonical_home, create_directory)
}

fn prepare_directory_under_home(requested: &Path) -> Result<PathBuf, DirectoryPreparationError> {
    prepare_directory_under_home_with(requested, |path| std::fs::create_dir(path))
}

fn format_file_target_error(err: &FileTargetError) -> String {
    match err {
        FileTargetError::InvalidLeaf { path } => {
            format!("output path {:?} has an invalid file leaf", path)
        }
        FileTargetError::OutputFileSymlink { path } => format!(
            "Vinela will not write through output-file symlinks at {:?}; configure the real ordinary file path or repair the link manually",
            path
        ),
        FileTargetError::OutputFileDirectory { path } => {
            format!("output path {:?} is a directory, not a file", path)
        }
        FileTargetError::UnsupportedFileType { path } => {
            format!("output path {:?} is not a regular file", path)
        }
        FileTargetError::Inspection { path, source } => {
            format!("failed to inspect output file {:?}: {}", path, source)
        }
        FileTargetError::ParentMismatch { expected, actual } => format!(
            "authorized output parent {:?} no longer matches {:?}",
            expected, actual
        ),
    }
}

fn extract_lexical_file_leaf(raw_output_path: &Path) -> Result<&std::ffi::OsStr, FileTargetError> {
    let path = raw_output_path.as_os_str();
    if path.is_empty() {
        return Err(FileTargetError::InvalidLeaf {
            path: raw_output_path.to_path_buf(),
        });
    }

    let bytes = path.as_encoded_bytes();
    let has_trailing_separator = if bytes.is_empty() {
        false
    } else {
        #[cfg(windows)]
        {
            bytes[bytes.len() - 1] == b'/' || bytes[bytes.len() - 1] == b'\\'
        }
        #[cfg(not(windows))]
        {
            bytes[bytes.len() - 1] == b'/'
        }
    };
    if has_trailing_separator {
        return Err(FileTargetError::InvalidLeaf {
            path: raw_output_path.to_path_buf(),
        });
    }
    let has_terminal_separator_dot = {
        #[cfg(windows)]
        {
            bytes.ends_with(b"/.") || bytes.ends_with(b"\\.")
        }
        #[cfg(not(windows))]
        {
            bytes.ends_with(b"/.")
        }
    };
    if has_terminal_separator_dot {
        return Err(FileTargetError::InvalidLeaf {
            path: raw_output_path.to_path_buf(),
        });
    }

    match raw_output_path.components().next_back() {
        Some(Component::Normal(name)) => {
            let name_bytes = name.as_encoded_bytes();
            if name_bytes == b"." || name_bytes == b".." {
                return Err(FileTargetError::InvalidLeaf {
                    path: raw_output_path.to_path_buf(),
                });
            }
            Ok(name)
        }
        Some(Component::CurDir) | Some(Component::ParentDir) => Err(FileTargetError::InvalidLeaf {
            path: raw_output_path.to_path_buf(),
        }),
        Some(Component::RootDir) | Some(Component::Prefix(_)) | None => {
            Err(FileTargetError::InvalidLeaf {
                path: raw_output_path.to_path_buf(),
            })
        }
    }
}

fn validate_file_target(
    raw_output_path: &Path,
    canonical_parent: &Path,
) -> Result<ValidatedFileTarget, FileTargetError> {
    let file_name = extract_lexical_file_leaf(raw_output_path)?;

    let write_path = canonical_parent.join(file_name);

    let raw_parent = raw_output_path
        .parent()
        .ok_or_else(|| FileTargetError::InvalidLeaf {
            path: raw_output_path.to_path_buf(),
        })?;
    let revalidated = resolve_directory_target_under_home(raw_parent).map_err(|_| {
        FileTargetError::ParentMismatch {
            expected: canonical_parent.to_path_buf(),
            actual: raw_parent.to_path_buf(),
        }
    })?;
    if !revalidated.missing_components.is_empty() {
        return Err(FileTargetError::ParentMismatch {
            expected: canonical_parent.to_path_buf(),
            actual: raw_parent.to_path_buf(),
        });
    }
    if revalidated.canonical_existing_ancestor != canonical_parent {
        return Err(FileTargetError::ParentMismatch {
            expected: canonical_parent.to_path_buf(),
            actual: revalidated.canonical_existing_ancestor,
        });
    }

    let existing_kind = match std::fs::symlink_metadata(&write_path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => ExistingFileKind::Absent,
        Ok(meta) if meta.is_file() => ExistingFileKind::RegularFile,
        Ok(meta) if meta.is_symlink() => {
            return Err(FileTargetError::OutputFileSymlink { path: write_path });
        }
        Ok(meta) if meta.is_dir() => {
            return Err(FileTargetError::OutputFileDirectory { path: write_path });
        }
        Ok(_) => {
            return Err(FileTargetError::UnsupportedFileType { path: write_path });
        }
        Err(source) => {
            return Err(FileTargetError::Inspection {
                path: write_path,
                source,
            });
        }
    };

    Ok(ValidatedFileTarget {
        raw_output_path: raw_output_path.to_path_buf(),
        canonical_parent: canonical_parent.to_path_buf(),
        write_path,
        existing_kind,
    })
}

/// Write text to `target`, creating the target's parent directory with checked
/// single-level creation and writing only through the canonical-parent-derived path.
fn write_text_creating_parent_with<AfterPrepare, WriteFn>(
    target: &Path,
    content: &str,
    mut after_prepare: AfterPrepare,
    write_file: WriteFn,
) -> Result<usize, String>
where
    AfterPrepare: FnMut(&Path, &PathBuf) -> Result<(), String>,
    WriteFn: FnOnce(&Path, &[u8]) -> std::io::Result<()>,
{
    let parent = target
        .parent()
        .ok_or_else(|| format!("Path {:?} has no parent directory", target))?;

    let canonical_parent = prepare_directory_under_home(parent).map_err(|err| {
        format!(
            "Failed to create parent directory {:?}: {}",
            parent,
            format_directory_preparation_error(&err)
        )
    })?;

    after_prepare(target, &canonical_parent)?;

    let file_target = validate_file_target(target, &canonical_parent).map_err(|err| {
        format!(
            "Failed to write {:?}: {}",
            target,
            format_file_target_error(&err)
        )
    })?;

    let bytes = content.as_bytes();
    write_file(&file_target.write_path, bytes)
        .map_err(|e| format!("Failed to write {:?}: {}", file_target.write_path, e))?;

    Ok(bytes.len())
}

fn write_text_creating_parent(target: &Path, content: &str) -> Result<usize, String> {
    write_text_creating_parent_with(
        target,
        content,
        |_target, _canonical_parent| Ok(()),
        |path, bytes| std::fs::write(path, bytes),
    )
}

// ============================================================
// Tauri commands
// ============================================================

/// Get the dev project path for development mode.
/// Returns the path to dev-data/default-project in the repo root.
/// Only available in debug builds.
#[tauri::command]
fn get_dev_project_path(_app_handle: tauri::AppHandle) -> Option<String> {
    #[cfg(debug_assertions)]
    {
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let src_tauri_path = PathBuf::from(manifest_dir);
        let repo_root = src_tauri_path.parent().expect("Failed to get repo root");
        let dev_project_path = repo_root.join("dev-data").join("default-project");

        if let Err(e) = _app_handle
            .fs_scope()
            .allow_directory(&dev_project_path, true)
        {
            eprintln!(
                "[get_dev_project_path] Failed to extend fs scope for {:?}: {}",
                dev_project_path, e
            );
            return None;
        }

        Some(dev_project_path.to_string_lossy().to_string())
    }
    #[cfg(not(debug_assertions))]
    {
        None
    }
}

/// Extend the filesystem scope to allow access to a directory under $HOME.
///
/// Validates that the path is under $HOME, then adds it (and its parent) to
/// Tauri's runtime allow-list. Handles symlinked paths by registering both the
/// raw and canonicalized forms.
///
/// Idempotent — safe to call multiple times with the same path.
#[tauri::command]
fn allow_output_directory(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);

    // Security: validate path is absolute, no `..`, and under $HOME.
    validate_under_home(&target)?;

    // Canonicalize so Tauri's internal scope checker (which also canonicalizes)
    // sees the same path we register. Fall back to raw path if it doesn't exist yet.
    let canonical_target = std::fs::canonicalize(&target).unwrap_or(target.clone());

    // Re-validate canonical path against canonical home.
    let home_path = home_dir()?;
    let canonical_home = std::fs::canonicalize(&home_path).unwrap_or(home_path.clone());
    if !canonical_target.starts_with(&canonical_home) {
        return Err(format!(
            "Canonical path {:?} is not under canonical home directory {:?}",
            canonical_target, canonical_home
        ));
    }

    // Allow the target directory recursively.
    app_handle
        .fs_scope()
        .allow_directory(&canonical_target, true)
        .map_err(|e| format!("Failed to allow directory {:?}: {}", canonical_target, e))?;

    // Also add the original (possibly symlinked) path so lookups using the
    // symlink form succeed without re-canonicalizing.
    if canonical_target != target {
        // Non-fatal if this fails; the canonical entry already covers access.
        let _ = app_handle.fs_scope().allow_directory(&target, true);
    }

    // Allow the parent directory (non-recursive) so mkdir on the target works.
    if let Some(parent) = canonical_target.parent() {
        let canonical_parent =
            std::fs::canonicalize(parent).unwrap_or_else(|_| parent.to_path_buf());
        let _ = app_handle
            .fs_scope()
            .allow_directory(&canonical_parent, false);

        if let Some(orig_parent) = target.parent() {
            if canonical_parent != orig_parent {
                let _ = app_handle.fs_scope().allow_directory(orig_parent, false);
            }
        }
    }

    Ok(())
}

/// Deploy generated init.lua to the target path using std::fs directly.
///
/// Bypasses Tauri's plugin-fs scope system entirely.
///
/// Security: both `output_path` and `parent_dir` are independently validated
/// (absolute, no `..`, under $HOME). Additionally, `parent_dir` must be an
/// ancestor of `output_path` to prevent mismatched-payload attacks.
#[tauri::command]
fn deploy_to_path(parent_dir: String, output_path: String, code: String) -> Result<usize, String> {
    let target = PathBuf::from(&output_path);
    let parent = PathBuf::from(&parent_dir);

    // Security: validate both paths independently.
    validate_under_home(&target).map_err(|e| format!("output_path validation failed: {}", e))?;
    validate_under_home(&parent).map_err(|e| format!("parent_dir validation failed: {}", e))?;

    // Security: parent_dir must be an ancestor of output_path.
    if !target.starts_with(&parent) {
        return Err(format!(
            "output_path {:?} is not under parent_dir {:?}",
            target, parent
        ));
    }

    // Create the output file's actual parent directory with checked single-level creation.
    write_text_creating_parent(&target, &code)?;

    Ok(code.as_bytes().len())
}

/// Read a text file via std::fs, bypassing plugin-fs scope.
///
/// Security: only allows paths under $HOME.
#[tauri::command]
fn read_text_file_direct(path: String) -> Result<String, String> {
    let target = PathBuf::from(&path);
    validate_under_home(&target)?;
    std::fs::read_to_string(&target).map_err(|e| format!("Failed to read {:?}: {}", target, e))
}

/// Check if a path exists via std::fs, bypassing plugin-fs scope.
///
/// Security: only allows paths under $HOME.
#[tauri::command]
fn path_exists_direct(path: String) -> Result<bool, String> {
    let target = PathBuf::from(&path);
    validate_under_home(&target)?;
    Ok(target.exists())
}

/// Get file owner UID via std::fs for ownership checks.
/// Returns the uid of the file owner, or null if not available (Windows).
///
/// Security: only allows paths under $HOME.
#[tauri::command]
fn file_uid_direct(path: String) -> Result<Option<u32>, String> {
    let target = PathBuf::from(&path);
    validate_under_home(&target)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        match std::fs::metadata(&target) {
            Ok(meta) => Ok(Some(meta.uid())),
            Err(_) => Ok(None),
        }
    }

    #[cfg(not(unix))]
    {
        Ok(None)
    }
}

// ============================================================
// Direct-FS types (returned by new commands)
// ============================================================

#[derive(serde::Serialize)]
struct DirectDirEntry {
    name: String,
    is_file: bool,
    is_dir: bool,
}

#[derive(serde::Serialize)]
struct DirectStatResult {
    size: u64,
    is_file: bool,
    is_dir: bool,
}

// ============================================================
// Direct-FS commands — bypass plugin-fs scope entirely
// ============================================================

/// Write a text file via std::fs, bypassing plugin-fs scope.
///
/// Security: validates path is under $HOME.
/// Returns the number of bytes written.
#[tauri::command]
fn write_text_file_direct(path: String, content: String) -> Result<usize, String> {
    let target = PathBuf::from(&path);
    validate_under_home(&target)?;

    write_text_creating_parent(&target, &content)
}

/// Create a directory via std::fs with checked single-level creation, bypassing
/// plugin-fs scope.
///
/// Security: validates path is under $HOME.
#[tauri::command]
fn mkdir_direct(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    validate_under_home(&target)?;

    prepare_directory_under_home(&target).map_err(|err| {
        format!(
            "Failed to create directory {:?}: {}",
            target,
            format_directory_preparation_error(&err)
        )
    })?;

    Ok(())
}

/// List directory entries via std::fs, bypassing plugin-fs scope.
///
/// Security: validates path is under $HOME.
/// Returns a list of entries with name, is_file, and is_dir fields.
#[tauri::command]
fn read_dir_direct(path: String) -> Result<Vec<DirectDirEntry>, String> {
    let target = PathBuf::from(&path);
    validate_under_home(&target)?;

    let mut entries = Vec::new();
    let read_dir = std::fs::read_dir(&target)
        .map_err(|e| format!("Failed to read directory {:?}: {}", target, e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata for {:?}: {}", entry.path(), e))?;
        if let Some(name) = entry.file_name().to_str() {
            entries.push(DirectDirEntry {
                name: name.to_string(),
                is_file: metadata.is_file(),
                is_dir: metadata.is_dir(),
            });
        }
    }

    Ok(entries)
}

/// Get file/directory metadata via std::fs, bypassing plugin-fs scope.
///
/// Security: validates path is under $HOME.
/// Returns size, is_file, and is_dir.
#[tauri::command]
fn stat_direct(path: String) -> Result<DirectStatResult, String> {
    let target = PathBuf::from(&path);
    validate_under_home(&target)?;

    let metadata =
        std::fs::metadata(&target).map_err(|e| format!("Failed to stat {:?}: {}", target, e))?;

    Ok(DirectStatResult {
        size: metadata.len(),
        is_file: metadata.is_file(),
        is_dir: metadata.is_dir(),
    })
}

/// Open a path in the system file manager via std::process::Command,
/// bypassing Tauri's opener plugin scope entirely.
///
/// Security: validates path is under $HOME.
#[tauri::command]
fn open_path_direct(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    validate_under_home(&target)?;

    if !target.exists() {
        return Err(format!("Path does not exist: {:?}", target));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open {:?}: {}", path, e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open {:?}: {}", path, e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open {:?}: {}", path, e))?;
    }

    Ok(())
}

/// Remove a file or directory via std::fs, bypassing plugin-fs scope.
///
/// Security: validates path is under $HOME.
/// If `recursive` is true, removes a directory and all its contents.
/// If the path does not exist, the call is a no-op (returns Ok).
#[tauri::command]
fn remove_direct(path: String, recursive: bool) -> Result<(), String> {
    let target = PathBuf::from(&path);
    validate_under_home(&target)?;

    if !target.exists() {
        return Ok(());
    }

    if target.is_dir() {
        if recursive {
            std::fs::remove_dir_all(&target)
        } else {
            std::fs::remove_dir(&target)
        }
    } else {
        std::fs::remove_file(&target)
    }
    .map_err(|e| format!("Failed to remove {:?}: {}", target, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    let updater_enabled = context.config().plugins.0.contains_key("updater");

    let builder = tauri::Builder::default()
        .setup(move |_app| {
            #[cfg(all(desktop, not(target_os = "windows")))]
            {
                let menu = build_app_menu(_app, updater_enabled)?;
                _app.set_menu(menu)?;
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == CHECK_FOR_UPDATES_MENU_ID {
                let _ = app.emit(CHECK_FOR_UPDATES_EVENT, ());
            }
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init());

    let builder = if updater_enabled {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };

    builder
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            get_dev_project_path,
            allow_output_directory,
            deploy_to_path,
            read_text_file_direct,
            path_exists_direct,
            file_uid_direct,
            write_text_file_direct,
            mkdir_direct,
            read_dir_direct,
            stat_direct,
            remove_direct,
            open_path_direct,
        ])
        .run(context)
        .expect("error while running tauri application");
}

// ============================================================
// Unit tests for security helpers
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ── has_dotdot ───────────────────────────────────────────────────────────

    #[test]
    fn test_has_dotdot_clean_path() {
        assert!(!has_dotdot(&PathBuf::from(
            "/home/user/.config/nvim/init.lua"
        )));
    }

    #[test]
    fn test_has_dotdot_trailing_dotdot() {
        assert!(has_dotdot(&PathBuf::from("/home/user/.config/nvim/..")));
    }

    #[test]
    fn test_has_dotdot_mid_path() {
        assert!(has_dotdot(&PathBuf::from("/home/user/../etc/passwd")));
    }

    #[test]
    fn test_has_dotdot_only_dotdot() {
        assert!(has_dotdot(&PathBuf::from("..")));
    }

    #[test]
    fn test_has_dotdot_dot_not_dotdot() {
        // A single `.` is CurDir, not ParentDir — must NOT be flagged.
        assert!(!has_dotdot(&PathBuf::from("/home/user/./config")));
    }

    // ── validate_under_home (using real $HOME from test environment) ─────────

    fn real_home() -> PathBuf {
        PathBuf::from(
            std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .expect("No HOME env var in test environment"),
        )
    }

    #[test]
    fn test_validate_under_home_accepts_home_subpath() {
        let home = real_home();
        let target = home.join(".config").join("nvim").join("init.lua");
        // The path probably doesn't exist on CI; validate_under_home must still pass
        // for newly-created target paths (ancestor walk).
        let result = validate_under_home(&target);
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
    }

    #[test]
    fn test_validate_under_home_rejects_dotdot_traversal() {
        let home = real_home();
        // Craft a path that starts with $HOME but contains `..` to escape.
        let sneaky = home.join("..").join("etc").join("passwd");
        let result = validate_under_home(&sneaky);
        assert!(result.is_err(), "Expected Err for dotdot path");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("'..'"),
            "Error should mention '..', got: {}",
            msg
        );
    }

    #[test]
    fn test_validate_under_home_rejects_relative_path() {
        let result = validate_under_home(&PathBuf::from("relative/path"));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("not absolute"), "got: {}", msg);
    }

    #[test]
    fn test_validate_under_home_rejects_outside_home() {
        // /etc/passwd is outside $HOME on any Unix system.
        let result = validate_under_home(&PathBuf::from("/etc/passwd"));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("not under home directory") || msg.contains("not absolute"),
            "got: {}",
            msg
        );
    }

    #[test]
    fn test_validate_under_home_rejects_sibling_prefix() {
        // /home/username must NOT match if $HOME is /home/user.
        // We simulate this by checking the raw starts_with logic in isolation.
        let home = PathBuf::from("/home/user");
        let sibling = PathBuf::from("/home/username/.config");
        // PathBuf::starts_with is component-aligned, so this must be false.
        assert!(
            !sibling.starts_with(&home),
            "Component-aligned starts_with must reject sibling prefix"
        );
    }

    // ── deploy_to_path validation (parent vs output mismatch) ────────────────

    #[test]
    fn test_deploy_to_path_rejects_dotdot_in_output() {
        let home = real_home();
        let parent = home
            .join(".config")
            .join("nvim")
            .to_string_lossy()
            .into_owned();
        let output = home
            .join(".config")
            .join("nvim")
            .join("..")
            .join("evil")
            .join("init.lua")
            .to_string_lossy()
            .into_owned();
        let result = deploy_to_path(parent, output, String::new());
        assert!(result.is_err(), "Expected Err for dotdot in output_path");
    }

    #[test]
    fn test_deploy_to_path_rejects_mismatched_parent_output() {
        let home = real_home();
        // parent_dir points to one location, output_path to a sibling — must be rejected.
        let parent = home
            .join(".config")
            .join("nvim")
            .to_string_lossy()
            .into_owned();
        let output = home
            .join(".config")
            .join("other-dir")
            .join("init.lua")
            .to_string_lossy()
            .into_owned();
        let result = deploy_to_path(parent, output, String::new());
        assert!(result.is_err(), "Expected Err for mismatched parent/output");
        let msg = result.unwrap_err();
        assert!(msg.contains("not under parent_dir"), "got: {}", msg);
    }

    #[test]
    fn test_deploy_to_path_rejects_output_outside_home() {
        let home = real_home();
        let parent = home
            .join(".config")
            .join("nvim")
            .to_string_lossy()
            .into_owned();
        let output = "/etc/passwd".to_string();
        let result = deploy_to_path(parent, output, String::new());
        assert!(result.is_err());
    }

    #[test]
    fn test_deploy_to_path_rejects_parent_outside_home() {
        let home = real_home();
        let parent = "/etc".to_string();
        let output = home
            .join(".config")
            .join("nvim")
            .join("init.lua")
            .to_string_lossy()
            .into_owned();
        let result = deploy_to_path(parent, output, String::new());
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("parent_dir validation failed"), "got: {}", msg);
    }

    // ── Phase 1 characterization gate: valid in-home intermediate symlink ───

    /// RAII guard that removes a fixture root on drop, including on assertion failure.
    struct FixtureGuard {
        root: PathBuf,
    }

    impl FixtureGuard {
        fn new(root: PathBuf) -> Self {
            Self { root }
        }
    }

    impl Drop for FixtureGuard {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }

    #[cfg(unix)]
    #[test]
    fn deploy_to_path_creates_missing_child_through_in_home_directory_symlink() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = format!(
            "vinela-symlink-gate-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        );
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());

        // Real in-home config target directory (symlink destination).
        let config_target = fixture_root.join("real-config");
        std::fs::create_dir_all(&config_target).expect("create real config target");

        // Raw `.config` symlink pointing at the real directory.
        let config_symlink = fixture_root.join(".config");
        symlink(&config_target, &config_symlink).expect("create .config symlink");

        // Output path through the symlink; `nvim` child is absent.
        let output_path = config_symlink
            .join("nvim")
            .join("init.lua")
            .to_string_lossy()
            .into_owned();
        let parent_dir = config_symlink.join("nvim").to_string_lossy().into_owned();
        let code = "-- Generated by vinela\nprint('symlink deploy')\n";

        let result = deploy_to_path(parent_dir, output_path.clone(), code.to_string());
        assert!(
            result.is_ok(),
            "deploy_to_path through valid in-home symlink must succeed, got: {:?}",
            result
        );
        assert_eq!(result.unwrap(), code.as_bytes().len());

        // `nvim` must exist under the real symlink target, not only at the raw path.
        let nvim_under_target = config_target.join("nvim");
        assert!(
            nvim_under_target.is_dir(),
            "nvim directory must be created under symlink target {:?}",
            config_target
        );

        let read_via_raw = std::fs::read_to_string(&output_path).expect("read via raw path");
        let read_via_target = std::fs::read_to_string(nvim_under_target.join("init.lua"))
            .expect("read via resolved target");
        assert_eq!(read_via_raw, code);
        assert_eq!(read_via_target, code);
        assert_symlink_unchanged(&config_symlink, &config_target);
    }

    // ── deploy_to_path command-level filesystem tests ───────────────────────

    fn unique_deploy_fixture(suffix: &str) -> String {
        format!(
            "vinela-deploy-{suffix}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        )
    }

    fn assert_deploy_parent_creation_failed(result: Result<usize, String>) -> String {
        assert!(
            result.is_err(),
            "expected deploy failure, got: {:?}",
            result
        );
        let msg = result.unwrap_err();
        assert!(
            msg.starts_with("Failed to create parent directory"),
            "expected parent-creation prefix, got: {}",
            msg
        );
        msg
    }

    #[test]
    fn deploy_to_path_creates_missing_nested_directories() {
        let home = real_home();
        let unique = unique_deploy_fixture("missing-nested");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());

        let parent_dir = fixture_root
            .join("deep")
            .join("nested")
            .join("nvim")
            .to_string_lossy()
            .into_owned();
        let output_path = format!("{parent_dir}/init.lua");
        let code = "-- Generated by vinela\nprint('nested')\n";

        let result = deploy_to_path(parent_dir, output_path.clone(), code.to_string());
        assert!(result.is_ok(), "deploy failed: {:?}", result);
        assert_eq!(result.unwrap(), code.as_bytes().len());

        let read_back = std::fs::read_to_string(&output_path).expect("read deployed file");
        assert_eq!(read_back, code);
    }

    #[test]
    fn deploy_to_path_is_idempotent_when_parent_directory_exists() {
        let home = real_home();
        let unique = unique_deploy_fixture("idempotent-parent");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());

        let parent = fixture_root.join("nvim");
        std::fs::create_dir_all(&parent).expect("pre-create parent");

        let parent_dir = parent.to_string_lossy().into_owned();
        let output_path = parent.join("init.lua").to_string_lossy().into_owned();
        let code = "-- Generated by vinela\nprint('idempotent')\n";

        let first = deploy_to_path(parent_dir.clone(), output_path.clone(), code.to_string());
        assert!(first.is_ok(), "first deploy failed: {:?}", first);

        let second = deploy_to_path(parent_dir, output_path.clone(), code.to_string());
        assert!(second.is_ok(), "second deploy failed: {:?}", second);
        assert_eq!(
            std::fs::read_to_string(&output_path).expect("read file"),
            code
        );
    }

    #[test]
    fn deploy_to_path_rejects_regular_file_as_requested_parent() {
        let home = real_home();
        let unique = unique_deploy_fixture("file-parent");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let blocking_parent = fixture_root.join("nvim");
        std::fs::write(&blocking_parent, "not a directory").expect("create blocking file");

        let parent_dir = blocking_parent.to_string_lossy().into_owned();
        let output_path = blocking_parent
            .join("init.lua")
            .to_string_lossy()
            .into_owned();
        let msg = assert_deploy_parent_creation_failed(deploy_to_path(
            parent_dir,
            output_path.clone(),
            "-- Generated by vinela\n".to_string(),
        ));

        assert!(
            msg.contains(&blocking_parent.display().to_string()),
            "message must name raw blocking path, got: {}",
            msg
        );
        assert!(
            msg.contains("exists but is not a directory"),
            "message must name blocker reason, got: {}",
            msg
        );
        assert!(
            !output_path_exists(&output_path),
            "init.lua must not be written when parent is blocked"
        );
    }

    #[test]
    fn deploy_to_path_rejects_regular_file_as_intermediate_component() {
        let home = real_home();
        let unique = unique_deploy_fixture("file-intermediate");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let blocking_intermediate = fixture_root.join("blocking");
        std::fs::write(&blocking_intermediate, "not a directory")
            .expect("create blocking intermediate file");

        let parent_dir = blocking_intermediate
            .join("nvim")
            .to_string_lossy()
            .into_owned();
        let output_path = format!("{parent_dir}/init.lua");
        let msg = assert_deploy_parent_creation_failed(deploy_to_path(
            parent_dir,
            output_path.clone(),
            "-- Generated by vinela\n".to_string(),
        ));

        assert!(
            msg.contains(&blocking_intermediate.display().to_string()),
            "message must name raw blocking intermediate, got: {}",
            msg
        );
        assert!(
            msg.contains("exists but is not a directory"),
            "message must name blocker reason, got: {}",
            msg
        );
        assert!(
            !output_path_exists(&output_path),
            "init.lua must not be written when intermediate is blocked"
        );
    }

    #[cfg(unix)]
    #[test]
    fn deploy_to_path_creates_missing_target_through_absolute_in_home_parent_symlink() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("dangling-parent-success");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let missing_target = fixture_root.join("dotfiles").join("nvim-config");
        let dangling_parent = fixture_root.join("nvim");
        symlink(&missing_target, &dangling_parent).expect("create dangling parent symlink");

        let parent_dir = dangling_parent.to_string_lossy().into_owned();
        let output_path = dangling_parent
            .join("init.lua")
            .to_string_lossy()
            .into_owned();
        let code = "-- Generated by vinela\nprint('dangling parent deploy')\n";

        let result = deploy_to_path(parent_dir, output_path.clone(), code.to_string());
        assert!(
            result.is_ok(),
            "deploy through in-home dangling parent symlink must succeed, got: {:?}",
            result
        );
        assert_eq!(result.unwrap(), code.as_bytes().len());

        assert!(
            missing_target.is_dir(),
            "missing symlink target must be created"
        );
        let written = missing_target.join("init.lua");
        assert_eq!(
            std::fs::read_to_string(&written).expect("read target file"),
            code
        );

        assert_symlink_unchanged(&dangling_parent, &missing_target);
    }

    #[cfg(unix)]
    #[test]
    fn dangling_directory_symlink_deploy_to_path_creates_missing_child_through_relative_in_home_target(
    ) {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("relative-dangling");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("dotfiles")).expect("create dotfiles");

        let dangling_parent = fixture_root.join("nvim");
        let stored_target = Path::new("dotfiles/nvim-config");
        symlink(stored_target, &dangling_parent).expect("create relative dangling link");

        let parent_dir = dangling_parent.to_string_lossy().into_owned();
        let output_path = dangling_parent
            .join("init.lua")
            .to_string_lossy()
            .into_owned();
        let code = "-- Generated by vinela\nprint('relative dangling')\n";

        let result = deploy_to_path(parent_dir, output_path, code.to_string());
        assert!(
            result.is_ok(),
            "relative dangling deploy failed: {:?}",
            result
        );

        let target_dir = fixture_root.join("dotfiles").join("nvim-config");
        assert!(target_dir.is_dir());
        assert_eq!(
            std::fs::read_to_string(target_dir.join("init.lua")).expect("read"),
            code
        );
        assert_symlink_unchanged(&dangling_parent, stored_target);
    }

    #[cfg(unix)]
    #[test]
    fn dangling_directory_symlink_deploy_to_path_creates_suffix_through_intermediate_dangling_link()
    {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("dangling-intermediate-success");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let missing_target = fixture_root.join("real-config");
        let dangling_intermediate = fixture_root.join(".config");
        symlink(&missing_target, &dangling_intermediate)
            .expect("create dangling intermediate symlink");

        let parent_dir = dangling_intermediate
            .join("nvim")
            .to_string_lossy()
            .into_owned();
        let output_path = format!("{parent_dir}/init.lua");
        let code = "-- Generated by vinela\nprint('intermediate dangling')\n";

        let result = deploy_to_path(parent_dir, output_path.clone(), code.to_string());
        assert!(
            result.is_ok(),
            "intermediate dangling deploy failed: {:?}",
            result
        );

        let nvim_dir = missing_target.join("nvim");
        assert!(nvim_dir.is_dir());
        assert_eq!(
            std::fs::read_to_string(nvim_dir.join("init.lua")).expect("read"),
            code
        );
        assert_symlink_unchanged(&dangling_intermediate, &missing_target);
    }

    #[cfg(unix)]
    #[test]
    fn deploy_to_path_rejects_requested_parent_symlink_to_regular_file() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("parent-symlink-to-file");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let target_file = fixture_root.join("regular-file");
        std::fs::write(&target_file, "file contents").expect("create symlink target file");

        let parent_symlink = fixture_root.join("nvim");
        symlink(&target_file, &parent_symlink).expect("create parent symlink to file");

        let parent_dir = parent_symlink.to_string_lossy().into_owned();
        let output_path = parent_symlink
            .join("init.lua")
            .to_string_lossy()
            .into_owned();
        let msg = assert_deploy_parent_creation_failed(deploy_to_path(
            parent_dir,
            output_path.clone(),
            "-- Generated by vinela\n".to_string(),
        ));

        assert!(
            msg.contains(&parent_symlink.display().to_string()),
            "message must name raw parent symlink, got: {}",
            msg
        );
        assert!(
            msg.contains("symbolic link whose target is not a directory"),
            "message must name symlink-to-file reason, got: {}",
            msg
        );
        assert!(
            !output_path_exists(&output_path),
            "init.lua must not be written when parent symlink targets a file"
        );
        assert_symlink_unchanged(&parent_symlink, &target_file);
    }

    #[cfg(unix)]
    #[test]
    fn deploy_to_path_rejects_intermediate_symlink_to_regular_file() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("intermediate-symlink-to-file");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let target_file = fixture_root.join("config-file");
        std::fs::write(&target_file, "file contents").expect("create symlink target file");

        let intermediate_symlink = fixture_root.join(".config");
        symlink(&target_file, &intermediate_symlink).expect("create intermediate symlink to file");

        let parent_dir = intermediate_symlink
            .join("nvim")
            .to_string_lossy()
            .into_owned();
        let output_path = format!("{parent_dir}/init.lua");
        let msg = assert_deploy_parent_creation_failed(deploy_to_path(
            parent_dir,
            output_path.clone(),
            "-- Generated by vinela\n".to_string(),
        ));

        assert!(
            msg.contains(&intermediate_symlink.display().to_string()),
            "message must name raw intermediate symlink, got: {}",
            msg
        );
        assert!(
            msg.contains("symbolic link whose target is not a directory"),
            "message must name symlink-to-file reason, got: {}",
            msg
        );
        assert!(
            !output_path_exists(&output_path),
            "init.lua must not be written when intermediate symlink targets a file"
        );
        assert_symlink_unchanged(&intermediate_symlink, &target_file);
    }

    fn unique_external_fixture_root() -> PathBuf {
        let home = real_home();
        let canonical_home = std::fs::canonicalize(&home).unwrap_or(home);
        let parent = std::env::temp_dir().join(format!(
            "vinela-outside-home-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&parent).expect("create external fixture parent");
        let canonical_parent =
            std::fs::canonicalize(&parent).expect("canonicalize external parent");
        assert!(
            !canonical_parent.starts_with(&canonical_home),
            "external fixture parent must be outside canonical HOME"
        );
        parent
    }

    #[cfg(unix)]
    #[test]
    fn deploy_to_path_rejects_symlink_target_outside_home_before_write() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("outside-home-symlink");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let external_root = unique_external_fixture_root();
        let _external_guard = FixtureGuard::new(external_root.clone());
        let outside_missing = external_root.join("outside-nvim");

        let escape_link = fixture_root.join("escape");
        symlink(&outside_missing, &escape_link).expect("create outside-home symlink");

        let parent_dir = escape_link.join("nvim").to_string_lossy().into_owned();
        let output_path = escape_link
            .join("nvim")
            .join("init.lua")
            .to_string_lossy()
            .into_owned();
        let outside_output = outside_missing.join("init.lua");

        let result = deploy_to_path(
            parent_dir,
            output_path.clone(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(
            result.is_err(),
            "expected validation failure, got: {:?}",
            result
        );
        let msg = result.unwrap_err();
        assert!(
            msg.contains("not under") || msg.starts_with("Failed to create parent directory"),
            "expected home-boundary rejection, got: {}",
            msg
        );
        assert!(
            !output_path_exists(&output_path),
            "init.lua must not be written when symlink escapes home"
        );
        assert!(
            !outside_output.exists(),
            "outside-home target must not receive output"
        );
        assert_symlink_unchanged(&escape_link, &outside_missing);
    }

    #[cfg(unix)]
    #[test]
    fn output_file_symlink_deploy_rejects_dangling_leaf_to_outside_home_without_creating_target() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("output-leaf-outside");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent dir");

        let external_root = unique_external_fixture_root();
        let _external_guard = FixtureGuard::new(external_root.clone());
        let outside_missing = external_root.join("missing-init.lua");

        let output_path = fixture_root.join("nvim").join("init.lua");
        symlink(&outside_missing, &output_path).expect("create dangling output leaf symlink");

        let result = deploy_to_path(
            fixture_root.join("nvim").to_string_lossy().into_owned(),
            output_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err(), "expected output-file symlink rejection");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("will not write through output-file symlinks"),
            "got: {}",
            msg
        );
        assert!(!outside_missing.exists());
        assert_symlink_unchanged(&output_path, &outside_missing);
    }

    #[cfg(unix)]
    #[test]
    fn output_file_symlink_deploy_rejects_in_home_dangling_leaf_without_creating_target() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("output-leaf-in-home");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent dir");

        let in_home_missing = fixture_root.join("missing-init.lua");
        let output_path = fixture_root.join("nvim").join("init.lua");
        symlink(&in_home_missing, &output_path).expect("create in-home dangling leaf symlink");

        let result = deploy_to_path(
            fixture_root.join("nvim").to_string_lossy().into_owned(),
            output_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err(), "expected in-home dangling leaf rejection");
        assert!(result
            .unwrap_err()
            .contains("will not write through output-file symlinks"));
        assert!(!in_home_missing.exists());
        assert_symlink_unchanged(&output_path, &in_home_missing);
    }

    #[cfg(unix)]
    #[test]
    fn output_file_symlink_write_text_file_direct_rejects_existing_leaf() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("direct-write-leaf");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent dir");

        let target_file = fixture_root.join("real-init.lua");
        std::fs::write(&target_file, "keep me").expect("create target file");
        let output_path = fixture_root.join("nvim").join("init.lua");
        symlink(&target_file, &output_path).expect("create leaf symlink");

        let result = write_text_file_direct(
            output_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("will not write through output-file symlinks"));
        assert_eq!(
            std::fs::read_to_string(&target_file).expect("target unchanged"),
            "keep me"
        );
        assert_symlink_unchanged(&output_path, &target_file);
    }

    fn output_path_exists(path: &str) -> bool {
        PathBuf::from(path).exists()
    }

    // ── validated_directory resolution and creation seams ───────────────────

    fn unique_cache_fixture(suffix: &str) -> PathBuf {
        let home = real_home();
        home.join(".cache")
            .join(format!("vinela-dir-test-{suffix}-{}", std::process::id()))
    }

    fn cleanup_fixture(root: &Path) {
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn validated_directory_resolve_returns_missing_suffix_for_absent_path() {
        let home = real_home();
        let unique = unique_deploy_fixture("resolver-absent");
        let missing = home
            .join(".cache")
            .join(unique)
            .join("missing")
            .join("nvim");
        let result = resolve_directory_target_under_home(&missing);
        assert!(result.is_ok(), "resolver failed: {:?}", result);
        let resolved = result.unwrap();
        assert!(!resolved.missing_components.is_empty());
    }

    #[test]
    fn validated_directory_skips_creation_when_directory_exists() {
        let root = unique_cache_fixture("existing-dir");
        cleanup_fixture(&root);
        let dir = root.join("nvim");
        std::fs::create_dir_all(&dir).expect("create fixture directory");

        let mut create_calls = 0u32;
        let result = prepare_directory_under_home_with(&dir, |path| {
            create_calls += 1;
            panic!(
                "create_directory must not be called for {:?}, got call",
                path
            );
        });

        assert!(result.is_ok(), "expected Ok, got: {:?}", result);
        assert_eq!(create_calls, 0, "create_directory must not be invoked");
        assert!(dir.is_dir());

        cleanup_fixture(&root);
    }

    #[test]
    fn validated_directory_accepts_already_exists_after_fresh_directory_metadata() {
        let root = unique_cache_fixture("already-exists-dir");
        cleanup_fixture(&root);
        std::fs::create_dir_all(&root).expect("create fixture root");
        let dir = root.join("nvim");

        let result = prepare_directory_under_home_with(&dir, |path| {
            assert_eq!(path, dir.as_path());
            std::fs::create_dir(path).expect("injected create creates directory");
            Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                "sentinel already exists after directory creation",
            ))
        });

        assert!(result.is_ok(), "expected Ok, got: {:?}", result);
        assert!(dir.is_dir());

        cleanup_fixture(&root);
    }

    #[test]
    fn authorization_changed_validated_directory_rejects_already_exists_when_still_missing() {
        let root = unique_cache_fixture("already-exists-missing");
        cleanup_fixture(&root);
        let dir = root.join("nvim");

        let result = prepare_directory_under_home_with(&dir, |_path| {
            Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                "sentinel already exists without creating directory",
            ))
        });

        assert!(result.is_err(), "expected Err for unresolved AlreadyExists");
        assert!(!dir.exists());

        cleanup_fixture(&root);
    }

    #[test]
    fn authorization_changed_validated_directory_rejects_already_exists_when_non_directory() {
        let root = unique_cache_fixture("already-exists-file");
        cleanup_fixture(&root);
        std::fs::create_dir_all(&root).expect("create fixture root");
        let dir = root.join("nvim");

        let result = prepare_directory_under_home_with(&dir, |path| {
            std::fs::write(path, "not a directory").expect("create blocking file");
            Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                "sentinel already exists with blocking file",
            ))
        });

        assert!(
            result.is_err(),
            "expected Err for non-directory revalidation"
        );
        assert!(dir.is_file());

        cleanup_fixture(&root);
    }

    #[test]
    fn validated_directory_rejects_initial_non_directory_without_creation() {
        let root = unique_cache_fixture("initial-file");
        cleanup_fixture(&root);
        std::fs::create_dir_all(&root).expect("create fixture root");
        let blocking_file = root.join("blocking");
        std::fs::write(&blocking_file, "keep me").expect("create blocking file");

        let mut create_calls = 0u32;
        let result = prepare_directory_under_home_with(&blocking_file, |path| {
            create_calls += 1;
            panic!(
                "create_directory must not be called for {:?}, got call",
                path
            );
        });

        assert!(result.is_err(), "expected Err for initial non-directory");
        assert_eq!(create_calls, 0, "create_directory must not be invoked");
        assert!(blocking_file.is_file());
        assert_eq!(
            std::fs::read_to_string(&blocking_file).expect("read blocking file"),
            "keep me"
        );

        cleanup_fixture(&root);
    }

    #[test]
    fn validated_directory_is_idempotent_on_existing_directory() {
        let root = unique_cache_fixture("mkdir-idempotent");
        cleanup_fixture(&root);
        let dir = root.join("existing");
        std::fs::create_dir_all(&dir).expect("create fixture directory");

        let first = prepare_directory_under_home(&dir);
        let second = prepare_directory_under_home(&dir);
        assert!(first.is_ok(), "first prepare failed: {:?}", first);
        assert!(second.is_ok(), "second prepare failed: {:?}", second);
        assert!(dir.is_dir());

        cleanup_fixture(&root);
    }

    #[cfg(unix)]
    #[test]
    fn authorization_changed_rejects_appeared_suffix_symlink_before_create() {
        use std::os::unix::fs::symlink;

        let _home = real_home();
        let root = unique_cache_fixture("appeared-symlink");
        cleanup_fixture(&root);
        std::fs::create_dir_all(&root).expect("create root");
        let requested = root.join("child");

        let resolved = resolve_directory_target_under_home(&requested).expect("resolve");
        assert_eq!(resolved.missing_components.len(), 1);

        let appeared = root.join("child");
        let elsewhere_target = root.join("elsewhere");
        symlink(&elsewhere_target, &appeared).expect("insert suffix symlink");

        let canonical_home = canonical_home_path().expect("home");
        let result = create_validated_directory_with(&resolved, &canonical_home, |path| {
            panic!(
                "create_directory must not run for appeared symlink at {:?}",
                path
            );
        });
        assert!(matches!(
            result,
            Err(DirectoryPreparationError::AuthorizationChanged { .. })
        ));
        assert_symlink_unchanged(&appeared, &elsewhere_target);

        cleanup_fixture(&root);
    }

    // ── write_text_creating_parent (real temp filesystem) ───────────────────

    #[test]
    fn test_write_text_creating_parent_reuses_existing_parent_directory() {
        let home = real_home();
        let unique = format!("vinela-write-parent-existing-test-{}", std::process::id());
        let root = home.join(".cache").join(unique);
        let parent = root.join("existing").join("nvim");
        std::fs::create_dir_all(&parent).expect("pre-create parent directory");

        let target = parent.join("init.lua");
        let content = "-- Generated by vinela\nprint('existing parent')\n";
        let result = write_text_creating_parent(&target, content);
        assert!(result.is_ok(), "write failed: {:?}", result);
        assert_eq!(result.unwrap(), content.len());

        let read_back = std::fs::read_to_string(&target).expect("read back written file");
        assert_eq!(read_back, content);
        assert!(parent.is_dir());

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn test_write_text_creating_parent_creates_nested_directories() {
        let home = real_home();
        let unique = format!("vinela-write-parent-test-{}", std::process::id());
        let root = home.join(".cache").join(unique);
        let target = root.join("missing").join("deep").join("init.lua");
        let content = "-- Generated by vinela\nprint('ok')\n";

        let first = write_text_creating_parent(&target, content);
        assert!(first.is_ok(), "first write failed: {:?}", first);
        assert_eq!(first.unwrap(), content.len());

        let read_back = std::fs::read_to_string(&target).expect("read back written file");
        assert_eq!(read_back, content);

        let replacement = "-- Generated by vinela\nprint('updated')\n";
        let second = write_text_creating_parent(&target, replacement);
        assert!(second.is_ok(), "second write failed: {:?}", second);
        assert_eq!(second.unwrap(), replacement.len());

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn test_write_text_creating_parent_rejects_file_parent() {
        let home = real_home();
        let unique = format!("vinela-write-parent-file-test-{}", std::process::id());
        let root = home.join(".cache").join(unique);
        let blocking_file = root.join("blocking");
        std::fs::create_dir_all(&root).expect("create temp root");
        std::fs::write(&blocking_file, "not a directory").expect("create blocking file");

        let target = blocking_file.join("init.lua");
        let result = write_text_creating_parent(&target, "content");
        assert!(result.is_err(), "expected parent creation failure");
        let msg = result.unwrap_err();
        assert!(
            msg.starts_with("Failed to create parent directory"),
            "got: {}",
            msg
        );
        assert!(
            !target.exists(),
            "target must not be written when parent is blocked"
        );

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn test_mkdir_direct_is_idempotent_on_existing_directory() {
        let home = real_home();
        let unique = format!("vinela-mkdir-direct-idempotent-{}", std::process::id());
        let dir = home.join(".cache").join(unique);
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("pre-create directory");

        let path = dir.to_string_lossy().into_owned();
        let first = mkdir_direct(path.clone());
        let second = mkdir_direct(path);
        assert!(first.is_ok(), "first mkdir_direct failed: {:?}", first);
        assert!(second.is_ok(), "second mkdir_direct failed: {:?}", second);
        assert!(dir.is_dir());

        let _ = std::fs::remove_dir_all(&dir);
    }

    // ── test helpers for symlink fixtures ───────────────────────────────────

    #[cfg(unix)]
    fn assert_symlink_unchanged(path: &Path, expected_stored_target: &Path) {
        let meta = std::fs::symlink_metadata(path).expect("symlink metadata");
        assert!(meta.is_symlink(), "expected symlink at {:?}", path);
        assert_eq!(
            std::fs::read_link(path).expect("read link"),
            expected_stored_target,
            "stored target must be unchanged at {:?}",
            path
        );
    }

    #[cfg(unix)]
    fn relative_stored_target(from: &Path, to: &Path) -> PathBuf {
        let from = from.parent().expect("link parent");
        let from_components: Vec<_> = from.components().collect();
        let to_components: Vec<_> = to.components().collect();
        let mut shared = 0usize;
        while shared < from_components.len()
            && shared < to_components.len()
            && from_components[shared] == to_components[shared]
        {
            shared += 1;
        }
        let mut result = PathBuf::new();
        for _ in shared..from_components.len() {
            result.push("..");
        }
        for component in &to_components[shared..] {
            result.push(component.as_os_str());
        }
        result
    }

    #[cfg(unix)]
    fn build_directory_symlink_chain(
        root: &Path,
        count: usize,
        terminal: &Path,
    ) -> Vec<(PathBuf, PathBuf)> {
        use std::os::unix::fs::symlink;

        let mut links = Vec::new();
        let mut previous = terminal.to_path_buf();
        for index in (0..count).rev() {
            let link_path = root.join(format!("link-{index}"));
            symlink(&previous, &link_path).expect("create chain link");
            links.push((link_path.clone(), previous.clone()));
            previous = link_path;
        }
        links.reverse();
        links
    }

    // ── Phase 1/2: exact-identity postcondition regressions ─────────────────

    #[test]
    fn normalize_lexical_path_rejects_traversal_above_filesystem_root() {
        let result = normalize_lexical_path(Path::new("/../../etc/passwd"));
        assert!(matches!(
            result,
            Err(DirectoryPreparationError::InvalidRawPath { reason, .. })
                if reason == "path normalizes above filesystem root"
        ));
    }

    #[test]
    fn invalid_leaf_rejects_filesystem_root() {
        let home = real_home();
        let parent = home
            .join(".cache")
            .join(unique_deploy_fixture("invalid-leaf-root"));
        std::fs::create_dir_all(&parent).expect("create parent");
        let _guard = FixtureGuard::new(parent.clone());

        let root = PathBuf::from(std::path::MAIN_SEPARATOR_STR);
        let result = validate_file_target(&root, &parent);
        assert!(matches!(result, Err(FileTargetError::InvalidLeaf { .. })));
    }

    #[test]
    fn invalid_leaf_rejects_trailing_separator() {
        let home = real_home();
        let parent = home
            .join(".cache")
            .join(unique_deploy_fixture("invalid-leaf-trailing"));
        std::fs::create_dir_all(&parent).expect("create parent");
        let _guard = FixtureGuard::new(parent.clone());

        let trailing = parent.join(format!("init.lua{}", std::path::MAIN_SEPARATOR));
        let result = validate_file_target(&trailing, &parent);
        assert!(matches!(result, Err(FileTargetError::InvalidLeaf { .. })));
    }

    #[test]
    fn invalid_leaf_rejects_terminal_dot_component() {
        let home = real_home();
        let parent = home
            .join(".cache")
            .join(unique_deploy_fixture("invalid-leaf-dot"));
        std::fs::create_dir_all(&parent).expect("create parent");
        let _guard = FixtureGuard::new(parent.clone());

        let mut terminal_dot = parent.join("init.lua").into_os_string();
        terminal_dot.push(std::path::MAIN_SEPARATOR_STR);
        terminal_dot.push(".");
        let terminal_dot = PathBuf::from(terminal_dot);
        let result = validate_file_target(&terminal_dot, &parent);
        assert!(matches!(result, Err(FileTargetError::InvalidLeaf { .. })));
    }

    #[test]
    fn invalid_leaf_accepts_ordinary_file_name() {
        let home = real_home();
        let parent = home
            .join(".cache")
            .join(unique_deploy_fixture("invalid-leaf-ok"));
        std::fs::create_dir_all(&parent).expect("create parent");
        let _guard = FixtureGuard::new(parent.clone());

        let output = parent.join("init.lua");
        let result = validate_file_target(&output, &parent);
        assert!(
            result.is_ok(),
            "ordinary leaf must be accepted: {:?}",
            result
        );
    }

    #[cfg(unix)]
    #[test]
    fn invalid_leaf_accepts_backslash_in_unix_filename() {
        use std::os::unix::ffi::OsStrExt;

        let home = real_home();
        let parent = home
            .join(".cache")
            .join(unique_deploy_fixture("invalid-leaf-backslash"));
        std::fs::create_dir_all(&parent).expect("create parent");
        let _guard = FixtureGuard::new(parent.clone());

        let cases: &[&[u8]] = &[
            b"init.lua\\",
            b"init.lua\\.",
            b"directory-looking\\init.lua",
        ];

        for leaf_bytes in cases {
            let leaf = std::ffi::OsStr::from_bytes(leaf_bytes);
            let output = parent.join(leaf);
            let validated = validate_file_target(&output, &parent)
                .unwrap_or_else(|err| panic!("leaf {:?} must be accepted, got: {:?}", leaf, err));
            assert_eq!(
                validated.write_path,
                parent.join(leaf),
                "write path must preserve exact leaf bytes"
            );

            let content = format!("-- Generated by vinela\nleaf={:?}\n", leaf);
            let write_result = write_text_creating_parent_with(
                &output,
                &content,
                |_target, _parent| Ok(()),
                |path, bytes| std::fs::write(path, bytes).map(|_| ()),
            );
            assert!(
                write_result.is_ok(),
                "write pipeline must succeed for leaf {:?}: {:?}",
                leaf,
                write_result
            );

            let read_back = std::fs::read(&validated.write_path).expect("read exact path");
            assert_eq!(read_back, content.as_bytes());
            assert!(
                !parent.join("init.lua").exists(),
                "no separator-derived alternate path for leaf {:?}",
                leaf
            );
        }
    }

    #[cfg(windows)]
    #[test]
    fn invalid_leaf_rejects_windows_dual_separator_spellings() {
        let home = real_home();
        let parent = home
            .join(".cache")
            .join(unique_deploy_fixture("invalid-leaf-windows-sep"));
        std::fs::create_dir_all(&parent).expect("create parent");
        let _guard = FixtureGuard::new(parent.clone());

        let cases: &[&str] = &["init.lua/", "init.lua\\", "init.lua/.", "init.lua\\."];
        for leaf in cases {
            let output = parent.join(leaf);
            let result = validate_file_target(&output, &parent);
            assert!(
                matches!(result, Err(FileTargetError::InvalidLeaf { .. })),
                "leaf {:?} must be rejected on Windows, got: {:?}",
                leaf,
                result
            );
        }
    }

    #[test]
    fn invalid_leaf_write_pipeline_rejects_without_mutation() {
        let home = real_home();
        let unique = unique_deploy_fixture("invalid-leaf-write");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let trailing = fixture_root.join(format!("init.lua{}", std::path::MAIN_SEPARATOR));
        let mut writer_called = false;
        let result = write_text_creating_parent_with(
            &trailing,
            "content",
            |_target, _parent| Ok(()),
            |_path, _bytes| {
                writer_called = true;
                Ok(())
            },
        );
        assert!(result.is_err(), "trailing separator must fail before write");
        assert!(!writer_called, "writer must not run for invalid leaf");
        assert!(
            !fixture_root.join("init.lua").exists(),
            "no leaf file must be created"
        );
    }

    #[cfg(unix)]
    #[test]
    fn authorization_changed_rejects_in_home_ancestor_retarget_inside_create() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("ancestor-retarget");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());

        let dir_a = fixture_root.join("a");
        let dir_b = fixture_root.join("b");
        std::fs::create_dir_all(&dir_a).expect("create a");
        std::fs::create_dir_all(&dir_b).expect("create b");

        let requested = dir_a.join("child").join("grandchild");
        let resolved = resolve_directory_target_under_home(&requested).expect("resolve");
        let canonical_home = canonical_home_path().expect("home");

        let mut create_calls: Vec<PathBuf> = Vec::new();
        let result = create_validated_directory_with(&resolved, &canonical_home, |path| {
            create_calls.push(path.to_path_buf());
            if create_calls.len() == 1 {
                std::fs::remove_dir(&dir_a).expect("remove a");
                symlink(&dir_b, &dir_a).expect("retarget a to b");
                std::fs::create_dir(path).expect("create child through retargeted parent");
            } else {
                panic!("must not create grandchild after identity mismatch");
            }
            Ok(())
        });
        assert!(
            matches!(
                result,
                Err(DirectoryPreparationError::AuthorizationChanged { .. })
            ),
            "expected AuthorizationChanged, got: {:?}",
            result
        );
        assert_eq!(
            create_calls.len(),
            1,
            "only first component may be attempted"
        );

        // Residual side effect: b/child may exist after the raced create.
        let _ = dir_b.join("child").exists();
    }

    #[cfg(unix)]
    #[test]
    fn authorization_changed_rejects_empty_suffix_identity_retarget() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("empty-suffix-retarget");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());

        let original = fixture_root.join("original");
        let replacement = fixture_root.join("replacement");
        std::fs::create_dir_all(&original).expect("create original");
        std::fs::create_dir_all(&replacement).expect("create replacement");

        let resolved = resolve_directory_target_under_home(&original).expect("resolve");
        assert!(resolved.missing_components.is_empty());

        std::fs::remove_dir(&original).expect("remove original");
        symlink(&replacement, &original).expect("retarget original");

        let canonical_home = canonical_home_path().expect("home");
        let mut create_calls = 0u32;
        let result = create_validated_directory_with(&resolved, &canonical_home, |_path| {
            create_calls += 1;
            Ok(())
        });
        assert!(
            matches!(
                result,
                Err(DirectoryPreparationError::AuthorizationChanged { .. })
            ),
            "expected AuthorizationChanged, got: {:?}",
            result
        );
        assert_eq!(create_calls, 0, "no create calls on empty-suffix retarget");
    }

    #[cfg(unix)]
    #[test]
    fn write_pipeline_rejects_raw_parent_retarget_before_file_validation() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("raw-parent-retarget-before");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let real_parent = fixture_root.join("real-parent");
        let alias_parent = fixture_root.join("alias-parent");
        let alternate_parent = fixture_root.join("alternate-parent");
        std::fs::create_dir_all(&real_parent).expect("create real parent");
        std::fs::create_dir_all(&alternate_parent).expect("create alternate parent");
        symlink(&real_parent, &alias_parent).expect("create parent alias");

        let output_path = alias_parent.join("init.lua");
        let content = "-- Generated by vinela\nprint('retarget before validate')\n";
        let mut writer_called = false;

        let result = write_text_creating_parent_with(
            &output_path,
            content,
            |_target, _canonical_parent| {
                std::fs::remove_dir(&alias_parent).ok();
                let _ = std::fs::remove_file(&alias_parent);
                symlink(&alternate_parent, &alias_parent).expect("retarget alias");
                Ok(())
            },
            |_path, _bytes| {
                writer_called = true;
                Ok(())
            },
        );

        assert!(result.is_err(), "retarget before validation must fail");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("authorized output parent") || msg.contains("no longer matches"),
            "expected ParentMismatch mapping, got: {}",
            msg
        );
        assert!(!writer_called, "writer must not run");
        assert!(
            !real_parent.join("init.lua").exists(),
            "original target must not receive output"
        );
        assert!(
            !alternate_parent.join("init.lua").exists(),
            "retargeted parent must not receive output"
        );
    }

    #[cfg(unix)]
    #[test]
    fn write_pipeline_uses_authorized_canonical_path_after_raw_parent_retarget() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("raw-parent-retarget-writer");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let real_parent = fixture_root.join("real-parent");
        let alias_parent = fixture_root.join("alias-parent");
        let alternate_parent = fixture_root.join("alternate-parent");
        std::fs::create_dir_all(&real_parent).expect("create real parent");
        std::fs::create_dir_all(&alternate_parent).expect("create alternate parent");
        symlink(&real_parent, &alias_parent).expect("create parent alias");

        let output_path = alias_parent.join("init.lua");
        let content = "-- Generated by vinela\nprint('canonical writer path')\n";
        let authorized_write_path = std::fs::canonicalize(&real_parent)
            .expect("canonical real parent")
            .join("init.lua");
        let mut observed_write_path: Option<PathBuf> = None;

        let result = write_text_creating_parent_with(
            &output_path,
            content,
            |_target, _canonical_parent| Ok(()),
            |path, bytes| {
                observed_write_path = Some(path.to_path_buf());
                std::fs::remove_dir(&alias_parent).ok();
                let _ = std::fs::remove_file(&alias_parent);
                symlink(&alternate_parent, &alias_parent).expect("retarget alias");
                std::fs::write(path, bytes)
            },
        );

        assert!(result.is_ok(), "write must succeed: {:?}", result);
        assert_eq!(observed_write_path, Some(authorized_write_path.clone()));
        assert_eq!(
            std::fs::read_to_string(&authorized_write_path).expect("read authorized path"),
            content
        );
        assert!(
            !alternate_parent.join("init.lua").exists(),
            "retargeted parent must not receive output"
        );
    }

    // ── Phase 3/4: hop limit, cycles, chains, relative escape ───────────────

    #[cfg(unix)]
    #[test]
    fn symlink_hop_limit_allows_exactly_forty_expansions() {
        let home = real_home();
        let unique = unique_deploy_fixture("symlink-hop-40");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let terminal = fixture_root.join("terminal");
        std::fs::create_dir_all(&terminal).expect("create terminal");
        let links = build_directory_symlink_chain(&fixture_root, 40, &terminal);
        let entry = links.first().expect("chain entry").0.clone();

        let result = resolve_directory_target_under_home(&entry);
        assert!(result.is_ok(), "40-hop chain must resolve: {:?}", result);

        for (link, stored_target) in &links {
            assert_symlink_unchanged(link, stored_target);
        }
    }

    #[cfg(unix)]
    #[test]
    fn symlink_hop_limit_rejects_forty_first_expansion() {
        let home = real_home();
        let unique = unique_deploy_fixture("symlink-hop-41");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let terminal = fixture_root.join("terminal");
        std::fs::create_dir_all(&terminal).expect("create terminal");
        let links = build_directory_symlink_chain(&fixture_root, 41, &terminal);
        let entry = links.first().expect("chain entry").0.clone();

        let result = resolve_directory_target_under_home(&entry);
        assert!(
            matches!(
                result,
                Err(DirectoryPreparationError::SymlinkHopLimit { limit: 40 })
            ),
            "41-hop chain must fail at hop limit: {:?}",
            result
        );

        for (link, stored_target) in &links {
            assert_symlink_unchanged(link, stored_target);
        }
    }

    #[cfg(unix)]
    #[test]
    fn symlink_cycle_rejects_two_link_directory_cycle_without_mutation() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("symlink-cycle");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let link_a = fixture_root.join("a");
        let link_b = fixture_root.join("b");
        symlink("b", &link_a).expect("create a -> b");
        symlink("a", &link_b).expect("create b -> a");

        let requested = link_a.join("nvim");
        let result = prepare_directory_under_home(&requested);
        assert!(
            matches!(result, Err(DirectoryPreparationError::SymlinkCycle { .. })),
            "cycle must be rejected: {:?}",
            result
        );
        assert_symlink_unchanged(&link_a, Path::new("b"));
        assert_symlink_unchanged(&link_b, Path::new("a"));
        assert!(!requested.exists(), "no output directory must be created");
    }

    #[cfg(unix)]
    #[test]
    fn deploy_short_directory_symlink_chain_creates_missing_target_and_preserves_links() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("short-chain");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let missing_target = fixture_root.join("real-config").join("nvim");
        let link_two = fixture_root.join("link-two");
        let link_one = fixture_root.join("link-one");
        symlink(&missing_target, &link_two).expect("create link-two");
        symlink(&link_two, &link_one).expect("create link-one");

        let parent_dir = link_one.to_string_lossy().into_owned();
        let output_path = link_one.join("init.lua").to_string_lossy().into_owned();
        let code = "-- Generated by vinela\nprint('short chain')\n";

        let result = deploy_to_path(parent_dir, output_path.clone(), code.to_string());
        assert!(result.is_ok(), "short chain deploy failed: {:?}", result);
        assert_eq!(result.unwrap(), code.as_bytes().len());
        assert_eq!(
            std::fs::read_to_string(missing_target.join("init.lua")).expect("read target"),
            code
        );
        assert_symlink_unchanged(&link_one, &link_two);
        assert_symlink_unchanged(&link_two, &missing_target);
    }

    #[cfg(unix)]
    #[test]
    fn relative_outside_directory_escape_rejects_before_outside_artifact() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("relative-outside-dir");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let external_root = unique_external_fixture_root();
        let _external_guard = FixtureGuard::new(external_root.clone());
        let outside_target = external_root.join("outside-nvim");

        let escape_link = fixture_root.join("escape");
        let stored_target = relative_stored_target(&escape_link, &outside_target);
        symlink(&stored_target, &escape_link).expect("create relative escape link");

        let parent_dir = escape_link.join("nvim").to_string_lossy().into_owned();
        let output_path = escape_link
            .join("nvim")
            .join("init.lua")
            .to_string_lossy()
            .into_owned();

        let result = deploy_to_path(
            parent_dir,
            output_path,
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err(), "relative outside escape must fail");
        assert!(
            !outside_target.exists(),
            "outside target must not be created"
        );
        assert_symlink_unchanged(&escape_link, &stored_target);
    }

    #[cfg(unix)]
    #[test]
    fn deploy_rejects_stored_symlink_target_traversing_above_root() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("above-root-target");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let escape_link = fixture_root.join("escape");
        let stored_target = PathBuf::from("/../../etc/passwd");
        symlink(&stored_target, &escape_link).expect("create above-root target link");

        let result = resolve_directory_target_under_home(&escape_link);
        assert!(result.is_err(), "above-root stored target must fail");
        let msg = format_directory_preparation_error(&result.unwrap_err());
        assert!(
            msg.contains("normalizes above filesystem root"),
            "expected normalization failure, got: {}",
            msg
        );
        assert_symlink_unchanged(&escape_link, &stored_target);
        assert!(
            !fixture_root.join("etc").exists(),
            "must not create clamped suffix under fixture"
        );
    }

    #[cfg(unix)]
    #[test]
    fn write_text_file_direct_succeeds_through_dangling_parent_symlink() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("direct-write-dangling");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let missing_target = fixture_root.join("dotfiles").join("nvim-config");
        let dangling_parent = fixture_root.join("nvim");
        symlink(&missing_target, &dangling_parent).expect("create dangling parent");

        let output_path = dangling_parent.join("init.lua");
        let code = "-- Generated by vinela\nprint('direct write dangling')\n";
        let result =
            write_text_file_direct(output_path.to_string_lossy().into_owned(), code.to_string());
        assert!(result.is_ok(), "direct write failed: {:?}", result);
        assert_eq!(result.unwrap(), code.as_bytes().len());
        assert_eq!(
            std::fs::read_to_string(missing_target.join("init.lua")).expect("read target"),
            code
        );
        assert_symlink_unchanged(&dangling_parent, &missing_target);
    }

    #[cfg(unix)]
    #[test]
    fn mkdir_direct_creates_suffix_through_dangling_parent_symlink() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("mkdir-direct-dangling");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root).expect("create fixture root");

        let missing_target = fixture_root
            .join("dotfiles")
            .join("nvim-config")
            .join("nvim");
        let dangling_parent = fixture_root.join("nvim");
        symlink(&missing_target, &dangling_parent).expect("create dangling parent");

        let requested = dangling_parent.join("extra");
        let result = mkdir_direct(requested.to_string_lossy().into_owned());
        assert!(result.is_ok(), "mkdir_direct failed: {:?}", result);
        assert!(missing_target.join("extra").is_dir());
        assert_symlink_unchanged(&dangling_parent, &missing_target);
    }

    // ── Phase 5: final-file object variants ─────────────────────────────────

    #[cfg(unix)]
    #[test]
    fn output_file_symlink_rejects_relative_dangling_leaf_outside_home() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("leaf-relative-outside");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent");

        let external_root = unique_external_fixture_root();
        let _external_guard = FixtureGuard::new(external_root.clone());
        let outside_missing = external_root.join("missing-init.lua");

        let output_path = fixture_root.join("nvim").join("init.lua");
        let stored_target = relative_stored_target(&output_path, &outside_missing);
        symlink(&stored_target, &output_path).expect("create relative outside leaf");

        let result = deploy_to_path(
            fixture_root.join("nvim").to_string_lossy().into_owned(),
            output_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err());
        assert!(!outside_missing.exists());
        assert_symlink_unchanged(&output_path, &stored_target);
    }

    #[cfg(unix)]
    #[test]
    fn output_file_symlink_rejects_relative_dangling_leaf_in_home() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("leaf-relative-in-home");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent");

        let in_home_missing = fixture_root.join("missing-init.lua");
        let output_path = fixture_root.join("nvim").join("init.lua");
        let stored_target = relative_stored_target(&output_path, &in_home_missing);
        symlink(&stored_target, &output_path).expect("create relative in-home leaf");

        let result = deploy_to_path(
            fixture_root.join("nvim").to_string_lossy().into_owned(),
            output_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("will not write through output-file symlinks"));
        assert!(!in_home_missing.exists());
        assert_symlink_unchanged(&output_path, &stored_target);
    }

    #[cfg(unix)]
    #[test]
    fn output_file_symlink_rejects_existing_outside_home_target_file() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("leaf-outside-file");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent");

        let external_root = unique_external_fixture_root();
        let _external_guard = FixtureGuard::new(external_root.clone());
        let outside_file = external_root.join("outside-init.lua");
        std::fs::write(&outside_file, "keep outside bytes").expect("create outside file");

        let output_path = fixture_root.join("nvim").join("init.lua");
        symlink(&outside_file, &output_path).expect("create leaf to outside file");

        let result = deploy_to_path(
            fixture_root.join("nvim").to_string_lossy().into_owned(),
            output_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err());
        assert_eq!(
            std::fs::read_to_string(&outside_file).expect("outside bytes preserved"),
            "keep outside bytes"
        );
        assert_symlink_unchanged(&output_path, &outside_file);
    }

    #[cfg(unix)]
    #[test]
    fn output_file_symlink_chain_rejects_at_first_leaf() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("leaf-chain");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent");

        let final_target = fixture_root.join("final-init.lua");
        let intermediate = fixture_root.join("intermediate-init.lua");
        let output_path = fixture_root.join("nvim").join("init.lua");
        symlink(&final_target, &intermediate).expect("create intermediate leaf");
        symlink(&intermediate, &output_path).expect("create output leaf chain");

        let result = deploy_to_path(
            fixture_root.join("nvim").to_string_lossy().into_owned(),
            output_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err());
        assert_symlink_unchanged(&output_path, &intermediate);
        assert_symlink_unchanged(&intermediate, &final_target);
        assert!(!final_target.exists());
    }

    #[cfg(unix)]
    #[test]
    fn output_file_symlink_cycle_rejects_without_traversal() {
        use std::os::unix::fs::symlink;

        let home = real_home();
        let unique = unique_deploy_fixture("leaf-cycle");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent");

        let output_path = fixture_root.join("nvim").join("init.lua");
        let link_b = fixture_root.join("nvim").join("leaf-b");
        symlink("leaf-b", &output_path).expect("create leaf a -> b");
        symlink("init.lua", &link_b).expect("create leaf b -> a");

        let result = deploy_to_path(
            fixture_root.join("nvim").to_string_lossy().into_owned(),
            output_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err());
        assert_symlink_unchanged(&output_path, Path::new("leaf-b"));
        assert_symlink_unchanged(&link_b, Path::new("init.lua"));
    }

    #[test]
    fn output_file_directory_rejects_without_replacing_directory() {
        let home = real_home();
        let unique = unique_deploy_fixture("leaf-directory");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent");
        std::fs::create_dir_all(fixture_root.join("nvim").join("init.lua"))
            .expect("create directory leaf");

        let output_path = fixture_root.join("nvim").join("init.lua");
        let result = deploy_to_path(
            fixture_root.join("nvim").to_string_lossy().into_owned(),
            output_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("is a directory, not a file"));
        assert!(output_path.is_dir(), "directory leaf must remain");
    }

    #[cfg(unix)]
    #[test]
    fn output_file_unix_socket_rejects_without_replacement() {
        use std::os::unix::fs::FileTypeExt;
        use std::os::unix::net::UnixListener;

        let home = real_home();
        let unique = unique_deploy_fixture("leaf-socket");
        let fixture_root = home.join(".cache").join(&unique);
        let _guard = FixtureGuard::new(fixture_root.clone());
        std::fs::create_dir_all(&fixture_root.join("nvim")).expect("create parent");

        let socket_path = fixture_root.join("nvim").join("init.lua");
        let _listener = UnixListener::bind(&socket_path).expect("bind socket");

        let result = deploy_to_path(
            fixture_root.join("nvim").to_string_lossy().into_owned(),
            socket_path.to_string_lossy().into_owned(),
            "-- Generated by vinela\n".to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("is not a regular file"));
        assert!(std::fs::symlink_metadata(&socket_path)
            .expect("socket metadata")
            .file_type()
            .is_socket());
    }
}
