# Dashboard Monitoring KirimKarya

Dashboard comprehensive untuk monitoring infrastruktur KirimKarya dengan Grafana & Prometheus.

## Fitur

### System Monitoring
- **CPU Usage %** - Penggunaan CPU real-time
- **Memory Usage %** - Penggunaan RAM dengan thresholds
- **Disk Usage %** - Penggunaan storage untuk setiap mount point

### Redis Monitoring
- **Connected Clients** - Jumlah client yang terhubung
- **Memory Usage** - Penggunaan memory Redis
- **Commands/sec** - Throughput perintah Redis per detik

### PostgreSQL Monitoring
- **Active Connections** - Jumlah koneksi aktif ke database
- **Database Transactions** - TPS (Transactions Per Second)
- **Cache Hit Ratio** - Efisiensi cache

### MinIO Storage Monitoring
- **Used Storage** - Ruang penyimpanan yang terpakai
- **Available Space** - Ruang tersisa
- **Upload/Download Rate** - Throughput I/O

### BullMQ Queue Monitoring
- **Active Jobs Running** - Jobs sedang diproses
- **Failed Jobs (1h)** - Jobs yang gagal dalam 1 jam terakhir
- **Completed Jobs (1h)** - Jobs yang selesai dalam 1 jam terakhir
- **Jobs Waiting by Queue** - Antrian jobs per queue

### API Performance
- **p95 Latency** - Latency percentil ke-95 (target < 100ms)
- **Error Rate (5xx) %** - Persentase error server (target < 1%)
- **Requests Per Second** - API throughput

## Setup

### 1. Mulai Exporters

```bash
# Start monitoring infrastructure (exporters + Prometheus + Grafana)
docker-compose -f docker-compose.yml -f docker-compose.obsv.yml -f docker-compose.exporters.yml up -d
```

### 2. Akses Grafana

- **URL**: http://localhost:3015
- **Username**: admin
- **Password**: admin (change immediately in production)

### 3. Verify Prometheus Targets

- **URL**: http://localhost:9090/targets
- Pastikan semua exporters UP (hijau):
  - otel-collector:8889
  - node-exporter:9100
  - redis:9121
  - postgres:9187
  - minio:9000 (native metrics)

## Dashboard Panels

### Row 1: System Resources (Top-Left)
- CPU, RAM, Disk usage dengan alert threshold
- Real-time monitoring dengan 15-second granularity

### Row 2: Backend Services (Middle)
- Redis: Connected clients, Memory, Commands/sec
- PostgreSQL: Active connections, Transaction rate
- MinIO: Storage usage

### Row 3: Queue Processing (Bottom)
- Job counts: Active, Failed, Completed
- Queue depth per job type
- Processing throughput

### Row 4: API Health (Bottom)
- Latency p95 trend
- Error rate dengan threshold alerts
- Requests per second

## Metrics Queries

### CPU Usage
```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### Memory Usage
```promql
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
```

### Disk Usage
```promql
(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100
```

### Active BullMQ Jobs
```promql
sum(bullmq_active_jobs) or vector(0)
```

### Failed Jobs (1 hour)
```promql
sum(increase(bullmq_failed_jobs_total[1h])) or vector(0)
```

### Redis Memory
```promql
redis_used_memory or vector(0)
```

### PostgreSQL Connections
```promql
pg_stat_activity_count or vector(0)
```

### API Error Rate
```promql
(sum(rate(http_server_duration_milliseconds_count{status=~"5.."}[5m])) / 
 sum(rate(http_server_duration_milliseconds_count[5m]))) * 100
```

## Alert Thresholds (Recommended)

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| CPU Usage | > 70% | > 85% | Check running processes |
| Memory Usage | > 75% | > 90% | Restart container or scale |
| Disk Usage | > 75% | > 90% | Clean old data or expand |
| API Error Rate | > 1% | > 5% | Check logs, debug API |
| Failed Jobs (1h) | > 5 | > 20 | Check worker logs |
| Redis Memory | > 500MB | > 800MB | Flush cache or scale |
| DB Connections | > 80 | > 100 | Check connection pool |

## Prometheus Retention

Edit `docker-compose.obsv.yml` untuk adjust retention:

```yaml
prometheus:
  command:
    - --storage.tsdb.retention.time=30d  # Keep metrics for 30 days
    - --storage.tsdb.retention.size=10GB  # Or max 10GB
```

## Best Practices

1. **Dashboard Access Control**
   ```bash
   # Set strong admin password setelah pertama kali setup
   # Settings → Users → Admin → Change Password
   ```

2. **Backup Dashboard**
   ```bash
   # Export dashboard as JSON reguler untuk version control
   # Dashboard → Share → Export JSON
   ```

3. **Add Team Members**
   ```bash
   # Settings → Users → Invite users dengan role yang sesuai
   # Viewer: read-only
   # Editor: bisa create/edit dashboards
   # Admin: full access
   ```

4. **Set Up Alerts**
   ```bash
   # Alerts → Notification channels
   # Integrasikan dengan Slack, PagerDuty, atau email
   ```

5. **Custom Dashboards**
   - Buat dashboard per team (Frontend, Backend, DevOps)
   - Use variables/templating untuk multi-environment
   - Focus pada metrics yang actionable untuk setiap team

## Troubleshooting

### Prometheus: "targets show DOWN"
```bash
# Cek koneksi ke exporter
curl http://node-exporter:9100/metrics
curl http://redis-exporter:9121/metrics
curl http://postgres-exporter:9187/metrics
```

### Grafana: "No data" di panels
```bash
# 1. Verify datasource: Configuration → Data sources → Test
# 2. Check prometheus queries ada di targets
# 3. Ensure labels/metrics match: http://localhost:9090/graph
```

### Memory spike di Prometheus
```bash
# Reduce scrape interval di prometheus-config.yaml
global:
  scrape_interval: 30s  # Dari 15s menjadi 30s
```

## Monitoring Metrics Collection

### OpenTelemetry Integration
Dashboard otomatis collect metrics dari OTEL:
- `http_server_duration_milliseconds` - Latency histogram
- `http_server_request_count` - Request counter
- Custom business metrics dari aplikasi

### Adding Custom Metrics

Di aplikasi (API/Worker), export metrics:

```typescript
// contoh di Hono/Express middleware
const requestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'route', 'status_code']
});

middleware((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    requestDuration
      .labels(req.method, req.route.path, res.statusCode)
      .observe(Date.now() - start);
  });
  next();
});
```

## Performance

| Component | Memory | CPU | Notes |
|-----------|--------|-----|-------|
| node-exporter | ~20MB | minimal | Very lightweight |
| redis-exporter | ~30MB | minimal | Scales with key count |
| postgres-exporter | ~40MB | 1-2% | Depends on DB size |
| Prometheus | ~256MB | 2-5% | Depends on retention |
| Grafana | ~256MB | 1-3% | Lightweight UI |
| **Total** | **~600MB** | **~5-10%** | Can run on t2.small |

## Next Steps

1. **Set up Alerting**
   - Configure notification channels (Slack, PagerDuty)
   - Define alert rules untuk metrics penting

2. **Integrate with Logging**
   - Correlate Prometheus metrics dengan Loki logs
   - Click dari alert ke relevant logs

3. **Multi-Environment Dashboards**
   - Create separate dashboards untuk staging/production
   - Use variables untuk switch antar environment

4. **Historical Analysis**
   - Setup long-term storage (Thanos, Cortex)
   - Analyze trends dan capacity planning

5. **Team Training**
   - Latih team cara baca/interpret dashboards
   - Runbook untuk each alert condition

