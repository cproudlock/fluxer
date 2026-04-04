#!/usr/bin/env bash

# Deploy ScyllaDB backup system to NC VM
# Usage: ./deploy-backup.sh
#
# Prerequisites:
#   - SSH access to NC VM (100.70.10.204)
#   - R2 credentials
#   - age public key

set -euo pipefail

NC_HOST="${NC_HOST:-100.70.10.204}"
NC_USER="${NC_USER:-root}"
DEPLOY_DIR="/opt/echowire"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploying ScyllaDB Backup System to NC (${NC_HOST}) ==="

# Step 1: Copy backup script
echo "[1/4] Copying backup.sh..."
scp "${SCRIPT_DIR}/backup.sh" "${NC_USER}@${NC_HOST}:${DEPLOY_DIR}/backup.sh"
ssh "${NC_USER}@${NC_HOST}" "chmod +x ${DEPLOY_DIR}/backup.sh"

# Step 2: Create rclone config for R2
echo "[2/4] Creating rclone config for R2..."
ssh "${NC_USER}@${NC_HOST}" "mkdir -p /root/.config/rclone && cat > /root/.config/rclone/rclone.conf" <<'RCLONEEOF'
[r2]
type = s3
provider = Cloudflare
env_auth = false
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
RCLONEEOF

echo "NOTE: Edit /root/.config/rclone/rclone.conf on NC with actual R2 credentials"

# Step 3: Set up NFS mount for NAS backups
echo "[3/6] Setting up NFS mount for NAS backups..."
ssh "${NC_USER}@${NC_HOST}" "apt-get install -y nfs-common 2>/dev/null || true"
ssh "${NC_USER}@${NC_HOST}" "mkdir -p /mnt/nas/echowire-backups"
# Add fstab entry if not already present
ssh "${NC_USER}@${NC_HOST}" "grep -q 'echowire-backups' /etc/fstab || echo '10.9.50.5:/volume1/backups/echowire /mnt/nas/echowire-backups nfs defaults,soft,timeo=30,retrans=3 0 0' >> /etc/fstab"
ssh "${NC_USER}@${NC_HOST}" "mount /mnt/nas/echowire-backups 2>/dev/null || echo 'NOTE: Mount failed — ensure NFS export exists on NAS (10.9.50.5:/volume1/backups/echowire)'"

# Step 4: Create backup.env
echo "[4/6] Creating backup.env..."
ssh "${NC_USER}@${NC_HOST}" "cat > ${DEPLOY_DIR}/backup.env" <<'EOF'
# ScyllaDB Backup Environment
# Edit these values before enabling the timer

SCYLLA_CONTAINER=scylladb
R2_BUCKET=echowire-backups
CASSANDRA_PASSWORD=
AGE_PUBLIC_KEY=
NAS_BACKUP_DIR=/mnt/nas/echowire-backups
EOF

echo "NOTE: Edit ${DEPLOY_DIR}/backup.env on NC with actual credentials"

# Step 5: Create systemd service + timer
echo "[5/6] Creating systemd service + timer..."
ssh "${NC_USER}@${NC_HOST}" "cat > /etc/systemd/system/echowire-backup.service" <<EOF
[Unit]
Description=Echowire ScyllaDB Backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
EnvironmentFile=${DEPLOY_DIR}/backup.env
ExecStart=${DEPLOY_DIR}/backup.sh
TimeoutStartSec=1800
StandardOutput=journal
StandardError=journal
EOF

ssh "${NC_USER}@${NC_HOST}" "cat > /etc/systemd/system/echowire-backup.timer" <<EOF
[Unit]
Description=Hourly ScyllaDB Backup

[Timer]
OnCalendar=hourly
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
EOF

ssh "${NC_USER}@${NC_HOST}" "systemctl daemon-reload && systemctl enable echowire-backup.timer"

# Step 6: Install rclone + age on NC if missing
echo "[6/6] Ensuring rclone and age are installed on NC..."
ssh "${NC_USER}@${NC_HOST}" "command -v rclone >/dev/null || (curl -fsSL https://rclone.org/install.sh | bash)"
ssh "${NC_USER}@${NC_HOST}" "command -v age >/dev/null || (curl -sL https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-linux-amd64.tar.gz | tar xz -C /usr/local/bin --strip-components=1 age/age age/age-keygen)"

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Before starting, edit these files on NC (${NC_HOST}):"
echo "  1. ${DEPLOY_DIR}/backup.env  - Set CASSANDRA_PASSWORD and AGE_PUBLIC_KEY"
echo "  2. /root/.config/rclone/rclone.conf - Set R2 credentials"
echo ""
echo "NAS setup:"
echo "  - NFS mount: 10.9.50.5:/volume1/backups/echowire → /mnt/nas/echowire-backups"
echo "  - Create the 'echowire' directory on NAS under /volume1/backups/ if it doesn't exist"
echo "  - Ensure NFS export allows NC VM (10.9.50.30 or 10.9.50.0/24)"
echo ""
echo "Then start the timer:"
echo "  ssh ${NC_USER}@${NC_HOST} systemctl start echowire-backup.timer"
echo ""
echo "To run a test backup immediately:"
echo "  ssh ${NC_USER}@${NC_HOST} systemctl start echowire-backup.service"
echo "  ssh ${NC_USER}@${NC_HOST} journalctl -u echowire-backup.service -f"
