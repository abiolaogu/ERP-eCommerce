# UGCP DBaaS Client Module (Template)

Reusable TypeScript client template for UGCP DBaaS APIs. This module is designed to be copied into other projects so teams can ship against a consistent DBaaS contract before infrastructure is fully deployed.

## What You Get
- Typed DBaaS client for instance lifecycle, backups, restore, and credential rotation.
- Zero-trust defaults: bearer auth, tenant/project scoping headers, idempotency key support.
- Deterministic behavior: retry policy, timeouts, structured error handling.
- Mock mode for local development without live backend APIs.
- OpenAPI contract for the expected DBaaS API surface.
- CI pipeline, tests, Dockerfile, and Make targets.

## Quick Start
```bash
cd templates/dbaas-client-module-ts
npm install
make test
```

Example usage:
```bash
node examples/basic-usage.mjs
```

## Copy Into Another Project
```bash
./scripts/scaffold.sh /absolute/path/to/target-project dbaas-client
```

This creates `/absolute/path/to/target-project/dbaas-client` with the full module.

## Environment Variables
- `UCP_DBAAS_BASE_URL`: DBaaS API base URL (for example, `http://localhost:8780`).
- `UCP_DBAAS_TOKEN`: Bearer token.
- `UCP_DBAAS_TIMEOUT_MS`: Request timeout in milliseconds.
- `UCP_DBAAS_RETRIES`: Retry attempts for retryable failures.
- `UCP_DBAAS_RETRY_BASE_DELAY_MS`: Initial retry delay in milliseconds.
- `UCP_DBAAS_MOCK_MODE`: `true` to use mock backend.

## Reading Order
1. [docs/architecture.md](docs/architecture.md)
2. [api/openapi.yaml](api/openapi.yaml)
3. [docs/runbooks.md](docs/runbooks.md)
4. [examples/basic-usage.mjs](examples/basic-usage.mjs)

## License
Apache-2.0
