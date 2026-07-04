# 📊 Infrastructure Monitoring Setup

Panduan cepat untuk setup dashboard monitoring KirimKarya menggunakan Grafana, Prometheus, dan berbagai exporters.

## 🚀 Quick Start

### Option 1: Menggunakan Make Command (Recommended)

```bash
# Start monitoring infrastructure
make monitoring-start

# Check status
make monitoring-status

# Stop monitoring
make monitoring-stop
```

### Option 2: Menggunakan Docker Compose Langsung

```bash
# Start semua services
docker-compose -f docker-compose.yml \
               -f docker-compose.obsv.yml \
               -f docker-compose.exporters.yml \
               up -d

# View logs
docker-compose -f docker-compose.yml \
               -f docker-compose.obsv.yml \
               -f docker-compose.exporters.yml \
               logs -f
```

## 📈 Access Monitoring Services

Setelah services berjalan, akses melalui browser:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | http://localhost:3015 | admin / admin |
| **Prometheus** | http://localhost:9090 | - |
| **Tempo (Traces)** | http://localhost:3200 | - |
| **Loki (Logs)** | http://localhost:3100 | - |
| **Node Exporter Metrics** | http://localhost:9100/metrics | - |
| **Redis Exporter Metrics** | http://localhost:9121/metrics | - |
| **PostgreSQL Exporter Metrics** | http://localhost:9187/metrics | - |

## 📋 Dashboard Sections

### 1. System Resources (Top Row)
- **CPU Usage %** - Real-time CPU utilization
- **Memory Usage %** - RAM consumption dengan warning/critical thresholds
- **Disk Usage %** - Storage utilization per mount point

### 2. Services Health (Middle Row)
- **Redis**: Connected clients, Memory usage, Commands/sec
- **PostgreSQL**: Active connections, Transaction rate, Query performance
- **MinIO**: Storage used, Available space, I/O throughput

### 3. Job Queue Processing (Bottom Row)
- **Active Jobs Running** - Jobs sedang diproses
- **Failed Jobs (1h)** - Jobs yang gagal dalam 1 jam
- **Completed Jobs (1h)** - Jobs yang berhasil dalam 1 jam
- **Jobs Waiting by Queue** - Antrian jobs per queue type

### 4. API Performance (Bottom)
- **p95 Latency** - API response time percentil ke-95
- **Error Rate (5xx) %** - Server error rate
- **Redis Commands/sec** - Cache throughput

## ⚙️ Configuration

### Prometheus Scrape Interval
Edit `config/prometheus-config.yaml`:
```yaml
global:
  scrape_interval: 15s      # Ubah ke 30s untuk production
  evaluation_interval: 15s
```

### Alert Rules
Alert rules sudah dikonfigurasi di `config/alert-rules.yaml`:
- ✅ CPU > 80% (warning), > 90% (critical)
- ✅ Memory > 80% (warning), > 90% (critical)
- ✅ Disk > 75% (warning), > 90% (critical)
- ✅ API error rate > 1% (warning), > 5% (critical)
- ✅ BullMQ failure rate > 5% (warning)
- ✅ Redis/PostgreSQL/MinIO down (critical)

### Data Retention
Edit `docker-compose.obsv.yml` untuk Prometheus data retention:
```yaml
prometheus:
  command:
    - --storage.tsdb.retention.time=7d    # Keep 7 days
    - --storage.tsdb.retention.size=10GB  # Or max 10GB
```

## 🔒 Security (Production)

### Change Grafana Admin Password

1. Login ke Grafana: http://localhost:3015
2. Settings → Users → Admin
3. Change Password
4. Save

### Enable Authentication
```bash
# Edit docker-compose.obsv.yml
grafana:
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=<strong-password>
    - GF_SECURITY_DISABLE_INITIAL_ADMIN_CHANGE=false
    - GF_USERS_ALLOW_SIGN_UP=false
```

### Restrict Access
```bash
# Using reverse proxy (Nginx/Caddy)
# Only expose Grafana, hide Prometheus/Loki/Tempo
```

## 📊 Key Metrics Explained

### CPU Usage
```
Formula: 100 - (idle time percentage)
Healthy: < 70%
Warning: 70-85%
Critical: > 85%
```

### Memory Usage
```
Formula: (Total - Available) / Total * 100
Healthy: < 75%
Warning: 75-90%
Critical: > 90%
```

### Disk Usage
```
Formula: (Total - Available) / Total * 100
Healthy: < 75%
Warning: 75-90%
Critical: > 90%
```

### API Error Rate
```
Formula: (5xx responses) / (total responses) * 100
Healthy: < 1%
Warning: 1-5%
Critical: > 5%
```

### BullMQ Health
```
Active Jobs: Jobs currently being processed
Failed Jobs: Jobs yang error dalam periode tertentu
Completed Jobs: Jobs yang sukses dalam periode tertentu
Waiting Jobs: Jobs yang antri menunggu processing
```

## 🔧 Troubleshooting

### Prometheus "targets show DOWN"
```bash
# Test koneksi ke exporter
curl http://node-exporter:9100/metrics
curl http://redis-exporter:9121/metrics
curl http://postgres-exporter:9187/metrics

# Check Docker logs
docker logs kirimkarya-node-exporter
docker logs kirimkarya-redis-exporter
docker logs kirimkarya-postgres-exporter
```

### Grafana "No data" di panels
```bash
# 1. Verify datasource
#    Grafana > Configuration > Data Sources > Prometheus > Test

# 2. Check Prometheus targets
#    http://localhost:9090/targets

# 3. Run PromQL query manually
#    http://localhost:9090/graph
#    Example: node_memory_MemTotal_bytes
```

### Redis Exporter Connection Error
```bash
# Check Redis is running
docker logs kirimkarya-redis

# Check Redis exporter env var
docker logs kirimkarya-redis-exporter

# Verify Redis URL in exporter
REDIS_ADDR=redis://redis:6379  # Default in docker-compose
```

### PostgreSQL Exporter Connection Error
```bash
# Check DATABASE URL is correct
export DATA_SOURCE_NAME="postgresql://admin:admin123@postgres:5432/kirimkarya?sslmode=disable"

# Test connection
docker logs kirimkarya-postgres-exporter
```

## 📈 Performance Tips

### Reduce Memory Usage
```yaml
# Reduce cardinality (fewer unique label combinations)
# Reduce scrape frequency
global:
  scrape_interval: 30s  # dari 15s
```

### Improve Query Performance
```promql
# Use rate() untuk counters
rate(metric[5m])

# Use histogram_quantile() untuk latencies
histogram_quantile(0.95, rate(duration_bucket[5m]))

# Avoid `by (label)` yang terlalu banyak labels
```

### Disk Space Management
```bash
# Monitor Prometheus disk usage
docker exec prometheus df -h /prometheus

# Backup data sebelum cleanup
docker cp prometheus:/prometheus ./prometheus-backup

# Adjust retention policy
# Edit prometheus-config.yaml dan restart
```

## 🎯 Best Practices

### 1. Regular Backup
```bash
# Backup Grafana dashboards
make monitoring-backup

# Backup Prometheus data
docker exec prometheus tar czf /tmp/prometheus-backup.tar.gz /prometheus
docker cp prometheus:/tmp/prometheus-backup.tar.gz ./
```

### 2. Regular Updates
```bash
# Update images ke versi terbaru
docker-compose -f docker-compose.obsv.yml pull
docker-compose -f docker-compose.obsv.yml up -d --force-recreate
```

### 3. Alert Notification
Setup notification channels di Grafana:
- Email
- Slack
- PagerDuty
- Webhook custom

### 4. SLA Tracking
Create dashboards untuk track:
- Availability (uptime %)
- Error rate
- Response time p50/p95/p99
- Throughput

## 📚 Dokumentasi Lengkap

Lihat `docs/monitoring-dashboard.md` untuk dokumentasi detail tentang:
- Metrics queries
- Dashboard customization
- Multi-environment setup
- Historical analysis
- Team training

## 🛑 Cleanup

```bash
# Stop monitoring services
make monitoring-stop

# Stop semua services (including base infra)
make infra-down

# Reset everything (WARNING: DELETES DATA)
make infra-reset
```

## 📞 Support

Untuk masalah atau pertanyaan:
1. Check Prometheus targets: http://localhost:9090/targets
2. Review alert rules: http://localhost:9090/alerts
3. Check component logs: `make monitoring-logs <service>`
4. Lihat dokumentasi: `docs/monitoring-dashboard.md`

---

**Next Steps:**
1. ✅ Start monitoring: `make monitoring-start`
2. ✅ Access Grafana: http://localhost:3015
3. ✅ Verify all targets UP: http://localhost:9090/targets
4. ✅ View Infrastructure Monitoring dashboard
5. ✅ Change admin password
6. ✅ Setup alert notifications

