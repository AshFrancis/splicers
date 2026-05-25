#!/bin/sh
# Seed the `stellar` CLI keystore identity `splicers-server` from the
# STELLAR_SECRET_KEY env var (provided by `infisical run` at deploy).
# Keystore lives in /tmp (the only writable path under read_only rootfs).
set -e
KEYSTORE_DIR="${XDG_CONFIG_HOME:-/tmp/.config}/stellar/identity"
mkdir -p "$KEYSTORE_DIR"
chmod 700 "${XDG_CONFIG_HOME:-/tmp/.config}"
if [ -n "${STELLAR_SECRET_KEY:-}" ]; then
  # Validate before writing — a Stellar secret is 56 chars starting with 'S'.
  # Stops a malformed env var from breaking out of the TOML string and
  # injecting extra config (N5 hardening). POSIX-portable: case+${#var}.
  case "$STELLAR_SECRET_KEY" in S*) : ;; *)
    echo "[entrypoint] STELLAR_SECRET_KEY first char != S — refusing to write keystore" >&2
    exit 1 ;; esac
  if [ ${#STELLAR_SECRET_KEY} -ne 56 ]; then
    echo "[entrypoint] STELLAR_SECRET_KEY length=${#STELLAR_SECRET_KEY} (expected 56) — refusing to write keystore" >&2
    exit 1
  fi
  printf 'secret_key = "%s"\n' "$STELLAR_SECRET_KEY" > "$KEYSTORE_DIR/splicers-server.toml"
  chmod 600 "$KEYSTORE_DIR/splicers-server.toml"
fi
exec "$@"
