#!/bin/sh
# Install git hooks from .githooks/ into .git/hooks/
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_DIR="$ROOT_DIR/.githooks"
GIT_HOOKS_DIR="$ROOT_DIR/.git/hooks"

if [ ! -d "$HOOK_DIR" ]; then
  echo "No .githooks directory found; nothing to install." >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/.git" ]; then
  echo "This script must be run from a git repository root." >&2
  exit 1
fi

echo "Installing hooks from $HOOK_DIR to $GIT_HOOKS_DIR"
for hook in "$HOOK_DIR"/*; do
  name=$(basename "$hook")
  target="$GIT_HOOKS_DIR/$name"
  if [ -f "$target" ]; then
    echo "Backing up existing hook: $target -> ${target}.bak"
    mv "$target" "${target}.bak"
  fi
  cp "$hook" "$target"
  chmod +x "$target"
  echo "Installed $name"
done

echo "Hooks installed. To revert, restore any *.bak files in .git/hooks/"
