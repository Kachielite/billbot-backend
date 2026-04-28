#!/bin/sh
set -e

echo "→ Running migrations"
node dist/common/lib/database/migrate.js

echo "→ Starting BillBot"
exec node dist/index.js
