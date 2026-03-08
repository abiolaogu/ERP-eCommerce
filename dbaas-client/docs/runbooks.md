# Runbooks

## 1. Local Mock Validation
```bash
npm install
make smoke
```
Expected result: mock lifecycle test passes (create, rotate credentials, backup, restore, delete).

## 2. Wire Into a New Project
1. Copy module:
```bash
./scripts/scaffold.sh /absolute/path/to/project dbaas-client
```
2. In target project, import client:
```ts
import { createDbaasClient } from "./dbaas-client/dist/index.js";
```
3. Configure env vars:
- `UCP_DBAAS_BASE_URL`
- `UCP_DBAAS_TOKEN`
- `UCP_DBAAS_MOCK_MODE`

## 3. Troubleshooting
- `401 authorization required`
  - Ensure `token` or `tokenProvider` is configured.
- `400 missing X-Tenant-ID`
  - Ensure scope includes `tenantId` and `projectId`.
- timeout failures
  - Increase `timeoutMs` and inspect network path.

## 4. Backward-Compatible Dev Strategy
Use `mockMode=true` while infrastructure is unavailable. Keep the same method signatures so switching to real API requires only config changes.
