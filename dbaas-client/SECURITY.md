# Security Policy

## Reporting
Report vulnerabilities through your private security channel before public disclosure.

## Security Defaults
- Bearer token auth enabled by default.
- Tenant and project headers required for scoped operations.
- Retry behavior only for retryable transport and 5xx classes.
- Idempotency key support for mutation safety.

## Hard Requirements
- Never log tokens.
- Never disable TLS certificate validation in production clients.
- Keep token sourcing external (environment/secret manager), not hardcoded.
