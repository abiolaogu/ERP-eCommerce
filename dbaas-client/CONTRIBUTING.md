# Contributing

## Workflow
1. Create a branch with prefix `codex/`.
2. Add or update tests before code changes.
3. Run `make lint test` locally.
4. Open a PR with a clear summary and risk notes.

## Standards
- Keep API contracts in sync with `api/openapi.yaml`.
- Preserve tenant/project scoping behavior.
- Do not relax auth or retry defaults without ADR-level discussion.

## Release
- Bump version in `package.json`.
- Update `README.md` and `docs/runbooks.md` for behavior changes.
