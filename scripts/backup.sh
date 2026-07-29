#!/usr/bin/env bash
#
# backup.sh — PostgreSQL backup script using pg_dump
#
# Usage:
#   ./scripts/backup.sh                        # uses defaults
#   DATABASE_URL="postgres://..." ./scripts/backup.sh
#
# Environment variables (with defaults):
#   DATABASE_URL   PostgreSQL connection string
#   BACKUP_DIR     Directory to store backups      (default: ./backups)
#   RETENTION_DAYS Number of days to keep backups   (default: 7)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR)"

DATABASE_URL="${DATABASE_URL:-postgres://user:password@localhost:5432/soroban_explorer}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="soroban_explorer_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup of soroban_explorer..."
pg_dump "$DATABASE_URL" --no-owner --clean | gzip > "$BACKUP_DIR/$BACKUP_FILE"

echo "[$(date)] Backup saved: $BACKUP_DIR/$BACKUP_FILE  ($(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1))"

# Retention: remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "soroban_explorer_*.sql.gz" -type f -mtime "+$RETENTION_DAYS" -delete
echo "[$(date)] Retention applied: removed backups older than ${RETENTION_DAYS} days."

echo "[$(date)] Backup complete."
