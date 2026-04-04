#!/usr/bin/env sh

# Echowire ScyllaDB Backup Script
# Adapted from fluxer_devops/cassandra/backup.sh for self-hosted deployment.
# - Uses rclone + Cloudflare R2 instead of aws CLI + Backblaze B2
# - Runs nodetool/cqlsh via docker exec scylladb
# - Deployed to NC VM at /opt/echowire/backup.sh

set -eu

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="cassandra-backup-${TIMESTAMP}"
SNAPSHOT_TAG="backup-${TIMESTAMP}"
DATA_DIR="/var/lib/scylla/data"
TEMP_DIR="/tmp/${BACKUP_NAME}"
AGE_PUBLIC_KEY="${AGE_PUBLIC_KEY:-}"
ENCRYPTED_BACKUP="${BACKUP_NAME}.tar.age"
MAX_BACKUP_COUNT=168  # 7 days of hourly backups
SCYLLA_CONTAINER="${SCYLLA_CONTAINER:-scylladb}"
R2_BUCKET="${R2_BUCKET:-echowire-backups}"
NAS_BACKUP_DIR="${NAS_BACKUP_DIR:-/mnt/nas/echowire-backups}"

echo "[$(date)] Starting ScyllaDB backup: ${BACKUP_NAME}"

# Step 1: Create snapshot
echo "[$(date)] Creating snapshot: ${SNAPSHOT_TAG}"
if ! docker exec "${SCYLLA_CONTAINER}" nodetool snapshot -t "${SNAPSHOT_TAG}"; then
    echo "[$(date)] Error: Failed to create snapshot"
    exit 1
fi
echo "[$(date)] Snapshot created successfully"

# Step 2: Collect snapshot files
echo "[$(date)] Collecting snapshot files"
mkdir -p "${TEMP_DIR}"

docker exec "${SCYLLA_CONTAINER}" find "${DATA_DIR}" -type d -name "${SNAPSHOT_TAG}" | while IFS= read -r snapshot_dir; do
    rel_path=$(dirname "${snapshot_dir#$DATA_DIR/}")
    target_dir="${TEMP_DIR}/${rel_path}"
    mkdir -p "${target_dir}"
    # Copy snapshot files out of the container
    docker cp "${SCYLLA_CONTAINER}:${snapshot_dir}" "${target_dir}/"
done

# Copy schema
echo "[$(date)] Saving schema"
if [ -n "${CASSANDRA_PASSWORD:-}" ]; then
    docker exec "${SCYLLA_CONTAINER}" cqlsh -u cassandra -p "${CASSANDRA_PASSWORD}" localhost -e "DESC SCHEMA;" 2>/dev/null \
        | sed '/^WARNING:/d' > "${TEMP_DIR}/schema.cql" || echo "Warning: Could not export schema"
else
    docker exec "${SCYLLA_CONTAINER}" cqlsh localhost -e "DESC SCHEMA;" 2>/dev/null \
        | sed '/^WARNING:/d' > "${TEMP_DIR}/schema.cql" || echo "Warning: Could not export schema"
fi

# Save cluster topology info
docker exec "${SCYLLA_CONTAINER}" nodetool describecluster > "${TEMP_DIR}/cluster_topology.txt" 2>/dev/null || true
docker exec "${SCYLLA_CONTAINER}" nodetool status > "${TEMP_DIR}/cluster_status.txt" 2>/dev/null || true

echo "[$(date)] Snapshot collection completed"

# Step 3: Check if encryption is configured
if [ -z "${AGE_PUBLIC_KEY}" ]; then
    echo "[$(date)] Warning: AGE_PUBLIC_KEY not set - skipping encryption and upload"
    echo "[$(date)] Backup stored locally at: ${TEMP_DIR}"
    docker exec "${SCYLLA_CONTAINER}" nodetool clearsnapshot -t "${SNAPSHOT_TAG}"
    exit 0
fi

# Step 4: Create tar archive and encrypt with age (streaming)
echo "[$(date)] Encrypting backup with age..."
if ! tar -C /tmp -cf - "${BACKUP_NAME}" | \
     age -r "${AGE_PUBLIC_KEY}" -o "/tmp/${ENCRYPTED_BACKUP}"; then
    echo "[$(date)] Error: Encryption failed"
    rm -rf "${TEMP_DIR}"
    docker exec "${SCYLLA_CONTAINER}" nodetool clearsnapshot -t "${SNAPSHOT_TAG}"
    exit 1
fi
echo "[$(date)] Encryption completed: ${ENCRYPTED_BACKUP}"

BACKUP_SIZE=$(du -h "/tmp/${ENCRYPTED_BACKUP}" | cut -f1)
echo "[$(date)] Encrypted backup size: ${BACKUP_SIZE}"

# Step 5a: Copy encrypted backup to NAS (local, fast)
if [ -d "${NAS_BACKUP_DIR}" ]; then
    echo "[$(date)] Copying encrypted backup to NAS..."
    cp "/tmp/${ENCRYPTED_BACKUP}" "${NAS_BACKUP_DIR}/${ENCRYPTED_BACKUP}" && \
        echo "[$(date)] NAS copy completed" || \
        echo "[$(date)] Warning: NAS copy failed (continuing with R2 upload)"
else
    echo "[$(date)] NAS backup directory not mounted at ${NAS_BACKUP_DIR}, skipping local copy"
fi

# Step 5b: Upload encrypted backup to R2 via rclone
echo "[$(date)] Uploading encrypted backup to R2..."
if ! rclone copyto "/tmp/${ENCRYPTED_BACKUP}" "r2:${R2_BUCKET}/${ENCRYPTED_BACKUP}" --fast-list; then
    echo "[$(date)] Error: Upload to R2 failed"
    rm -f "/tmp/${ENCRYPTED_BACKUP}"
    rm -rf "${TEMP_DIR}"
    docker exec "${SCYLLA_CONTAINER}" nodetool clearsnapshot -t "${SNAPSHOT_TAG}"
    exit 1
fi
echo "[$(date)] R2 upload completed successfully"

# Step 6: Cleanup
echo "[$(date)] Cleaning up temporary files..."
rm -f "/tmp/${ENCRYPTED_BACKUP}"
rm -rf "${TEMP_DIR}"

docker exec "${SCYLLA_CONTAINER}" nodetool clearsnapshot -t "${SNAPSHOT_TAG}"

# Step 7: Purge old backups from R2
echo "[$(date)] Purging old backups from R2 (keeping last ${MAX_BACKUP_COUNT})..."
rclone lsf "r2:${R2_BUCKET}/" --fast-list \
    | grep "^cassandra-backup-.*\.tar\.age$" \
    | sort -r \
    | tail -n +$((MAX_BACKUP_COUNT + 1)) \
    | while IFS= read -r old_backup; do
        echo "[$(date)] Deleting old backup: ${old_backup}"
        rclone deletefile "r2:${R2_BUCKET}/${old_backup}" || true
    done

# Step 8: Purge old NAS backups
if [ -d "${NAS_BACKUP_DIR}" ]; then
    echo "[$(date)] Purging old NAS backups (keeping last ${MAX_BACKUP_COUNT})..."
    ls -1 "${NAS_BACKUP_DIR}"/cassandra-backup-*.tar.age 2>/dev/null \
        | sort -r \
        | tail -n +$((MAX_BACKUP_COUNT + 1)) \
        | while IFS= read -r old_backup; do
            echo "[$(date)] Deleting old NAS backup: $(basename "${old_backup}")"
            rm -f "${old_backup}" || true
        done
fi

echo "[$(date)] Backup process completed successfully"
echo "[$(date)] Backup name: ${ENCRYPTED_BACKUP}"
echo "[$(date)] Backup size: ${BACKUP_SIZE}"
