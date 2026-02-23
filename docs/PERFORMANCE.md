# Performance Strategy

## SLO Targets
- Read p99 < 200ms
- Write p99 < 500ms
- Error rate < 0.1%
- Availability >= 99.95%

## Engineering Controls
- Database pooling and query plans on critical reads
- Multi-layer caching (in-process + Redis)
- Async queues for heavy operations
- Idempotent retries and circuit-breaker policies

## Benchmarking
- Local perf smoke via `ERP-Platform/tools/perf-lab/run_perf_smoke.sh`
- CI governance checks for perf manifests and UX manifests
- Staging load and soak tests before release
