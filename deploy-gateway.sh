#!/usr/bin/env bash
set -euo pipefail

# Echowire Gateway Hot Reload Script
# Compiles changed Erlang modules and hot-reloads them into running gateway
# containers — zero downtime, no WebSocket disconnections, no voice drops.
#
# Usage: ./deploy-gateway.sh

NC_HOST="${NC_HOST:-root@your-primary-node-ip}"
MI_HOST="${MI_HOST:-root@your-standby-node-ip}"
GATEWAY_DIR="fluxer_gateway"
LOCAL_EBIN="_build/default/lib/fluxer_gateway/ebin"
REMOTE_EBIN="/opt/fluxer_gateway/lib/fluxer_gateway-0.0.0/ebin"
RELOAD_SECRET="${GATEWAY_RELOAD_SECRET:?Set GATEWAY_RELOAD_SECRET env var}"
RELOAD_PORT="${GATEWAY_RELOAD_PORT:-8082}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[gateway-deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[gateway-deploy]${NC} $1"; }
err()  { echo -e "${RED}[gateway-deploy]${NC} $1"; exit 1; }

cd "$(dirname "$0")/$GATEWAY_DIR"

# Step 1: Compile
log "Compiling gateway..."
COMPILE_OUTPUT=$(docker run --rm -v "$(pwd)":/src -w /src erlang:28-slim bash -c \
    "apt-get update -qq && apt-get install -y -qq git curl make gcc g++ libc6-dev ca-certificates >/dev/null 2>&1 && \
     curl -fsSL https://github.com/erlang/rebar3/releases/download/3.24.0/rebar3 -o /usr/local/bin/rebar3 && \
     chmod +x /usr/local/bin/rebar3 && \
     rebar3 compile 2>&1" | tail -3)
log "Compile complete"

# Step 2: Find changed beam files by comparing MD5 with running container
log "Detecting changed modules..."
CHANGED_BEAMS=()

for beam_file in "$LOCAL_EBIN"/*.beam; do
    module=$(basename "$beam_file")
    local_md5=$(md5sum "$beam_file" | cut -d' ' -f1)

    # Get remote MD5 from NC
    remote_md5=$(ssh "$NC_HOST" "docker exec gateway md5sum $REMOTE_EBIN/$module 2>/dev/null | cut -d' ' -f1" 2>/dev/null || echo "missing")

    if [ "$local_md5" != "$remote_md5" ]; then
        CHANGED_BEAMS+=("$beam_file")
    fi
done

if [ ${#CHANGED_BEAMS[@]} -eq 0 ]; then
    log "No changed modules detected. Nothing to deploy."
    exit 0
fi

log "Changed modules (${#CHANGED_BEAMS[@]}):"
for beam in "${CHANGED_BEAMS[@]}"; do
    echo "  - $(basename "$beam" .beam)"
done

# Step 3: Copy changed beams to both nodes
log "Copying beam files to nodes..."
TMPDIR_REMOTE="/tmp/gateway-hotreload-$$"

for HOST in "$NC_HOST" "$MI_HOST"; do
    ssh "$HOST" "mkdir -p $TMPDIR_REMOTE" 2>/dev/null
    for beam in "${CHANGED_BEAMS[@]}"; do
        scp -q "$beam" "$HOST:$TMPDIR_REMOTE/"
    done
    # Copy into running container
    for beam in "${CHANGED_BEAMS[@]}"; do
        module=$(basename "$beam")
        ssh "$HOST" "docker cp $TMPDIR_REMOTE/$module gateway:$REMOTE_EBIN/$module" 2>/dev/null
    done
    ssh "$HOST" "rm -rf $TMPDIR_REMOTE" 2>/dev/null
done
log "Beam files copied"

# Step 4: Hot reload on both nodes
reload_node() {
    local host=$1
    local label=$2

    # Reload all changed modules (gateway detects changes by comparing loaded vs disk MD5)
    local result=$(ssh "$host" "curl -s -X POST http://localhost:$RELOAD_PORT/_admin/reload \
        -H 'Authorization: Bearer $RELOAD_SECRET' \
        -H 'Content-Type: application/json' \
        -d '{}'" 2>/dev/null)

    echo "$result" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    results = data.get('results', [])
    ok = [r for r in results if r.get('status') == 'ok']
    fail = [r for r in results if r.get('status') != 'ok']
    if fail:
        for e in fail:
            print(f'  FAIL: {e.get(\"module\", \"?\")} - {e.get(\"reason\", \"unknown\")}')
    print(f'  {len(ok)} modules reloaded, {len(fail)} failed')
except Exception as e:
    print(f'  ERROR: {e}')
" 2>/dev/null

    if [ $? -ne 0 ]; then
        warn "$label: reload request failed"
    else
        log "$label: reload complete"
    fi
}

log "=== Hot reloading ==="
reload_node "$NC_HOST" "NC"
reload_node "$MI_HOST" "MI"

log "=== Gateway hot reload complete — zero downtime ==="
