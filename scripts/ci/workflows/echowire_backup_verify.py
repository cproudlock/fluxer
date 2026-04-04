#!/usr/bin/env python3

"""Echowire ScyllaDB backup verification workflow.

Adapted from test_cassandra_backup.py for self-hosted deployment:
- R2 (Cloudflare) instead of B2 (Backblaze)
- scylladb/scylla:latest instead of cassandra:5.0
- Email notification on failure via smtp2go
- 6-hour freshness threshold (hourly backups, verified every 6h)
"""

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_workflow import parse_step_env_args
from ci_utils import run_step


STEPS = {
    "set_temp_paths": """
set -euo pipefail
: "${RUNNER_TEMP:=/tmp}"
echo "WORKDIR=${RUNNER_TEMP}/scylladb-restore-test" >> "$GITHUB_ENV"
""",
    "pre_clean": """
set -euo pipefail
docker rm -f "${SCYLLA_CONTAINER}" "${UTIL_CONTAINER}" 2>/dev/null || true
docker volume rm "${SCYLLA_VOLUME}" 2>/dev/null || true
docker volume rm "${BACKUP_VOLUME}" 2>/dev/null || true
rm -rf "${WORKDIR}" 2>/dev/null || true
""",
    "install_tools": """
set -euo pipefail
# Ensure ~/bin is in PATH
export PATH="$HOME/bin:$PATH"
# rclone
if ! command -v rclone >/dev/null 2>&1; then
  curl -fsSL https://rclone.org/install.sh | bash 2>/dev/null || true
fi
# age
if ! command -v age >/dev/null 2>&1; then
  mkdir -p ~/bin
  curl -sL https://github.com/FiloSottile/age/releases/download/v1.2.1/age-v1.2.1-linux-amd64.tar.gz \
    | tar xz --strip-components=1 -C ~/bin age/age age/age-keygen
  chmod +x ~/bin/age ~/bin/age-keygen
fi
age --version
rclone version | head -1
""",
    "fetch_backup": """
set -euo pipefail
export PATH="$HOME/bin:$PATH"

rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

LATEST_BACKUP="$(
  rclone lsf "R2:echowire-backups/" --fast-list \
    | grep -E '^cassandra-backup-[0-9]{8}-[0-9]{6}[.]tar[.]age$' \
    | sort -r \
    | head -n 1
)"

if [ -z "${LATEST_BACKUP}" ]; then
  echo "Error: No backup found in R2 bucket"
  exit 1
fi

echo "LATEST_BACKUP=${LATEST_BACKUP}" >> "$GITHUB_ENV"

base="${LATEST_BACKUP}"
ts="${base#cassandra-backup-}"
ts="${ts%.tar.age}"

if ! [[ "$ts" =~ ^[0-9]{8}-[0-9]{6}$ ]]; then
  echo "Error: Could not extract timestamp from backup filename: ${base}"
  exit 1
fi

BACKUP_EPOCH="$(date -u -d "${ts:0:8} ${ts:9:2}:${ts:11:2}:${ts:13:2}" +%s)"
CURRENT_EPOCH="$(date -u +%s)"
AGE_HOURS=$(( (CURRENT_EPOCH - BACKUP_EPOCH) / 3600 ))

echo "Backup age: ${AGE_HOURS} hours"
if [ "${AGE_HOURS}" -ge 6 ]; then
  echo "Error: Latest backup is ${AGE_HOURS} hours old (threshold: 6 hours)"
  exit 1
fi

rclone copyto "R2:echowire-backups/${LATEST_BACKUP}" "${WORKDIR}/backup.tar.age" --fast-list

umask 077
printf '%s' "${AGE_PRIVATE_KEY}" > "${WORKDIR}/age.key"

docker volume create "${BACKUP_VOLUME}"

# Decrypt and extract on the host (ScyllaDB image lacks tar)
age -d -i "${WORKDIR}/age.key" "${WORKDIR}/backup.tar.age" | tar -C "${WORKDIR}" -xf -

# Find the backup directory
BACKUP_DIR="$(find "${WORKDIR}" -maxdepth 1 -type d -name "cassandra-backup-*" | head -1)"
if [ -z "${BACKUP_DIR}" ]; then
  echo "Error: No cassandra-backup-* directory found after extraction"
  ls -la "${WORKDIR}"
  exit 1
fi

if [ ! -f "${BACKUP_DIR}/schema.cql" ]; then
  echo "Error: schema.cql not found in ${BACKUP_DIR}"
  ls -la "${BACKUP_DIR}"
  exit 1
fi

echo "Backup extracted: $(basename "${BACKUP_DIR}")"
echo "Schema: $(wc -l < "${BACKUP_DIR}/schema.cql") lines"

# Copy into Docker volume using a container with bind mount
docker run --rm \
  -v "${BACKUP_VOLUME}:/backup" \
  -v "${BACKUP_DIR}:/source:ro" \
  --user root \
  --entrypoint bash \
  "${SCYLLA_IMAGE}" -lc '
    cp -a /source/. /backup/
  '

# Verify
docker run --rm \
  -v "${BACKUP_VOLUME}:/backup:ro" \
  --user root \
  --entrypoint bash \
  "${SCYLLA_IMAGE}" -lc '
    set -euo pipefail
    test -f /backup/schema.cql
    echo "Extracted backup layout (top 3 levels):"
    find /backup -maxdepth 3 -type d | head -200 || true
    echo "Sample SSTables (*Data.db):"
    find /backup -type f -name "*Data.db" | head -30 || true
  '
""",
    "create_data_volume": """
set -euo pipefail
docker volume create "${SCYLLA_VOLUME}"
""",
    "restore_keyspaces": """
set -euo pipefail

docker run --rm \
  --name "${UTIL_CONTAINER}" \
  -v "${SCYLLA_VOLUME}:/var/lib/scylla" \
  -v "${BACKUP_VOLUME}:/backup:ro" \
  --user root \
  --entrypoint bash \
  "${SCYLLA_IMAGE}" -lc '
    set -euo pipefail
    shopt -s nullglob

    BASE=/var/lib/scylla
    DATA_DIR="$BASE/data"
    mkdir -p "$DATA_DIR" "$BASE/commitlog" "$BASE/hints" "$BASE/view_hints"

    ROOT=/backup
    if [ -d "$ROOT/scylla_data" ]; then ROOT="$ROOT/scylla_data"; fi
    if [ -d "$ROOT/data" ]; then ROOT="$ROOT/data"; fi

    echo "Using backup ROOT=$ROOT"
    echo "Restoring into DATA_DIR=$DATA_DIR"

    restored=0
    for keyspace_dir in "$ROOT"/*/; do
      [ -d "$keyspace_dir" ] || continue
      ks="$(basename "$keyspace_dir")"

      if [ "$ks" = "system_schema" ] || ! [[ "$ks" =~ ^system ]]; then
        echo "Restoring keyspace: $ks"
        rm -rf "$DATA_DIR/$ks"
        cp -a "$keyspace_dir" "$DATA_DIR/"
        restored=$((restored + 1))
      fi
    done

    if [ "$restored" -le 0 ]; then
      echo "Error: No keyspaces restored from backup root: $ROOT"
      ls -la "$ROOT" || true
      find "$ROOT" -maxdepth 2 -type d -print | sed -n "1,100p" || true
      exit 1
    fi

    promoted=0
    for ks_dir in "$DATA_DIR"/*/; do
      [ -d "$ks_dir" ] || continue
      ks="$(basename "$ks_dir")"

      if [ "$ks" != "system_schema" ] && [[ "$ks" =~ ^system ]]; then
        continue
      fi

      for table_dir in "$ks_dir"*/; do
        [ -d "$table_dir" ] || continue

        snap_root="$table_dir/snapshots"
        [ -d "$snap_root" ] || continue

        latest_snap="$(ls -1d "$snap_root"/*/ 2>/dev/null | sort -r | head -n 1 || true)"
        [ -n "$latest_snap" ] || continue

        files=( "$latest_snap"* )
        if [ "${#files[@]}" -gt 0 ]; then
          cp -av "${files[@]}" "$table_dir"
          promoted=$((promoted + $(ls -1 "$latest_snap"/*Data.db 2>/dev/null | wc -l || true)))
        fi
      done
    done

    chown -R scylla:scylla "$BASE" 2>/dev/null || true

    echo "Promoted Data.db files: $promoted"
    if [ "$promoted" -le 0 ]; then
      echo "Error: No *Data.db files were promoted out of snapshots"
      find "$DATA_DIR" -type d -path "*/snapshots/*" | sed -n "1,50p" || true
      exit 1
    fi
  '
""",
    "start_scylladb": """
set -euo pipefail

docker run -d \
  --name "${SCYLLA_CONTAINER}" \
  -v "${SCYLLA_VOLUME}:/var/lib/scylla" \
  "${SCYLLA_IMAGE}" \
  --smp 2 --memory 2G --overprovisioned 1 --developer-mode 1

for i in $(seq 1 180); do
  status="$(docker inspect -f '{{.State.Status}}' "${SCYLLA_CONTAINER}" 2>/dev/null || true)"
  if [ "${status}" != "running" ]; then
    docker inspect "${SCYLLA_CONTAINER}" --format 'ExitCode={{.State.ExitCode}} OOMKilled={{.State.OOMKilled}} Error={{.State.Error}}' || true
    docker logs --tail 300 "${SCYLLA_CONTAINER}" || true
    exit 1
  fi
  if docker exec "${SCYLLA_CONTAINER}" cqlsh -e "SELECT now() FROM system.local;" >/dev/null 2>&1; then
    echo "ScyllaDB ready after ${i} attempts"
    break
  fi
  if [ "$i" -eq 180 ]; then
    echo "Error: ScyllaDB failed to start within 6 minutes"
    docker logs --tail 300 "${SCYLLA_CONTAINER}" || true
    exit 1
  fi
  sleep 2
done
""",
    "verify_data": """
set -euo pipefail

USER_COUNT=""
for i in $(seq 1 30); do
  USER_COUNT="$(
    docker exec "${SCYLLA_CONTAINER}" cqlsh -e "SELECT COUNT(*) FROM fluxer.users;" 2>/dev/null \
      | awk "/^[[:space:]]*[0-9]+[[:space:]]*$/ {print \\$1; exit}" || true
  )"
  if [ -n "${USER_COUNT}" ]; then
    break
  fi
  sleep 2
done

if [ -n "${USER_COUNT}" ] && [ "${USER_COUNT}" -gt 0 ] 2>/dev/null; then
  echo "Backup restore verification passed — ${USER_COUNT} users found"
else
  echo "Backup restore verification failed"
  docker logs --tail 300 "${SCYLLA_CONTAINER}" || true
  exit 1
fi
""",
    "cleanup": """
set -euo pipefail
docker rm -f "${SCYLLA_CONTAINER}" 2>/dev/null || true
docker volume rm "${SCYLLA_VOLUME}" 2>/dev/null || true
docker volume rm "${BACKUP_VOLUME}" 2>/dev/null || true
rm -rf "${WORKDIR}" 2>/dev/null || true
""",
    "notify": """
set -euo pipefail

LATEST_BACKUP_NAME="${LATEST_BACKUP:-unknown}"

if [ "${JOB_STATUS}" = "success" ]; then
  SUBJECT="[Echowire] ScyllaDB Backup OK"
  BODY="Backup verification passed for: ${LATEST_BACKUP_NAME}"
else
  SUBJECT="[Echowire] ScyllaDB Backup Verification FAILED"
  BODY="Backup verification failed for: ${LATEST_BACKUP_NAME}\\n\\nCheck Gitea Actions for details:\\nhttp://10.9.50.236:3000/cproudlock/echowire/actions"
fi

if [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASS:-}" ]; then
  python3 -c "
import smtplib
from email.mime.text import MIMEText
import os

msg = MIMEText('${BODY}'.replace('\\\\n', '\\n'))
msg['Subject'] = '${SUBJECT}'
msg['From'] = os.environ['SMTP_USER']
msg['To'] = os.environ['SMTP_USER']

with smtplib.SMTP('mail.smtp2go.com', 2525) as s:
    s.starttls()
    s.login(os.environ['SMTP_USER'], os.environ['SMTP_PASS'])
    s.send_message(msg)
    print('Notification sent: ${SUBJECT}')
"
else
  echo "Warning: SMTP credentials not set — cannot send notification"
fi
""",
    "report_status": """
set -euo pipefail
LATEST_BACKUP_NAME="${LATEST_BACKUP:-unknown}"
if [ "${JOB_STATUS}" = "success" ]; then
  echo "Backup ${LATEST_BACKUP_NAME} is valid and restorable"
else
  echo "Backup ${LATEST_BACKUP_NAME} test failed"
fi
""",
}


def main() -> int:
    args = parse_step_env_args()
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
