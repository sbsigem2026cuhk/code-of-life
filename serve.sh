#!/bin/bash
# Serve Code of Life locally (chooser + desktop + phone).
# Run from anywhere: ./serve.sh

cd "$(dirname "$0")"
PORT="${PORT:-8080}"

echo ""
echo "  Code of Life — local server"
echo "  Chooser:  http://localhost:${PORT}/"
echo "  Desktop:  http://localhost:${PORT}/desktop/"
echo "  Phone:    http://localhost:${PORT}/phone/"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

python3 -m http.server "$PORT"
