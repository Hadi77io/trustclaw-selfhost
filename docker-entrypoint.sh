#!/bin/sh
set -e

# pgvector + schema. No migrations dir upstream, so db push is the supported path.
echo "[entrypoint] prisma db push..."
pnpm prisma db push --accept-data-loss --skip-generate

echo "[entrypoint] starting next on ${HOSTNAME}:${PORT}"
exec pnpm next start -H "${HOSTNAME}" -p "${PORT}"
