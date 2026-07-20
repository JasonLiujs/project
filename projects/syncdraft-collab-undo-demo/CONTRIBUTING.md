# Contributing to SyncDraft

Thank you for your interest in contributing to SyncDraft — we appreciate your time and help!

This document explains how to get started, how to propose changes, and what we expect from contributors. If you're new to open source, welcome — we try to make onboarding as simple as possible.

## Table of contents
- What we welcome
- Quick start (run locally)
- How to pick an issue
- Branches, commits & PRs
- Testing & linting
- Reviewing process
- Labels
- License & contributor terms
- Getting help

---

## What we welcome
- Bug reports and reproducible test cases
- Documentation improvements and tutorials
- Small features and quality-of-life improvements
- Help triaging issues and mentoring new contributors

If you're unsure where to start, look for issues labeled `good first issue` or `help wanted`.

---

## Quick start (run locally)

1. Fork the repository and clone your fork:
```bash
git clone https://github.com/<your-username>/Distributed-Collaborative-Editor.git
cd Distributed-Collaborative-Editor
```

2. Install dependencies and start the backend and frontend in separate terminals:

Backend:
```bash
cd server
cp .env.example .env        # set REDIS_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
npm install
npm start
```

Frontend:
```bash
cd syncraft
cp .env.example .env        # set REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_WS_URL
npm install
npm start
```

Default ports:
- Backend: ws://localhost:1234
- Frontend: http://localhost:3000

---

## How to pick an issue
- `good first issue` — for newcomers
- `help wanted` — smaller but useful tasks
- `bug` — confirmed bugs and reproducible problems
- `enhancement` — new features or UX improvements

If you'd like to work on an issue, comment on it so maintainers and others know you're working on it.

---

## Branches, commits & PRs
- Create a feature branch from `main`:
  - git checkout -b feat/short-description
  - git checkout -b fix/short-description
- Commit messages: use clear, present-tense summary lines, e.g.:
  - "fix: handle redis connection error on startup"
  - "feat: add export to docx option"
- Squash small fixup commits before merging, or use PR squash merge if enabled.

---

## Pull request process
1. Open a PR against `main`.
2. In your PR description, include:
   - What problem this solves
   - Screenshots (if UI)
   - How to test locally
   - Related issue number (if any)
3. Fill the PR template checklist (automatically added if using template).
4. A maintainer or reviewer will provide feedback. Address requested changes by updating your branch.
5. Once approved, a maintainer will merge.

---

## Tests & quality
- Add tests for significant changes when applicable.
- If you modify frontend styles or scripts, include screenshots and accessibility considerations.
- Lint and format your code before opening the PR (we recommend Prettier / ESLint — if you add tooling, document it here).

---

## Review expectations
- Be responsive to code review comments.
- Keep PRs focused and small where possible.
- If a PR stays inactive for a long time, maintainers may close it; you can re-open or re-submit later.

---

## Labels
Common labels we use:
- good first issue
- help wanted
- bug
- enhancement
- documentation
- blocked

If you think a new label would help triage, suggest it in an issue.

---

## License & contributor terms
By contributing to this repository, you agree that your contributions will be licensed under the repository's MIT License (see LICENSE). If this is not acceptable, do not submit a patch.

---

## Getting help
If you have questions before starting:
- Open an issue describing what you want to do.
- Mention `@Sachin1395` or ping in the issue.

We appreciate time and effort — thank you for helping make SyncDraft better!
