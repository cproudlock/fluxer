#!/usr/bin/env bash
set -euo pipefail

# Signs Windows executables using JSign + Azure Trusted Signing
# Requires: java, jsign.jar at ~/.local/bin/jsign.jar
# Env vars: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET,
#           AZURE_SIGNING_ENDPOINT, AZURE_SIGNING_ACCOUNT, AZURE_CERTIFICATE_PROFILE

FILE="$1"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "[sign] Usage: $0 <file.exe>"
  exit 1
fi

JSIGN_JAR="${JSIGN_JAR:-$HOME/.local/bin/jsign.jar}"
if [ ! -f "$JSIGN_JAR" ]; then
  echo "[sign] jsign.jar not found at $JSIGN_JAR"
  exit 1
fi

ENDPOINT="${AZURE_SIGNING_ENDPOINT:?AZURE_SIGNING_ENDPOINT not set}"
ACCOUNT="${AZURE_SIGNING_ACCOUNT:?AZURE_SIGNING_ACCOUNT not set}"
PROFILE="${AZURE_CERTIFICATE_PROFILE:?AZURE_CERTIFICATE_PROFILE not set}"

# Strip protocol and trailing slash from endpoint to get keystore host
KEYSTORE_HOST=$(echo "$ENDPOINT" | sed 's|https://||;s|/$||')

echo "[sign] Obtaining Azure access token..."
TOKEN=$(curl -sf -X POST "https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token" \
  -d "client_id=${AZURE_CLIENT_ID}" \
  -d "client_secret=${AZURE_CLIENT_SECRET}" \
  -d "scope=https://codesigning.azure.net/.default" \
  -d "grant_type=client_credentials" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

echo "[sign] Signing $FILE via Azure Trusted Signing ($ACCOUNT/$PROFILE)..."
java -jar "$JSIGN_JAR" \
  --storetype TRUSTEDSIGNING \
  --keystore "$KEYSTORE_HOST" \
  --storepass "$TOKEN" \
  --alias "$ACCOUNT/$PROFILE" \
  --tsaurl http://timestamp.acs.microsoft.com \
  --tsmode RFC3161 \
  "$FILE"

echo "[sign] Successfully signed $FILE"
