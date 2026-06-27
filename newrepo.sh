#!/bin/bash
# Kasi permission: chmod +x newrepo.sh
# Jalankan: ./newrepo.sh

# Buat repo di GitHub pake API (token dari env)
GITHUB_TOKEN="${GH_TOKEN:-$(gh auth token 2>/dev/null)}"
if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GH_TOKEN not set. Jalankan: export GH_TOKEN=ghp_xxx"
  exit 1
fi

REPO_NAME="Nyu-rrka"

# Create repo via API
curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"private\":true}" | grep -E '"clone_url"|"html_url"'

echo "Repo created! Now push:"
echo "cd /d/Tugas/Music App"
echo "git remote set-url origin https://github.com/NutZwel/$REPO_NAME.git"
echo "git push -u origin main --force"
