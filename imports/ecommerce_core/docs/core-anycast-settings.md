# Core Configuration for the Global Anycast Platform

The Business Activation Cloud (BAC) anycast edge stack is configured through a strongly typed Pydantic `Settings` object that centralizes environment variables for the platform. The configuration captured in `Core configuration for Global Anycast Platform.docx` covers the following domains:

- **API Metadata** – versioning, API base path, and descriptive details for the Global Anycast Platform service layer.
- **Security & Identity** – JWT secret key, algorithm, and access/refresh token expiration defaults.
- **CORS** – normalized handling of comma-separated or JSON array origins to simplify multi-tenant storefront onboarding.
- **Database Connectivity** – PostgreSQL host, credentials, and a computed `DATABASE_URL` builder that defaults to the `postgresql+asyncpg` driver.
- **Redis & Celery** – cache and task queue endpoints for real-time operations and asynchronous workloads.
- **PowerDNS Integration** – API endpoint and key for authoritative DNS management within the anycast control plane.
- **Kubernetes & Multi-Tenancy** – kubeconfig path, namespace prefixes, and tenant quota defaults for CPU, memory, and storage allocations.
- **Networking** – anycast IP ranges plus VXLAN identifiers for overlay provisioning.
- **Observability & Alerting** – Prometheus, Grafana, PagerDuty, and Slack endpoints for telemetry and incident response.
- **Rate Limiting & DDoS Protection** – per-minute rate limits and FastNetMon thresholds for packets-per-second and bits-per-second monitoring.
- **Email & Bootstrap Users** – SMTP settings and initial superuser credentials to seed the management plane.

The reference configuration is instantiated as shown below:

```python
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import PostgresDsn, validator, AnyHttpUrl

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Global Anycast Platform"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Multi-tenant DNS and DDoS protection platform"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_PORT: str = "5432"
    DATABASE_URL: Optional[PostgresDsn] = None

    @validator("DATABASE_URL", pre=True)
    def assemble_db_connection(cls, v, values):
        if isinstance(v, str):
            return v
        return PostgresDsn.build(
            scheme="postgresql+asyncpg",
            username=values.get("POSTGRES_USER"),
            password=values.get("POSTGRES_PASSWORD"),
            host=values.get("POSTGRES_SERVER"),
            port=int(values.get("POSTGRES_PORT", 5432)),
            path=f"/{values.get('POSTGRES_DB') or ''}",
        )

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None
    CELERY_BROKER_URL: str = "amqp://guest:guest@localhost:5672//"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    PDNS_API_URL: str = "http://localhost:8081"
    PDNS_API_KEY: str
    KUBECONFIG_PATH: Optional[str] = None
    K8S_NAMESPACE_PREFIX: str = "tenant-"
    ANYCAST_IP_RANGE: str = "203.0.113.0/24"
    VXLAN_VNI_START: int = 1000
    VXLAN_VNI_END: int = 9999
    PROMETHEUS_PUSHGATEWAY: str = "http://localhost:9091"
    GRAFANA_URL: str = "http://localhost:3000"
    GRAFANA_API_KEY: Optional[str] = None
    PAGERDUTY_ROUTING_KEY: Optional[str] = None
    SLACK_WEBHOOK_URL: Optional[str] = None
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    RATE_LIMIT_PER_MINUTE: int = 100
    MAX_TENANTS_PER_POP: int = 100
    DEFAULT_RESOURCE_QUOTA_CPU: str = "2000m"
    DEFAULT_RESOURCE_QUOTA_MEMORY: str = "4Gi"
    DEFAULT_RESOURCE_QUOTA_STORAGE: str = "20Gi"
    FASTNETMON_API_URL: str = "http://localhost:10007"
    DEFAULT_PPS_THRESHOLD: int = 100000
    DEFAULT_BPS_THRESHOLD: int = 1000000000
    SMTP_TLS: bool = True
    SMTP_PORT: Optional[int] = None
    SMTP_HOST: Optional[str] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[str] = None
    EMAILS_FROM_NAME: Optional[str] = None
    FIRST_SUPERUSER_EMAIL: str
    FIRST_SUPERUSER_PASSWORD: str

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

These settings ensure the FusionCommerce platform can inherit the same operational guardrails and edge networking posture as the broader BAC infrastructure.
