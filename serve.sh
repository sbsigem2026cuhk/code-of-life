#!/bin/bash
# Serve the Code of Life website locally.
# Run from anywhere: ./serve.sh

cd "$(dirname "$0")"
PORT="${PORT:-8080}"

echo ""
echo "  Code of Life — local server"
echo "  Website: http://localhost:${PORT}"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

python3 -m http.server "$PORT"
