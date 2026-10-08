#!/usr/bin/env bash
# ==============================================================================
# Nexa Loan Management System - Database Restoration Script
# ==============================================================================
# Usage:
#   bash /var/www/nexa-lms/deploy/scripts/restore-db.sh /var/backups/nexa-lms/nexa_lms_backup_YYYYMMDD_HHMMSS.sql.gz
#   bash /var/www/nexa-lms/deploy/scripts/restore-db.sh /path/to/backup.sql.gz --force
# ==============================================================================

set -eo pipefail

BACKUP_FILE="$1"
FORCE_FLAG="$2"
APP_DIR="${APP_DIR:-/var/www/nexa-lms}"

if [ -z "${BACKUP_FILE}" ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz> [--force]"
    exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Error: Backup file not found at: ${BACKUP_FILE}"
    exit 1
fi

# Load credentials from .env
if [ -f "${APP_DIR}/.env" ]; then
    export $(grep -v '^#' "${APP_DIR}/.env" | xargs)
fi

DB_USER="${DB_USER:-nexa_admin}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-nexa_lms}"

echo "=============================================================================="
echo "⚠️  DATABASE RESTORATION WARNING"
echo "=============================================================================="
echo "Target Host     : ${DB_HOST}:${DB_PORT}"
echo "Target Database : ${DB_NAME}"
echo "Source File     : ${BACKUP_FILE}"
echo "=============================================================================="
echo "This operation will OVERWRITE existing data in '${DB_NAME}' with the backup snapshot."

if [ "${FORCE_FLAG}" != "--force" ]; then
    read -p "Are you sure you want to proceed? Type 'RESTORE' to confirm: " CONFIRM
    if [ "${CONFIRM}" != "RESTORE" ]; then
        echo "Restoration cancelled by operator."
        exit 0
    fi
fi

# 1. Take safety pre-restore backup first
PRE_RESTORE_FILE="/var/backups/nexa-lms/pre_restore_safety_$(date +'%Y%m%d_%H%M%S').sql.gz"
echo "Creating pre-restore safety snapshot at: ${PRE_RESTORE_FILE}..."
mkdir -p /var/backups/nexa-lms
if [ -n "${DB_PASSWORD}" ]; then
    MYSQL_PWD="${DB_PASSWORD}" mysqldump --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" \
        --single-transaction --quick "${DB_NAME}" | gzip -9 > "${PRE_RESTORE_FILE}" || true
else
    mysqldump --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" \
        --single-transaction --quick "${DB_NAME}" | gzip -9 > "${PRE_RESTORE_FILE}" || true
fi

# 2. Decompress and restore into database
echo "Streaming backup data into '${DB_NAME}'..."
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    if [ -n "${DB_PASSWORD}" ]; then
        gzip -dc "${BACKUP_FILE}" | MYSQL_PWD="${DB_PASSWORD}" mysql \
            --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" "${DB_NAME}"
    else
        gzip -dc "${BACKUP_FILE}" | mysql \
            --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" "${DB_NAME}"
    fi
else
    if [ -n "${DB_PASSWORD}" ]; then
        MYSQL_PWD="${DB_PASSWORD}" mysql \
            --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" "${DB_NAME}" < "${BACKUP_FILE}"
    else
        mysql --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" "${DB_NAME}" < "${BACKUP_FILE}"
    fi
fi

# 3. Verify restoration
echo "Verifying database tables..."
TABLE_COUNT=$(
    if [ -n "${DB_PASSWORD}" ]; then
        MYSQL_PWD="${DB_PASSWORD}" mysql --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" \
            -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${DB_NAME}';"
    else
        mysql --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" \
            -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${DB_NAME}';"
    fi
)

echo "✓ Restoration successful! '${DB_NAME}' currently contains ${TABLE_COUNT} tables."
