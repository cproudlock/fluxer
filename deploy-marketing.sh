#!/usr/bin/env bash
set -euo pipefail

# Echowire Marketing Rolling Deploy Script
# Mirrors deploy.sh but targets the fluxer-marketing image instead of fluxer-server.
# Rebuilds the marketing image locally, transfers to both NC + MI, rolling-restarts
# the marketing container. Caddy's edge health check handles failover between nodes.
# Usage: source .env.deploy && ./deploy-marketing.sh

NC_HOST="${NC_HOST:-root@your-primary-node-ip}"
MI_HOST="${MI_HOST:-root@your-standby-node-ip}"
COMPOSE_DIR="/opt/echowire"
IMAGE_NAME="fluxer-marketing:latest"
IMAGE_FILE="/tmp/fluxer-marketing-latest.tar.gz"
HEALTH_PORT=8088
HEALTH_URL="/_health"
HEALTH_TIMEOUT=90
HEALTH_INTERVAL=3

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

log()  { echo -e "${GREEN}[deploy-marketing]${RESET} $1"; }
warn() { echo -e "${YELLOW}[deploy-marketing]${RESET} $1"; }
err()  { echo -e "${RED}[deploy-marketing]${RESET} $1"; exit 1; }

wait_healthy() {
    local host=$1
    local label=$2
    local elapsed=0

    log "Waiting for $label marketing to become healthy..."
    while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
        if ssh "$host" "curl -fsS http://localhost:${HEALTH_PORT}${HEALTH_URL}" &>/dev/null; then
            log "$label marketing is healthy (${elapsed}s)"
            return 0
        fi
        sleep $HEALTH_INTERVAL
        elapsed=$((elapsed + HEALTH_INTERVAL))
    done
    err "$label marketing failed to become healthy after ${HEALTH_TIMEOUT}s"
}

# Step 1: Build Docker image
BUILD_SHA=$(git rev-parse --short HEAD)
BUILD_NUMBER=$(git rev-list --count HEAD)
BUILD_TIMESTAMP=$(date +%s)
log "Building marketing image (SHA: $BUILD_SHA, Build: $BUILD_NUMBER)..."
DOCKER_BUILDKIT=1 docker build -t "$IMAGE_NAME" -f fluxer_marketing/Dockerfile \
    --build-arg BUILDKIT_MAX_PARALLELISM=2 \
    --memory=8g \
    --build-arg BUILD_SHA="$BUILD_SHA" \
    --build-arg BUILD_NUMBER="$BUILD_NUMBER" \
    --build-arg BUILD_TIMESTAMP="$BUILD_TIMESTAMP" \
    --build-arg RELEASE_CHANNEL=stable \
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

# Step 4: Rolling restart — MI first (Caddy will route all traffic to NC during restart)
log "Loading image on MI..."
ssh "$MI_HOST" "docker load < $IMAGE_FILE && rm $IMAGE_FILE"

log "=== Rolling restart: MI marketing (NC stays up) ==="
ssh "$MI_HOST" "cd $COMPOSE_DIR && docker compose up -d --no-deps --force-recreate marketing"
wait_healthy "$MI_HOST" "MI"

# Step 5: Now NC
log "Loading image on NC..."
ssh "$NC_HOST" "docker load < $IMAGE_FILE && rm $IMAGE_FILE"

log "=== Rolling restart: NC marketing (MI healthy) ==="
ssh "$NC_HOST" "cd $COMPOSE_DIR && docker compose up -d --no-deps --force-recreate marketing"
wait_healthy "$NC_HOST" "NC"

# Step 6: Verify
sleep 3
SITE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://echowire.org/download)
if [ "$SITE_STATUS" = "200" ]; then
    log "/download is live (200 OK)"
else
    warn "/download returned $SITE_STATUS (may still be starting)"
fi

# Cleanup
rm -f "$IMAGE_FILE"

log "=== Marketing deploy complete (zero-downtime) ==="
