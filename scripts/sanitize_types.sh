#!/usr/bin/env bash
set -euo pipefail

if [[ -d "node_modules/@types" ]]; then
  find node_modules/@types -maxdepth 1 -type d -name "* 2" -exec rm -rf {} +
fi
