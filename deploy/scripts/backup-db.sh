#!/usr/bin/env bash
# ==============================================================================
# Nexa Loan Management System - Automated MySQL Database Backup Script
# ==============================================================================
# Usage:
#   bash /var/www/nexa-lms/deploy/scripts/backup-db.sh
# Cron Configuration (Daily at 02:00 AM):
#   0 2 * * * /var/www/nexa-lms/deploy/scripts/backup-db.sh >> /var/log/nexa-lms/backup.log 2>&1
# ==============================================================================

set -eo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nexa-lms}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
APP_DIR="${APP_DIR:-/var/www/nexa-lms}"

# Load credentials from .env if present
if [ -f "${APP_DIR}/.env" ]; then
    export $(grep -v '^#' "${APP_DIR}/.env" | xargs)
fi

DB_USER="${DB_USER:-nexa_admin}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-nexa_lms}"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/nexa_lms_backup_${TIMESTAMP}.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated database backup for '${DB_NAME}'..."

# Execute non-blocking InnoDB consistent mysqldump with gzip compression
if [ -n "${DB_PASSWORD}" ]; then
    MYSQL_PWD="${DB_PASSWORD}" mysqldump \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --user="${DB_USER}" \
        --single-transaction \
        --quick \
        --routines \
        --triggers \
        --default-character-set=utf8mb4 \
        "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
else
    mysqldump \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --user="${DB_USER}" \
        --single-transaction \
        --quick \
        --routines \
        --triggers \
        --default-character-set=utf8mb4 \
        "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"
fi

# Verify backup file existence and minimum size
if [ ! -s "${BACKUP_FILE}" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: Backup file is empty or missing: ${BACKUP_FILE}" >&2
    exit 1
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Backup created successfully: ${BACKUP_FILE} (${FILE_SIZE})"

# Prune old backups exceeding retention policy
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "nexa_lms_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -exec rm -f {} +

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup cycle completed successfully."
