# Design Specification: Git Branching Strategy

**Date:** 2026-07-01  
**Scope:** KirimKarya public repository + private internal repository  
**Author:** Portfolio project — solo developer

---

## 1. Objectives

- Establish `master` as the single source of truth and always-deployable branch in the public repository.
- Keep internal development artifacts (SDD docs, agentic planning files, WIP experiments) out of the public GitHub repository.
- Define a lightweight branching workflow appropriate for a solo developer who sometimes works on multiple features in parallel.
- Prepare for a future CI/CD pipeline without over-engineering now (YAGNI).

---

## 2. Repository Architecture

### Dual-Remote Model

```
local machine
    ├── remote: origin  → github.com/agpprastyo/KirimKarya         (PUBLIC)
    └── remote: private → github.com/agpprastyo/KirimKarya-internal (PRIVATE)
```

- **`origin` (public):** Contains only source code, tests, Docker configs, and public-facing documentation. This is what contributors, interviewers, and the general public see.
- **`private` (private):** Contains everything in `origin` plus internal SDD planning docs, agentic session ledgers, WIP branches, and experimental work. Acts as a full backup of local development state.

### What Goes Where

| Content | Public (`origin`) | Private (`private`) |
|---------|:-----------------:|:-------------------:|
| Source code (`apps/`, `packages/`) | ✅ | ✅ |
| Docker configs, Makefile, Caddyfile | ✅ | ✅ |
| `README.md`, public docs | ✅ | ✅ |
| `.env.production.example` | ✅ | ✅ |
| `docs/superpowers/` (spec & plan files) | ❌ | ✅ |
| `.superpowers/` (SDD ledgers, task briefs) | ❌ | ✅ |
| `.env*` actual values | ❌ | ❌ (never committed) |
| `wip/*` branches | ❌ (never pushed) | ✅ (safe to push) |
| `feat/`, `fix/`, `refactor/` branches | Only after merge to `master` | ✅ anytime |

---

## 3. Branch Structure

### Permanent Branches

| Branch | Location | Purpose |
|--------|----------|---------|
| `master` | Public + Private | Single source of truth. Always clean, tested, deployable. |

No other permanent branches. The public repository has exactly one long-lived branch.

### Temporary Branches (naming convention)

| Prefix | Example | When to use |
|--------|---------|-------------|
| `feat/` | `feat/gallery-zip-download` | New user-facing feature |
| `fix/` | `fix/otp-rate-limit-bypass` | Bug fix |
| `hotfix/` | `hotfix/critical-auth-crash` | Urgent fix on `master` |
| `refactor/` | `refactor/query-n-plus-one` | Code improvement, no new behavior |
| `chore/` | `chore/update-bun-runtime` | Dependency updates, tooling |
| `wip/` | `wip/websocket-experiment` | Experiments — **never pushed to public** |

All temporary branches are deleted after merge.

---

## 4. Development Workflows

### Feature / Refactor / Chore

```bash
# 1. Branch from master
git checkout master
git checkout -b feat/gallery-sharing

# 2. Develop, commit regularly (Conventional Commits)
git commit -m "feat(gallery): add shareable link generation"

# 3. Backup to private anytime
git push private feat/gallery-sharing

# 4. When done: verify, merge, push to public
bun test && bun x tsc --noEmit
git checkout master
git merge feat/gallery-sharing
git push origin master          # → public
git push private master         # → private backup

# 5. Clean up
git branch -d feat/gallery-sharing
```

### Bug Fix

Same as feature workflow. For trivial single-file fixes (1–2 lines, obvious correctness), a direct commit to `master` is acceptable without creating a branch.

### Hotfix (critical issue on live master)

```bash
git checkout master
git checkout -b hotfix/critical-auth-crash

# Fix as fast as possible, minimal scope
git commit -m "fix(auth): prevent null session crash on expired cookie"

git checkout master
git merge hotfix/critical-auth-crash
git push origin master
git push private master
git branch -d hotfix/critical-auth-crash
```

### WIP / Experiment

```bash
git checkout -b wip/redis-pub-sub-experiment
# Work freely, never push to origin
git push private wip/redis-pub-sub-experiment   # ← private only, as backup
# If abandoned: git branch -D wip/redis-pub-sub-experiment
```

---

## 5. Pre-Merge Checklist

Before merging any branch into `master` and pushing to public:

- [ ] `bun test` passes with 0 failures
- [ ] `bun x tsc --noEmit` returns 0 errors
- [ ] No files from `.superpowers/` or `docs/superpowers/` are staged
- [ ] No `.env*` files are staged
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) format

---

## 6. `.gitignore` Additions

The following paths will be added to `.gitignore` to prevent internal files from ever reaching the public repository:

```gitignore
# Internal SDD & agentic planning docs (private repo only)
.superpowers/
docs/superpowers/
```

---

## 7. Setup Steps (Implementation)

1. Create a new **private** GitHub repository: `KirimKarya-internal`
2. Add it as a second remote: `git remote add private git@github.com:agpprastyo/KirimKarya-internal.git`
3. Push everything (including internal docs) to private: `git push private --all`
4. Add `.superpowers/` and `docs/superpowers/` to `.gitignore`
5. Commit the `.gitignore` update to `master` (this removes them from public tracking going forward)
6. Verify public repo no longer shows those paths

---

## 8. Future CI/CD Integration (When Ready)

When a CI/CD pipeline is added later, the branching strategy supports it with minimal changes:

- GitHub Actions on `push to master` → run tests, build Docker images, deploy
- No additional branches needed (GitHub Flow maps naturally to CI/CD)
- The private repo can also have its own actions for internal validation

---

## 9. Commit Message Convention

All commits use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

Types: feat | fix | refactor | chore | docs | test | perf | ci
```

Examples:
- `feat(gallery): add password-protected access mode`
- `fix(auth): resolve null pointer on expired session`
- `refactor(api): replace any types with typed alternatives`
- `chore: update bun to v1.4`
