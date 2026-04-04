#!/usr/bin/env python3

"""Echowire gateway hot-reload deployment.

Adapted from deploy_gateway.py for self-hosted distributed deployment:
- Direct SSH to NC/MI nodes via NetBird (no SSH tunnel setup)
- Rolling deploy: NC first, then MI (each invoked as separate step with TARGET_HOST)
- Container discovery via docker ps --filter name=gateway
- Reuses scripts/ci/erlang_hot_reload.py for BEAM diff + verify
"""

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_workflow import parse_step_env_args
from ci_utils import run_step


STEPS: dict[str, str] = {
    "compile": """
set -euo pipefail
cd fluxer_gateway
rebar3 as prod compile
""",
    "deploy": """
set -euo pipefail

: "${TARGET_HOST:?TARGET_HOST is required}"
: "${TARGET_NAME:?TARGET_NAME is required}"
: "${GATEWAY_ADMIN_SECRET:?GATEWAY_ADMIN_SECRET is required}"

echo "=== Deploying gateway to ${TARGET_NAME} (${TARGET_HOST}) ==="

# Find gateway container
CONTAINER_ID="$(ssh "root@${TARGET_HOST}" "docker ps -q --filter name=gateway | head -1")"
if [ -z "${CONTAINER_ID}" ]; then
  echo "::error::No running gateway container found on ${TARGET_NAME}"
  ssh "root@${TARGET_HOST}" "docker ps --format '{{.ID}} {{.Names}} {{.Status}}'" || true
  exit 1
fi
echo "Container: ${CONTAINER_ID} on ${TARGET_NAME}"

# Health check (curl from host, gateway listens on 8082)
GATEWAY_HTTP_PORT="8082"
if ! ssh "root@${TARGET_HOST}" "curl -fsS --max-time 3 http://localhost:${GATEWAY_HTTP_PORT}/_health >/dev/null"; then
  echo "::error::Gateway health check failed on ${TARGET_NAME}"
  exit 1
fi
echo "Health check passed on ${TARGET_NAME}"

# Collect local BEAM MD5s
LOCAL_MD5_LINES="$(
  erl -noshell -eval '
    Files = filelib:wildcard("fluxer_gateway/_build/prod/lib/fluxer_gateway/ebin/*.beam"),
    lists:foreach(
      fun(F) ->
        {ok, {M, Md5}} = beam_lib:md5(F),
        Hex = binary:encode_hex(Md5, lowercase),
        io:format("~s ~s ~s~n", [atom_to_list(M), binary_to_list(Hex), F])
      end,
      Files
    ),
    halt().'
)"

# Build list of ALL compiled BEAM files (skip MD5 diff — release CLI eval
# doesn't work without vm.args node name, and adding it requires container rebuild)
CHANGED_MAIN_LIST="$(mktemp)"
CHANGED_SELF_LIST="$(mktemp)"
RELOAD_RESULT_MAIN="$(mktemp)"
RELOAD_RESULT_SELF="$(mktemp)"
trap 'rm -f "${CHANGED_MAIN_LIST}" "${CHANGED_SELF_LIST}" "${RELOAD_RESULT_MAIN}" "${RELOAD_RESULT_SELF}"' EXIT

# List all compiled BEAM files, split into self vs main
for beam in fluxer_gateway/_build/prod/lib/fluxer_gateway/ebin/*.beam; do
  [ -f "${beam}" ] || continue
  m="$(basename "${beam}")"
  m="${m%.beam}"
  if [ "${m}" = "hot_reload" ] || [ "${m}" = "hot_reload_handler" ]; then
    printf '%s\n' "${beam}" >> "${CHANGED_SELF_LIST}"
  else
    printf '%s\n' "${beam}" >> "${CHANGED_MAIN_LIST}"
  fi
done

TOTAL=$(cat "${CHANGED_SELF_LIST}" "${CHANGED_MAIN_LIST}" 2>/dev/null | wc -l)
echo "Reloading ${TOTAL} modules on ${TARGET_NAME}"

build_json() {
  python3 scripts/ci/erlang_hot_reload.py build-json "$1"
}

strict_verify() {
  python3 scripts/ci/erlang_hot_reload.py verify --mode strict
}

self_verify() {
  python3 scripts/ci/erlang_hot_reload.py verify --mode self
}

# Reload self-modules first (hot_reload itself)
if [ -s "${CHANGED_SELF_LIST}" ]; then
  echo "Reloading self-modules on ${TARGET_NAME}..."
  if ! build_json "${CHANGED_SELF_LIST}" \
    | ssh "root@${TARGET_HOST}" "curl -sS -X POST \
        -H 'Authorization: Bearer ${GATEWAY_ADMIN_SECRET}' \
        -H 'Content-Type: application/json' \
        --data @- http://localhost:${GATEWAY_HTTP_PORT}/_admin/reload" \
    | tee "${RELOAD_RESULT_SELF}" | self_verify; then
    echo "::group::Hot reload response (self) on ${TARGET_NAME}"
    cat "${RELOAD_RESULT_SELF}" || true
    echo "::endgroup::"
    exit 1
  fi
fi

# Reload main modules
if [ -s "${CHANGED_MAIN_LIST}" ]; then
  echo "Reloading main modules on ${TARGET_NAME}..."
  if ! build_json "${CHANGED_MAIN_LIST}" \
    | ssh "root@${TARGET_HOST}" "curl -sS -X POST \
        -H 'Authorization: Bearer ${GATEWAY_ADMIN_SECRET}' \
        -H 'Content-Type: application/json' \
        --data @- http://localhost:${GATEWAY_HTTP_PORT}/_admin/reload" \
    | tee "${RELOAD_RESULT_MAIN}" | strict_verify; then
    echo "::group::Hot reload response (main) on ${TARGET_NAME}"
    cat "${RELOAD_RESULT_MAIN}" || true
    echo "::endgroup::"
    exit 1
  fi
fi

echo "=== Gateway deploy to ${TARGET_NAME} completed ==="
""",
}


def main() -> int:
    args = parse_step_env_args()
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
