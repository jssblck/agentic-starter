#!/usr/bin/env sh
set -eu

REPO="${TODOCTL_REPO:-your-org/worktree-todo-starter}"
VERSION="${TODOCTL_VERSION:-}"
BIN_DIR="${TODOCTL_BIN_DIR:-$HOME/.local/bin}"
TMP_DIR="${TODOCTL_TMP_DIR:-${TMPDIR:-/tmp}}"

usage() {
  cat <<'EOF'
Install todoctl from a GitHub release.

Usage: install.sh [-v VERSION] [-b BIN_DIR]

Environment overrides:
  TODOCTL_REPO       owner/repository to download from
  TODOCTL_VERSION    release version, with or without v
  TODOCTL_BIN_DIR    installation directory
  TODOCTL_TMP_DIR    temporary directory parent
EOF
}

while getopts "v:b:h" option; do
  case "$option" in
    v) VERSION="$OPTARG" ;;
    b) BIN_DIR="$OPTARG" ;;
    h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "todoctl installer: required command '$1' was not found" >&2
    exit 1
  }
}

need curl
need tar

case "$(uname -s)" in
  Linux) os="linux" ;;
  Darwin) os="macos" ;;
  MINGW*|MSYS*|CYGWIN*) os="windows" ;;
  *) echo "todoctl installer: unsupported operating system $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) echo "todoctl installer: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

case "$os-$arch" in
  linux-x64) triple="x86_64-unknown-linux-gnu" ;;
  linux-arm64) triple="aarch64-unknown-linux-gnu" ;;
  macos-x64) triple="x86_64-apple-darwin" ;;
  macos-arm64) triple="aarch64-apple-darwin" ;;
  windows-x64) triple="x86_64-pc-windows-msvc" ;;
  *) echo "todoctl installer: no release is published for $os-$arch" >&2; exit 1 ;;
esac

if [ -z "$VERSION" ]; then
  VERSION="$(curl -fsSL -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$REPO/releases/latest" \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/p' \
    | head -n 1)"
fi
VERSION="${VERSION#v}"
[ -n "$VERSION" ] || { echo "todoctl installer: could not resolve a release version" >&2; exit 1; }

stem="todoctl-$triple"
if [ "$os" = "windows" ]; then
  archive="$stem.zip"
else
  archive="$stem.tar.gz"
fi
base="https://github.com/$REPO/releases/download/v$VERSION"
work="$(mktemp -d "$TMP_DIR/todoctl-install.XXXXXX")"
trap 'rm -rf "$work"' EXIT INT TERM

curl -fsSL "$base/$archive" -o "$work/$archive"
curl -fsSL "$base/checksums.txt" -o "$work/checksums.txt"
expected="$(awk -v file="$archive" '$2 == file { print $1 }' "$work/checksums.txt")"
[ -n "$expected" ] || { echo "todoctl installer: checksum for $archive is missing" >&2; exit 1; }

if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$work/$archive" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  actual="$(shasum -a 256 "$work/$archive" | awk '{print $1}')"
else
  echo "todoctl installer: sha256sum or shasum is required" >&2
  exit 1
fi
[ "$actual" = "$expected" ] || { echo "todoctl installer: checksum verification failed" >&2; exit 1; }

mkdir -p "$work/unpack" "$BIN_DIR"
if [ "$os" = "windows" ]; then
  need powershell.exe
  powershell.exe -NoProfile -Command "Expand-Archive -LiteralPath '$work/$archive' -DestinationPath '$work/unpack' -Force"
  source_binary="$work/unpack/$stem/todoctl.exe"
  destination="$BIN_DIR/todoctl.exe"
else
  tar -xzf "$work/$archive" -C "$work/unpack"
  source_binary="$work/unpack/$stem/todoctl"
  destination="$BIN_DIR/todoctl"
fi

install -m 0755 "$source_binary" "$destination" 2>/dev/null || {
  cp "$source_binary" "$destination"
  chmod 0755 "$destination"
}

echo "Installed todoctl $VERSION to $destination"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Add $BIN_DIR to PATH before running todoctl." ;;
esac
