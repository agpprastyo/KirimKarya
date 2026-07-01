# Branching Strategy Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the dual-remote Git branching strategy: create a private GitHub repo, configure the second remote, update `.gitignore` to exclude internal docs from the public repo, and push all history to private.

**Architecture:** Add a `private` remote pointing to a new private GitHub repository. Update `.gitignore` to exclude `docs/superpowers/` and `.superpowers/` from the public `origin`. Push full history including internal docs to `private` as a complete backup.

**Tech Stack:** Git CLI, GitHub (web UI for repo creation step)

## Global Constraints

- Never force-push to `origin master` without explicit user consent.
- The `.env*` files must never be committed (already in `.gitignore`).
- `docs/superpowers/` and `.superpowers/` must not appear in `origin` after this plan completes.
- All git commands run from `/home/agprastyo/Developments/KirimKarya`.

---

### Task 1: Create Private GitHub Repository

**Files:**
- No file changes — this is a GitHub web UI task + git remote config.

**Interfaces:**
- Produces: `private` remote URL in format `https://github.com/agpprastyo/KirimKarya-internal.git` (or SSH: `git@github.com:agpprastyo/KirimKarya-internal.git`)

- [ ] **Step 1: Create the private repo on GitHub**

  Go to: https://github.com/new

  Fill in:
  - Repository name: `KirimKarya-internal`
  - Visibility: **Private** ← WAJIB
  - **Do NOT** initialize with README, .gitignore, or license (repo must be empty)

  Click **Create repository**.

- [ ] **Step 2: Copy the remote URL**

  After creation, GitHub shows the clone URL. Copy either:
  - HTTPS: `https://github.com/agpprastyo/KirimKarya-internal.git`
  - SSH: `git@github.com:agpprastyo/KirimKarya-internal.git`

  (Recommended: SSH if SSH key already configured on this machine)

- [ ] **Step 3: Add the private remote**

  ```bash
  git remote add private git@github.com:agpprastyo/KirimKarya-internal.git
  # atau jika pakai HTTPS:
  git remote add private https://github.com/agpprastyo/KirimKarya-internal.git
  ```

- [ ] **Step 4: Verify both remotes exist**

  Run:
  ```bash
  git remote -v
  ```

  Expected output:
  ```
  origin   https://github.com/agpprastyo/KirimKarya.git (fetch)
  origin   https://github.com/agpprastyo/KirimKarya.git (push)
  private  git@github.com:agpprastyo/KirimKarya-internal.git (fetch)
  private  git@github.com:agpprastyo/KirimKarya-internal.git (push)
  ```

- [ ] **Step 5: Push full history to private**

  ```bash
  git push private --all
  git push private --tags
  ```

  Expected: All branches and tags pushed to `KirimKarya-internal`. First push may take a moment.

---

### Task 2: Update `.gitignore` to Exclude Internal Docs from Public Repo

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Existing `.gitignore` at repo root
- Produces: Updated `.gitignore` that excludes `docs/superpowers/` and `.superpowers/`

- [ ] **Step 1: Verify current tracking status**

  Run:
  ```bash
  git ls-files docs/superpowers/ .superpowers/
  ```

  This shows which files in those directories are currently tracked by git. We need to untrack them.

- [ ] **Step 2: Add exclusions to `.gitignore`**

  Append to `.gitignore`:
  ```gitignore

  # Internal SDD & agentic planning docs (private repo only)
  .superpowers/
  docs/superpowers/
  ```

- [ ] **Step 3: Remove tracked files from public git index (without deleting them locally)**

  ```bash
  git rm -r --cached docs/superpowers/ .superpowers/
  ```

  This untracks the files from git without deleting them from disk. They will now be ignored going forward.

  Expected: Output lists all files being removed from index.

- [ ] **Step 4: Verify files still exist locally**

  ```bash
  ls docs/superpowers/
  ls .superpowers/
  ```

  Expected: Files still present on disk — `git rm --cached` does not delete local files.

- [ ] **Step 5: Verify files are now ignored**

  ```bash
  git status
  ```

  Expected: `docs/superpowers/` and `.superpowers/` should NOT appear in the status output (not as staged, not as untracked).

- [ ] **Step 6: Commit the `.gitignore` update**

  ```bash
  git add .gitignore
  git commit -m "chore: exclude internal sdd docs from public repo via gitignore"
  ```

---

### Task 3: Sync Both Remotes and Verify Clean State

**Files:**
- No new files.

**Interfaces:**
- Consumes: Updated `master` branch with Task 2 commit, `private` remote from Task 1.

- [ ] **Step 1: Push new commits to private (includes the gitignore commit)**

  ```bash
  git push private master
  ```

- [ ] **Step 2: Push master to public origin**

  ```bash
  git push origin master
  ```

- [ ] **Step 3: Verify internal docs are NOT in public repo**

  Run:
  ```bash
  git ls-remote origin HEAD | head -1
  ```

  Then verify on GitHub (browser): go to `github.com/agpprastyo/KirimKarya`, confirm `docs/superpowers/` and `.superpowers/` directories do **not** appear in the file tree.

- [ ] **Step 4: Verify internal docs ARE in private repo**

  ```bash
  git push private master  # already done in step 1, just confirm
  git log --oneline -3     # verify commit history is intact
  ```

  Then verify on GitHub (browser): go to `github.com/agpprastyo/KirimKarya-internal`, confirm `docs/superpowers/` and `.superpowers/` directories are visible.

- [ ] **Step 5: Final sanity check**

  Run:
  ```bash
  git remote -v
  git status
  git log --oneline -5
  ```

  Expected:
  - Two remotes (`origin` and `private`) visible
  - Working tree is clean
  - Recent commits visible including the `.gitignore` update

---

### Task 4: Document the Daily Workflow (Quick Reference)

**Files:**
- Create: `CONTRIBUTING.md` at repo root

**Interfaces:**
- Produces: Public-facing developer guide that explains branch conventions, pre-merge checklist, and commit message format for any contributor (and as a portfolio signal of engineering discipline).

- [ ] **Step 1: Create CONTRIBUTING.md**

  Create `/home/agprastyo/Developments/KirimKarya/CONTRIBUTING.md`:

  ```markdown
  # Contributing to KirimKarya

  ## Branching Strategy

  This project uses a simplified GitHub Flow with a single permanent branch.

  ### Branch: `master`

  - Always clean, tested, and deployable.
  - All work happens in short-lived feature branches.

  ### Branch Naming

  | Prefix | Example | When |
  |--------|---------|------|
  | `feat/` | `feat/gallery-sharing` | New feature |
  | `fix/` | `fix/otp-rate-limit` | Bug fix |
  | `hotfix/` | `hotfix/auth-crash` | Critical fix |
  | `refactor/` | `refactor/query-perf` | Code improvement |
  | `chore/` | `chore/update-deps` | Maintenance |

  ## Pre-Merge Checklist

  Before merging any branch to `master`:

  - [ ] `bun test` → 0 failures
  - [ ] `bun x tsc --noEmit` → 0 errors
  - [ ] No secrets or `.env*` files staged

  ## Commit Messages

  This project uses [Conventional Commits](https://www.conventionalcommits.org/):

  ```
  <type>(<scope>): <short description>
  ```

  Types: `feat` | `fix` | `refactor` | `chore` | `docs` | `test` | `perf` | `ci`

  Examples:
  - `feat(gallery): add password-protected access mode`
  - `fix(auth): resolve null pointer on expired session`
  - `chore: update bun to v1.4`

  ## Development Setup

  See [README.md](./README.md) for local setup instructions.
  ```

- [ ] **Step 2: Commit CONTRIBUTING.md**

  ```bash
  git add CONTRIBUTING.md
  git commit -m "docs: add contributing guide with branching and commit conventions"
  ```

- [ ] **Step 3: Push to both remotes**

  ```bash
  git push origin master
  git push private master
  ```

- [ ] **Step 4: Verify on GitHub**

  Visit `github.com/agpprastyo/KirimKarya` — GitHub automatically renders `CONTRIBUTING.md` and shows a "Read the contributing guide" link on the repo home and on new issue/PR pages. Confirm it's visible.
