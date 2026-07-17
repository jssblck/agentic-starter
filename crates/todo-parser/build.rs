use semver::Version;
use std::{env, process::Command};

fn command_output(args: &[&str]) -> Option<String> {
    let output = Command::new("git").args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8(output.stdout)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn normalize_release_version(value: &str) -> Option<String> {
    let value = value.trim();
    let without_prefix = value.strip_prefix('v').unwrap_or(value);
    Version::parse(without_prefix)
        .ok()
        .map(|version| version.to_string())
}

fn resolve_version() -> String {
    if let Ok(value) = env::var("PROJECT_VERSION") {
        if let Some(version) = normalize_release_version(&value) {
            return version;
        }
        panic!("PROJECT_VERSION must be a semantic version or v-prefixed tag");
    }

    if let Some(tag) =
        command_output(&["describe", "--tags", "--exact-match", "--match", "v[0-9]*"])
        && let Some(version) = normalize_release_version(&tag)
    {
        return version;
    }

    if let Some(commit) = command_output(&["rev-parse", "--short=12", "HEAD"]) {
        let dirty = command_output(&["status", "--porcelain", "--untracked-files=no"])
            .is_some_and(|status| !status.is_empty());
        return format!("0.0.0+g{commit}{}", if dirty { ".dirty" } else { "" });
    }

    env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "0.0.0+unknown".to_owned())
}

fn watch_git_path(name: &str) {
    if let Some(path) = command_output(&["rev-parse", "--git-path", name]) {
        println!("cargo:rerun-if-changed={path}");
    }
}

fn main() {
    println!("cargo:rerun-if-env-changed=PROJECT_VERSION");
    watch_git_path("HEAD");
    watch_git_path("refs/tags");
    watch_git_path("packed-refs");
    println!("cargo:rustc-env=TODO_STARTER_VERSION={}", resolve_version());
}
