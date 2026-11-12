#!/usr/bin/env bash
set -e

echo "============================================="
echo "   Discord Auto Quests - Updater Script      "
echo "============================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/2] Pulling latest changes from GitHub (main)..."
git pull origin main

echo "[2/2] Updating dependencies..."
npm install

echo "============================================="
echo "✔ Successfully updated to the latest version!"
echo "============================================="
