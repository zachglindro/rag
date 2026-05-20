#!/bin/sh
set -e

# Skip build scripts in container environment
export PNPM_SKIP_BUILD_SCRIPTS=1

# Start the dev server
exec pnpm dev
