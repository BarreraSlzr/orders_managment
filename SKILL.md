---
name: github-conventional-commit-split
description: Produce a scoped Conventional Commit split plan for current git changes, grouping files into cohesive commits with add/commit commands.
metadata:
  short-description: Conventional commit split plan
---

# Conventional Commit Split Plan

Use this skill when you need to split the current git changes into a small set of scoped Conventional Commits. The output should list commit messages, file groups, and the exact `git add` and `git commit` commands for each group.

## Inputs

- Output of `git status --short`
- Output of `git diff --stat`
- File lists for new directories (if any)
- Brief notes on any coupling/ordering constraints (if needed)

## Steps

1. Collect a snapshot: `git status --short` and `git diff --stat`.
2. Expand new/untracked directories to list concrete files (use `find` or `ls -la`).
3. Read diffs for any modified files that may mix concerns (UI + logic, middleware + API, etc.).
4. Propose 3-6 cohesive commits grouped by feature area (e.g. auth, admin, UI, tests, docs).
5. For each commit, provide a scoped Conventional Commit message and file list.
6. Provide exact `git add` and `git commit` commands in the correct order.
7. Ask whether to regroup if the user wants fewer or larger commits.

## Output Template

```
Commit 1
- Message: feat(auth): add session config and helpers
- Files: lib/auth/config.ts, lib/auth/session.ts, lib/auth/cookies.ts
- Commands:
  git add lib/auth/config.ts lib/auth/session.ts lib/auth/cookies.ts
  git commit -m "feat(auth): add session config and helpers"

Commit 2
- Message: feat(auth): add auth API routes
- Files: app/api/auth/login/route.ts, app/api/auth/logout/route.ts, app/api/auth/me/route.ts
- Commands:
  git add app/api/auth/login/route.ts app/api/auth/logout/route.ts app/api/auth/me/route.ts
  git commit -m "feat(auth): add auth API routes"

Commit 3
- Message: test(auth): cover sessions and cookies
- Files: lib/auth/__tests__/session.test.ts, lib/auth/__tests__/cookies.test.ts
- Commands:
  git add lib/auth/__tests__/session.test.ts lib/auth/__tests__/cookies.test.ts
  git commit -m "test(auth): cover sessions and cookies"

Commit 4
- Message: docs(auth): document auth env vars
- Files: README.md, .env.local.example
- Commands:
  git add README.md .env.local.example
  git commit -m "docs(auth): document auth env vars"
```

## Command Example

```
# Stage and commit each group in order
git add <files>
git commit -m "type(scope): message"
```
