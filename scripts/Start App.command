#!/bin/bash
# Navigate to the rag directory
cd "$HOME/Documents/rag" || exit

# Check if any containers for this project are currently running
RUNNING_CONTAINERS=$(docker-compose ps --filter "status=running" -q)

if [ -n "$RUNNING_CONTAINERS" ]; then
    echo "Containers are currently running. Stopping them..."
    docker-compose down
else
    echo "Containers are not running. Starting them..."
    docker-compose up
fi