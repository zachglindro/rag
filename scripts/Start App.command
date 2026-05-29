#!/bin/bash
# Navigate to the rag directory
cd "$HOME/Documents/rag" || exit

# Check whether Docker Desktop / Docker daemon is available
if ! docker info >/dev/null 2>&1; then
    echo "Docker Desktop does not appear to be running."
    echo "Please open Docker Desktop first, then open this script again."
    exit 1
fi

# Check if any containers for this project are currently running
RUNNING_CONTAINERS=$(docker-compose ps --filter "status=running" -q 2>/dev/null)

if [ -n "$RUNNING_CONTAINERS" ]; then
    echo "Containers are currently running. Stopping them..."
    docker-compose down
else
    echo "Containers are not running. Starting them..."
    docker-compose up
fi