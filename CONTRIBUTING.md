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
