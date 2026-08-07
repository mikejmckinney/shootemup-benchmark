#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/with_clean_codex_home.sh [--audit-dir DIR] -- COMMAND [ARG...]

Run COMMAND with a temporary, minimal CODEX_HOME. The wrapper copies only the
OAuth auth.json from the normal Codex home, disables optional Codex context
surfaces, and removes the temporary home when the command exits.

Environment:
  SOURCE_CODEX_HOME  Codex home containing auth.json (default: $HOME/.codex)

The optional audit directory receives the non-secret config and a manifest.
EOF
}

AUDIT_DIR=""
if [[ ${1:-} == "--audit-dir" ]]; then
  if [[ -z ${2:-} ]]; then
    echo "--audit-dir requires a directory" >&2
    exit 64
  fi
  AUDIT_DIR=$2
  shift 2
fi

if [[ ${1:-} == "--" ]]; then
  shift
fi
if [[ $# -eq 0 ]]; then
  usage >&2
  exit 64
fi

SOURCE_CODEX_DIR=${SOURCE_CODEX_HOME:-"${HOME}/.codex"}
SOURCE_AUTH_FILE="$SOURCE_CODEX_DIR/auth.json"
if [[ ! -f "$SOURCE_AUTH_FILE" ]]; then
  echo "OAuth credentials not found at $SOURCE_AUTH_FILE" >&2
  echo "Set SOURCE_CODEX_HOME to the Codex home containing auth.json." >&2
  exit 66
fi

CLEAN_CODEX_PARENT=${XDG_CACHE_HOME:-"${HOME}/.cache"}
mkdir -p "$CLEAN_CODEX_PARENT"
CLEAN_CODEX_DIR=$(mktemp -d "$CLEAN_CODEX_PARENT/shootemup-codex-clean.XXXXXX")
chmod 700 "$CLEAN_CODEX_DIR"
SOURCE_AUTH_HASH=$(sha256sum "$SOURCE_AUTH_FILE" | awk '{print $1}')

cleanup() {
  local exit_code=$?
  set +e

  # Codex can rotate OAuth credentials during a long run. Preserve the refreshed
  # file only when another process has not updated the source in the meantime.
  if [[ -f "$CLEAN_CODEX_DIR/auth.json" && -f "$SOURCE_AUTH_FILE" ]]; then
    local current_source_hash
    current_source_hash=$(sha256sum "$SOURCE_AUTH_FILE" | awk '{print $1}')
    if [[ "$current_source_hash" == "$SOURCE_AUTH_HASH" ]] && \
       ! cmp -s "$CLEAN_CODEX_DIR/auth.json" "$SOURCE_AUTH_FILE"; then
      if ! install -m 600 "$CLEAN_CODEX_DIR/auth.json" "$SOURCE_AUTH_FILE"; then
        echo "warning: could not preserve refreshed OAuth credentials" >&2
      fi
    fi
  fi

  if [[ "$CLEAN_CODEX_DIR" == "$CLEAN_CODEX_PARENT"/shootemup-codex-clean.* && \
        -d "$CLEAN_CODEX_DIR" ]]; then
    rm -rf -- "$CLEAN_CODEX_DIR"
  fi
  exit "$exit_code"
}
trap cleanup EXIT HUP INT TERM

install -m 600 "$SOURCE_AUTH_FILE" "$CLEAN_CODEX_DIR/auth.json"

cat > "$CLEAN_CODEX_DIR/config.toml" <<'EOF'
# Minimal-context configuration for shoot-em-up benchmark candidates.
cli_auth_credentials_store = "file"
web_search = "disabled"
project_doc_max_bytes = 0
project_doc_fallback_filenames = []

[features]
apps = false
plugins = false
hooks = false
multi_agent = false
goals = false
memories = false
browser_use = false
computer_use = false
image_generation = false
in_app_browser = false

[apps._default]
enabled = false
EOF
chmod 600 "$CLEAN_CODEX_DIR/config.toml"

if [[ -n "$AUDIT_DIR" ]]; then
  mkdir -p "$AUDIT_DIR"
  cp "$CLEAN_CODEX_DIR/config.toml" "$AUDIT_DIR/clean-codex-config.toml"
  chmod 644 "$AUDIT_DIR/clean-codex-config.toml"
  {
    printf 'codex_version=%s\n' "$(codex --version)"
    printf 'created_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'source_auth=copied-oauth-auth-json\n'
    printf 'temporary_home_removed_on_exit=true\n'
  } > "$AUDIT_DIR/clean-codex-manifest.txt"
  chmod 644 "$AUDIT_DIR/clean-codex-manifest.txt"
fi

export CODEX_HOME="$CLEAN_CODEX_DIR"
"$@"
