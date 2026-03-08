# DBaaS Integration

ERP-eCommerce integrates a reusable UGCP DBaaS client module via server-side API routes.

## Architecture
- `dbaas-client/`: reusable module copied from UGCP template.
- `src/lib/dbaas/server-client.ts`: server-only adapter and scope mapping.
- `src/app/api/dbaas/*`: route handlers proxied to DBaaS client.
- `src/features/dbaas/*`: UI service, hooks, and dashboard panel.

## Security
- DBaaS token is read from `UCP_DBAAS_TOKEN` on the server.
- Browser never directly calls DBaaS upstream endpoints.
- Tenant and project are always forwarded as headers.

## Development Mode
Set `UCP_DBAAS_MOCK_MODE=true` and `NEXT_PUBLIC_DBAAS_MOCK_MODE=true` for deterministic local usage before infrastructure deployment.
