#!/usr/bin/env bash
# ==============================================================================
# Nexa Loan Management System - Zero-Downtime Rolling Update Script
# ==============================================================================
# Usage:
#   cd /var/www/nexa-lms && bash deploy/scripts/deploy-update.sh
# ==============================================================================

set -eo pipefail

APP_DIR="${APP_DIR:-/var/www/nexa-lms}"
cd "${APP_DIR}"

echo "=============================================================================="
echo "🚀 Starting Nexa LMS Zero-Downtime Deployment Cycle"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================================================="

# 1. Fetch latest changes from Git
echo "Step 1/6: Fetching latest codebase from version control..."
git fetch origin main
git checkout main
git pull origin main

# 2. Install / update dependencies
echo "Step 2/6: Installing npm dependencies..."
npm install

# 3. Regenerate Prisma Client
echo "Step 3/6: Generating Prisma ORM client..."
npx prisma generate

# 4. Apply Database Migrations (Zero interactive prompts)
echo "Step 4/6: Deploying pending database migrations..."
npx prisma migrate deploy

# 5. Compile Frontend and Backend Production Bundles
echo "Step 5/6: Compiling production assets..."
npm run build

# 6. Perform Zero-Downtime Rolling Reload via PM2
echo "Step 6/6: Reloading PM2 process cluster..."
pm2 reload deploy/pm2/ecosystem.config.cjs --env production --update-env

# 7. Post-Deployment Verification
echo "Verifying server health check..."
sleep 3
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health || echo "FAILED")

if [ "${HEALTH_STATUS}" -eq 200 ]; then
    echo "=============================================================================="
    echo "✓ Deployment Successful! Server healthy on HTTP ${HEALTH_STATUS}."
    echo "=============================================================================="
else
    echo "=============================================================================="
    echo "⚠️ Warning: Health check returned status '${HEALTH_STATUS}'. Review PM2 logs:"
    echo "  pm2 logs nexa-lms --lines 50"
    echo "=============================================================================="
fi
