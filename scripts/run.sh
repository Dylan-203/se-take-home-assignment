#!/usr/bin/env bash
set -euo pipefail

echo "=== Running order controller simulation (fast mode for CI) ==="
node src/cli.js --fast

echo "=== scripts/result.txt ==="
cat scripts/result.txt
