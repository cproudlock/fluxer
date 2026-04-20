#!/usr/bin/env bash
set -euo pipefail

# Sign Echowire release artifacts with the YubiKey-backed GPG key.
#
# Produces, for every input file:
#   <file>.asc               — detached signature
# And once per run, in the same directory as the first input:
#   SHA256SUMS.txt           — checksums of every signed artifact
#   SHA256SUMS.txt.asc       — detached signature of the checksums
#
# Usage:
#   ./scripts/sign-release.sh fluxer_desktop/dist/*.AppImage fluxer_desktop/dist/*.deb ...
#
# All inputs must live in the same directory so the checksums file is coherent.
# Requires: gpg, sha256sum, a plugged-in YubiKey with the Echowire Releases key.

SIGNING_KEY_ID="CFE41D9A40A97F7013341135202506F9D549F87E"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

log()  { echo -e "${GREEN}[sign]${RESET} $1"; }
warn() { echo -e "${YELLOW}[sign]${RESET} $1"; }
err()  { echo -e "${RED}[sign]${RESET} $1"; exit 1; }

if [ "$#" -eq 0 ]; then
    echo "usage: $0 <file1> [file2 ...]"
    exit 1
fi

# Preflight — YubiKey and key available
if ! gpg --card-status >/dev/null 2>&1; then
    err "no YubiKey detected — plug it in and ensure pcscd is running"
fi

if ! gpg --list-secret-keys "$SIGNING_KEY_ID" >/dev/null 2>&1; then
    err "signing key $SIGNING_KEY_ID not in keyring — run 'gpg --card-status' to attach it"
fi

# All files must exist and share the same directory
FIRST_DIR=""
for f in "$@"; do
    [ -f "$f" ] || err "not a file: $f"
    d="$(cd "$(dirname "$f")" && pwd)"
    if [ -z "$FIRST_DIR" ]; then
        FIRST_DIR="$d"
    elif [ "$d" != "$FIRST_DIR" ]; then
        err "all inputs must live in the same directory (found $d vs $FIRST_DIR)"
    fi
done

log "signing ${#} artifact(s) with key $SIGNING_KEY_ID"
log "you will be prompted for your YubiKey PIN (once cached, subsequent files reuse it)"

# Per-artifact detached signatures
for f in "$@"; do
    if [ -f "${f}.asc" ]; then
        warn "skip $(basename "$f") — ${f}.asc already exists"
        continue
    fi
    log "  → $(basename "$f")"
    gpg --batch --yes --detach-sign --armor --local-user "$SIGNING_KEY_ID" "$f"
done

# Checksums file + its signature
SUMS="$FIRST_DIR/SHA256SUMS.txt"
rm -f "$SUMS" "$SUMS.asc"
(cd "$FIRST_DIR" && sha256sum "$@" 2>/dev/null || true >/dev/null)
# sha256sum above would include full paths — redo with basenames from FIRST_DIR
(
    cd "$FIRST_DIR"
    names=()
    for f in "$@"; do names+=("$(basename "$f")"); done
    sha256sum "${names[@]}"
) > "$SUMS"

log "  → SHA256SUMS.txt"
gpg --batch --yes --detach-sign --armor --local-user "$SIGNING_KEY_ID" "$SUMS"

log "done."
log "artifacts ready for upload in $FIRST_DIR:"
ls -1 "$FIRST_DIR"/*.asc "$SUMS" 2>/dev/null | sed 's|^|  |'
