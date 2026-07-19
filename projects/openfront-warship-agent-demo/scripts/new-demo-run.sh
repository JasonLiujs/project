#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
target="${1:-${repo_root}/../openfront-warship-demo-run}"
baseline_tag="demo-warship-buggy-v2"

if [[ -e "${target}" ]]; then
    echo "Refusing to overwrite existing target: ${target}" >&2
    exit 1
fi

if ! git -C "${repo_root}" rev-parse --verify "refs/tags/${baseline_tag}" > /dev/null; then
    echo "Missing baseline tag: ${baseline_tag}" >&2
    exit 1
fi

branch="demo/run-$(date +%Y%m%d-%H%M%S)"
git -C "${repo_root}" worktree add -b "${branch}" "${target}" "${baseline_tag}"

echo "Created clean demo run:"
echo "  branch: ${branch}"
echo "  path:   ${target}"
