# KirimKarya Monitoring & Alerting — Design Spec

**Date:** 2026-07-04  
**Status:** Approved  
**Approach:** A — Template-driven JSON dashboards + single `alerting-rules.yml`

---

## 1. Context

KirimKarya is a photo-delivery and client-proofing platform. The observability stack is:

| Layer | Technology |
|-------|-----------|
| Backend API | Bun + Hono |
| Frontend | SvelteKit |
| Database | PostgreSQL |
| Cache | Redis |
| Object Storage | MinIO |
| Background Jobs | BullMQ |
| Metrics | Prometheus |
| Visualisation | Grafana v10+ |
| Log Aggregation | Loki |

---

## 2. Approach A — Template-driven JSON + Single YAML

Each dashboard is a self-contained JSON file importable via the Grafana UI ("Import Dashboard").  
The alerting configuration is a single YAML file loaded by Prometheus via `rule_files`.

### File structure

```
grafana/
  dashboards/
    kirimkarya-overview-dashboard.json
    infrastructure-dashboard.json
    worker-app-dashboard.json

prometheus/
  rules/
    alerting-rules.yml
```

---

## 3. Dashboard Design

### Layout convention
- Every dashboard uses `gridPos` sizing where the canvas is **24 units wide**.
- Two panels per row → each panel is **12 units wide** (`w: 12`).
- Full-width panels (e.g. Logs) use `w: 24`.
- Row height (`h`) is **8 units** for stat panels and **10 units** for time-series/logs.

### 3.1 KirimKarya Overview (`kirimkarya-overview-dashboard.json`)

| Row | Panel | Type | Datasource | Threshold logic |
|-----|-------|------|------------|-----------------|
| 1 | API Gateway RPS | Stat | Prometheus | Neutral / blue — no thresholds |
| 1 | API P95 Latency | Timeseries | Prometheus | Line chart only, no traffic-light |
| 2 | API Error Rate 5xx % | Stat | Prometheus | Green=0 %, Yellow>0 %, Red>5 % |
| 2 | Total Failed Jobs (1h) | Stat | Prometheus | Green=0, Yellow>0, Red>0 |

**PromQL expressions:**
- RPS: `sum(rate(http_server_duration_milliseconds_count[5m]))`
- P95 Latency: `histogram_quantile(0.95, sum(rate(http_server_duration_milliseconds_bucket[5m])) by (le))`
- Error Rate: `(sum(rate(http_server_duration_milliseconds_count{status=~"5.."}[5m])) / sum(rate(http_server_duration_milliseconds_count[5m]))) * 100`
- Failed Jobs: `sum(increase(bullmq_failed_jobs_total[1h])) or vector(0)`

**Threshold implementation (Grafana JSON field):**
```json
"thresholds": {
  "mode": "absolute",
  "steps": [
    { "color": "green", "value": null },
    { "color": "yellow", "value": 0.001 },
    { "color": "red", "value": 5 }
  ]
}
```
(Error Rate panel — Failed Jobs panel uses `value: 1` for red.)

### 3.2 Infrastructure & Persistence (`infrastructure-dashboard.json`)

| Row | Panel | Type | Datasource |
|-----|-------|------|------------|
| 1 | CPU Usage % | Timeseries | Prometheus |
| 1 | RAM Usage % | Timeseries | Prometheus |
| 2 | PostgreSQL Active Connections | Stat | Prometheus |
| 2 | MinIO Used Storage | Gauge | Prometheus |

**PromQL expressions:**
- CPU: `100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
- RAM: `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100`
- PG Connections: `pg_stat_activity_count or vector(0)`
- MinIO Storage (bytes used): `minio_cluster_capacity_usable_total_bytes - minio_cluster_capacity_usable_free_bytes or vector(0)`

No traffic-light thresholds on time-series panels. Gauge for MinIO uses percent-style display (unit: bytes).

### 3.3 Application & Worker (`worker-app-dashboard.json`)

| Row | Panel | Type | Datasource |
|-----|-------|------|------------|
| 1 | Jobs Waiting by Queue | Timeseries (stacked) | Prometheus |
| 1 | Active Jobs | Stat | Prometheus |
| 2 | Live Error Logs | Logs | Loki |

**Queries:**
- Jobs Waiting: `sum(bullmq_waiting_jobs) by (queue) or vector(0)` — stacked by `queue` legend
- Active Jobs: `sum(bullmq_active_jobs) by (queue) or vector(0)`
- Live Error Logs: `{service_name=~"api|worker"} | json | level=~"error|warn"`

Live Error Logs panel spans full width (`w: 24`).

---

## 4. Prometheus Alerting Rules

Single file: `prometheus/rules/alerting-rules.yml`

| Alert name | Expression | For | Severity |
|------------|-----------|-----|----------|
| `API_HighErrorRate` | Error rate > 5 % | 5m | critical |
| `API_HighLatency` | P95 latency > 1000 ms | 5m | warning |
| `Worker_QueueStagnation` | Waiting jobs > 50 | 10m | critical |
| `MinIO_StorageWarning` | Used storage > 85 % | 15m | warning |

All annotations are written in Indonesian (Bahasa Indonesia) to match the team's working language.

---

## 5. Error Handling

- Dashboards gracefully handle missing metrics via `or vector(0)` in PromQL where applicable.
- Prometheus `for` clauses prevent alert flapping on transient spikes.
- Loki logs panel defaults to "last 1 hour" time range so it is not empty on load.

---

## 6. Out of Scope

- Grafana alerting (in-app): this spec covers Prometheus rules only.
- Notification channels (PagerDuty, Slack, email) are managed separately in Alertmanager config.
- Redis and Bun/Hono-specific metrics beyond what is exposed via existing Prometheus exporters.
