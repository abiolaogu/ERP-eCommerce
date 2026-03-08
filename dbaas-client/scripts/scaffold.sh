#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <target-project-absolute-path> [module-dir-name]"
  exit 1
fi

TARGET_PROJECT="$1"
MODULE_DIR_NAME="${2:-dbaas-client}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_DIR="${TARGET_PROJECT}/${MODULE_DIR_NAME}"

if [[ ! -d "${TARGET_PROJECT}" ]]; then
  echo "Target project path does not exist: ${TARGET_PROJECT}"
  exit 1
fi

if [[ -e "${TARGET_DIR}" ]]; then
  echo "Target module directory already exists: ${TARGET_DIR}"
  exit 1
fi

mkdir -p "${TARGET_DIR}"
rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.DS_Store' \
  "${TEMPLATE_ROOT}/" "${TARGET_DIR}/"

chmod +x "${TARGET_DIR}/scripts/scaffold.sh"

echo "DBaaS client template copied to: ${TARGET_DIR}"
echo "Next: cd ${TARGET_DIR} && npm install && make test"
