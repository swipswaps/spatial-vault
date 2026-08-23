#!/bin/bash
# NO set -e – safe for your terminal

echo "=== Spatial Vault Docker Management ==="

# Find containers with label or image name
CONTAINERS=$(docker ps -a --filter "label=project=spatial-vault" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null)
if [ -z "$CONTAINERS" ] || [ "$CONTAINERS" == "CONTAINER ID   IMAGE   STATUS   PORTS" ]; then
  # Fallback: search by image name pattern
  CONTAINERS=$(docker ps -a --filter "ancestor=spatial-vault-backend" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null)
fi

if [ -z "$CONTAINERS" ] || [ "$CONTAINERS" == "CONTAINER ID   IMAGE   STATUS   PORTS" ]; then
  echo "No Spatial Vault containers found."
  exit 0
fi

echo "Found the following containers:"
echo "$CONTAINERS"
echo ""

# Count running containers
RUNNING=$(docker ps --filter "label=project=spatial-vault" --filter "status=running" -q | wc -l)
if [ "$RUNNING" -gt 0 ]; then
  echo "🟢 $RUNNING container(s) running."
else
  echo "🔴 No containers currently running."
fi

echo ""
echo "Options:"
echo "  1) Kill all containers (stop and remove)"
echo "  2) Upgrade (pull latest image, recreate containers)"
echo "  3) Show logs for running containers"
echo "  4) Exit"
read -p "Choose (1-4): " choice

case $choice in
  1)
    echo "Stopping and removing all Spatial Vault containers..."
    docker stop $(docker ps -a --filter "label=project=spatial-vault" -q) 2>/dev/null
    docker rm $(docker ps -a --filter "label=project=spatial-vault" -q) 2>/dev/null
    echo "✅ Containers removed."
    ;;
  2)
    echo "Pulling latest images..."
    docker compose pull 2>/dev/null || echo "No docker-compose found, skipping pull"
    echo "Recreating containers..."
    docker compose up -d --build 2>/dev/null || echo "No docker-compose found, run manually."
    ;;
  3)
    echo "Logs for running containers:"
    docker logs --tail=50 $(docker ps --filter "label=project=spatial-vault" -q) 2>&1
    ;;
  4)
    echo "Exiting."
    ;;
  *)
    echo "Invalid choice."
    ;;
esac
