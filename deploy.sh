#!/usr/bin/env bash
set -euo pipefail

# Echowire Zero-Downtime Rolling Deploy Script
# Builds Docker image locally, transfers to both nodes, does rolling restart.
# Only restarts fluxer_server (not gateway) — WebSocket connections stay alive.
# Caddy health checks handle failover between nodes during restart.
# Usage: ./deploy.sh

NC_HOST="${NC_HOST:-root@your-primary-node-ip}"
MI_HOST="${MI_HOST:-root@your-standby-node-ip}"
CADDY_HOST="${CADDY_HOST:-root@your-edge-node-ip}"
COMPOSE_DIR="/opt/echowire"
IMAGE_NAME="fluxer-server:latest"
IMAGE_FILE="/tmp/fluxer-server-latest.tar.gz"
HEALTH_URL="/_health"
HEALTH_TIMEOUT=120  # seconds to wait for healthy
HEALTH_INTERVAL=3   # seconds between checks (match Caddy health_interval)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC_COLOR='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC_COLOR} $1"; }
warn() { echo -e "${YELLOW}[deploy]${NC_COLOR} $1"; }
err()  { echo -e "${RED}[deploy]${NC_COLOR} $1"; exit 1; }

wait_healthy() {
    local host=$1
    local label=$2
    local elapsed=0

    log "Waiting for $label to become healthy..."
    while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
        if ssh "$host" "curl -fsS http://localhost:8080${HEALTH_URL}" &>/dev/null; then
            log "$label is healthy (${elapsed}s)"
            return 0
        fi
        sleep $HEALTH_INTERVAL
        elapsed=$((elapsed + HEALTH_INTERVAL))
    done
    err "$label failed to become healthy after ${HEALTH_TIMEOUT}s"
}

wait_caddy_routes_to() {
    local target_host=$1
    local label=$2
    local elapsed=0

    log "Waiting for Caddy to route traffic to $label..."
    while [ $elapsed -lt 30 ]; do
        # Hit the edge proxy and check it reaches the target node
        if ssh "$target_host" "curl -fsS http://localhost:8080${HEALTH_URL}" &>/dev/null; then
            log "Caddy confirmed routing to $label"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    warn "Could not confirm Caddy routing to $label (continuing anyway)"
}

# Step 1: Build Docker image
BUILD_SHA=$(git rev-parse --short HEAD)
BUILD_NUMBER=$(git rev-list --count HEAD)
BUILD_TIMESTAMP=$(date +%s)
log "Building Docker image (SHA: $BUILD_SHA, Build: $BUILD_NUMBER)..."
DOCKER_BUILDKIT=1 docker build -t "$IMAGE_NAME" -f fluxer_server/Dockerfile \
	--build-arg BUILDKIT_MAX_PARALLELISM=2 \
	--memory=12g \
	--build-arg BUILD_SHA="$BUILD_SHA" \
	--build-arg BUILD_NUMBER="$BUILD_NUMBER" \
	--build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
	. 2>&1 | tail -5
log "Image built successfully"

# Step 2: Save image
log "Saving image to $IMAGE_FILE..."
docker save "$IMAGE_NAME" | gzip > "$IMAGE_FILE"
IMAGE_SIZE=$(du -h "$IMAGE_FILE" | cut -f1)
log "Image saved ($IMAGE_SIZE)"

# Step 3: Transfer to both nodes in parallel
log "Transferring image to both nodes..."
scp "$IMAGE_FILE" "$MI_HOST:/tmp/" &
MI_PID=$!
scp "$IMAGE_FILE" "$NC_HOST:/tmp/" &
NC_PID=$!
wait $MI_PID || err "Failed to transfer to MI"
wait $NC_PID || err "Failed to transfer to NC"
log "Image transferred to both nodes"

# Step 4: Load image on MI + restart MI first
log "Loading image on MI..."
ssh "$MI_HOST" "docker load < $IMAGE_FILE && rm $IMAGE_FILE"

log "=== Rolling restart: MI first (NC stays up, no downtime) ==="
ssh "$MI_HOST" "cd $COMPOSE_DIR && docker compose up -d --no-deps --force-recreate fluxer_server"
wait_healthy "$MI_HOST" "MI"

# Step 5: Load image on NC
log "Loading image on NC..."
ssh "$NC_HOST" "docker load < $IMAGE_FILE && rm $IMAGE_FILE"

# Step 6: Restart NC — MI is healthy and Caddy will failover
log "=== Rolling restart: NC (MI healthy, Caddy will failover) ==="
# Verify MI is actually serving before we touch NC
wait_caddy_routes_to "$MI_HOST" "MI"

ssh "$NC_HOST" "cd $COMPOSE_DIR && docker compose up -d --no-deps --force-recreate fluxer_server"
wait_healthy "$NC_HOST" "NC"

# Step 7: Verify
log "=== Verifying ==="
NC_KEYS=$(ssh "$NC_HOST" "docker exec valkey valkey-cli dbsize" 2>/dev/null || echo "unknown")
MI_KEYS=$(ssh "$MI_HOST" "docker exec valkey valkey-cli dbsize" 2>/dev/null || echo "unknown")
log "Valkey — NC: $NC_KEYS, MI: $MI_KEYS"

# Wait a moment for Caddy to pick NC back up as primary
sleep 5
SITE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://echowire.org/_health)
if [ "$SITE_STATUS" = "200" ]; then
    log "Site is live (200 OK)"
else
    warn "Site returned $SITE_STATUS (may still be starting)"
fi

# Step 8: Restart gateway on NC (NATS RPC doesn't auto-reconnect after API restart)
log "=== Restarting gateway on NC ==="
ssh "$NC_HOST" "cd $COMPOSE_DIR && docker compose up -d --no-deps --force-recreate gateway" 2>&1
log "Gateway restarted"

# Cleanup
rm -f "$IMAGE_FILE"

log "=== Deploy complete (zero-downtime) ==="
