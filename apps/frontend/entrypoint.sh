#!/bin/sh
set -e

# Skip build scripts in container environment
export PNPM_SKIP_BUILD_SCRIPTS=1

# Start the production server
exec pnpm start
