#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if ! command -v gh >/dev/null; then
  echo 'Install GitHub CLI first: brew install gh' >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  gh auth login --hostname github.com --web --git-protocol https
fi
owner=$(gh api user --jq .login)
repo="$owner/flora-field"
if [[ "$owner" != 'Ziyuhua25' ]]; then
  echo "Unexpected GitHub account: $owner. Switch to Ziyuhua25 and rerun." >&2
  exit 1
fi
if gh repo view "$repo" >/dev/null 2>&1; then
  echo "Repository already exists: https://github.com/$repo. Stopping to avoid overwriting existing work." >&2
  exit 1
fi
if [[ -e .git ]]; then
  echo 'A Git repository already exists in this directory. Stopping to avoid unintended changes.' >&2
  exit 1
fi
gh auth setup-git
git init -b main
git add index.html README.md .nojekyll
git -c user.name="$owner" -c user.email="$(gh api user --jq .id)+$owner@users.noreply.github.com" commit -m 'Initial release of FLORA / FIELD'
gh repo create "$repo" --public --description 'Gesture-controlled interactive particle art' --source=. --remote=origin --push
if gh api --method POST "repos/$repo/pages" --input - <<'JSON'
{"source":{"branch":"main","path":"/"},"build_type":"legacy"}
JSON
then
  echo "Pages enabled. Check deployment at https://github.com/$repo/actions"
else
  echo "Repository uploaded, but enabling Pages via API failed. Open https://github.com/$repo/settings/pages and select main / (root)." >&2
fi
echo "Repository: https://github.com/$repo"
echo "Expected public URL after deployment: https://$owner.github.io/flora-field/"
