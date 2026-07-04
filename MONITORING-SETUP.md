# 📊 Infrastructure Monitoring Dashboard - Setup Complete

## ✅ Files Created

### 1. Dashboard Configuration
- **`config/dashboards/infrastructure-monitoring.json`** (33 KB)
  - Comprehensive Grafana dashboard dengan 14 panels
  - Monitors: CPU, RAM, Disk, Redis, PostgreSQL, MinIO, BullMQ, API Performance
  - Auto-refresh setiap 10 detik
  - 3-hour time window default

### 2. Alert Rules
- **`config/alert-rules.yaml`** (6.9 KB)
  - 25+ alert rules untuk infrastructure monitoring
  - CPU/Memory/Disk thresholds
  - Service health alerts (Redis, PostgreSQL, MinIO)
  - API error rate dan latency alerts
  - BullMQ queue processing alerts

### 3. Docker Compose Services
- **`docker-compose.exporters.yml`** (1.4 KB)
  - Node Exporter (sistem metrics)
  - Redis Exporter (cache metrics)
  - PostgreSQL Exporter (database metrics)

### 4. Configuration Updates
- **`config/prometheus-config.yaml`** (updated)
  - Added 4 scrape configs untuk exporters dan MinIO
  - Alert rules configuration
  - Alertmanager setup

- **`docker-compose.obsv.yml`** (updated)
  - Mounted alert-rules.yaml ke Prometheus
  - Added `--web.enable-lifecycle` flag

### 5. Documentation
- **`MONITORING.md`** (lengkap)
  - Quick start guide
  - Service URLs dan credentials
  - Dashboard sections overview
  - Configuration examples
  - Troubleshooting guide
  - Best practices

- **`docs/monitoring-dashboard.md`** (detail)
  - Comprehensive documentation
  - Metrics queries explained
  - Alert thresholds
  - Performance optimization
  - Multi-environment setup

### 6. Scripts
- **`scripts/setup-monitoring.sh`** (6.5 KB, executable)
  - Start/stop/restart monitoring
  - Health checks
  - Status verification
  - Dashboard backup

- **`scripts/test-monitoring.sh`** (5.7 KB, executable)
  - Endpoint connectivity tests
  - Metrics collection verification
  - Prometheus target validation
  - PromQL query tests

### 7. Makefile Updates
- **`Makefile`** (updated)
  - `make monitoring-start` - Start monitoring infrastructure
  - `make monitoring-stop` - Stop monitoring
  - `make monitoring-restart` - Restart services
  - `make monitoring-status` - Check health
  - `make monitoring-docs` - View documentation

## 🚀 Quick Start

```bash
# 1. Start monitoring infrastructure
make monitoring-start

# 2. Wait 30-60 seconds untuk exporters register
sleep 60

# 3. Test setup
bash scripts/test-monitoring.sh

# 4. Open Grafana
open http://localhost:3015
# Username: admin
# Password: admin

# 5. View Infrastructure Monitoring dashboard
# Dashboard > Dashboards > Infrastructure Monitoring
```

## 📊 Dashboard Panels

### Row 1: System Resources
- ✅ CPU Usage % (with 70%/85% thresholds)
- ✅ Memory Usage % (with 75%/90% thresholds)
- ✅ Disk Usage % (with 75%/90% thresholds)

### Row 2: Backend Services Status
- ✅ Redis Connected Clients
- ✅ Redis Memory Usage
- ✅ PostgreSQL Active Connections
- ✅ MinIO Used Storage

### Row 3: Job Queue Metrics
- ✅ Active Jobs Running
- ✅ Failed Jobs (Last 1h)
- ✅ Completed Jobs (Last 1h)
- ✅ Jobs Waiting by Queue

### Row 4: API Health
- ✅ Jobs Waiting by Queue (trend)
- ✅ API p95 Latency
- ✅ API Error Rate (5xx)
- ✅ Redis Commands/sec

## 🎯 Alert Rules Configured

### System Alerts (8 rules)
- CPU: Warning 80%, Critical 90%
- Memory: Warning 80%, Critical 90%
- Disk: Warning 75%, Critical 90%

### Service Alerts (9 rules)
- Redis down, Memory > 80%
- PostgreSQL down, High connections
- MinIO down, Low storage

### Application Alerts (8 rules)
- API error rate > 1% / > 5%
- API latency p95 > 1000ms
- BullMQ high failure rate
- BullMQ queue backlog
- BullMQ stalled processing

## 📈 Metrics Being Collected

### System (Node Exporter)
```
node_cpu_seconds_total
node_memory_MemAvailable_bytes
node_memory_MemTotal_bytes
node_filesystem_avail_bytes
node_filesystem_size_bytes
```

### Redis (Redis Exporter)
```
redis_connected_clients
redis_used_memory
redis_commands_processed_total
redis_info_server_uptime_in_seconds
```

### PostgreSQL (PostgreSQL Exporter)
```
pg_stat_activity_count
pg_slow_queries
pg_database_size_bytes
```

### MinIO (Native Metrics)
```
minio_cluster_capacity_usable_total_bytes
minio_cluster_capacity_usable_free_bytes
```

### BullMQ (OTEL/Custom Metrics)
```
bullmq_active_jobs
bullmq_waiting_jobs
bullmq_completed_jobs_total
bullmq_failed_jobs_total
```

### API (OTEL)
```
http_server_duration_milliseconds_bucket
http_server_duration_milliseconds_count
http_server_request_count
```

## 🔧 Configuration Points

### 1. Prometheus Scrape Interval
File: `config/prometheus-config.yaml`
```yaml
global:
  scrape_interval: 15s        # Default: 15s, Production: 30s
  evaluation_interval: 15s    # Alert check interval
```

### 2. Data Retention
File: `docker-compose.obsv.yml`
```yaml
prometheus:
  command:
    - --storage.tsdb.retention.time=7d    # Keep 7 days
    - --storage.tsdb.retention.size=10GB  # Or max 10GB
```

### 3. Alert Thresholds
File: `config/alert-rules.yaml`
- CPU: 80% (warning), 90% (critical)
- Memory: 80% (warning), 90% (critical)
- Disk: 75% (warning), 90% (critical)
- API Error Rate: 1% (warning), 5% (critical)
- BullMQ Failure Rate: 5% (warning)

## 🛡️ Security Checklist

- [ ] Change Grafana admin password: `Settings > Users > Admin > Change Password`
- [ ] Setup notification channels: `Alerts > Notification channels`
- [ ] Enable authentication for Prometheus (use reverse proxy)
- [ ] Restrict access to monitoring services (network/firewall)
- [ ] Regular backup of Grafana dashboards: `make monitoring-backup`
- [ ] Regular updates of images: `docker-compose pull`

## 🔍 Verification Steps

1. **Check Services Running**
   ```bash
   make monitoring-status
   ```

2. **Test Metrics Collection**
   ```bash
   bash scripts/test-monitoring.sh
   ```

3. **Verify Prometheus Targets**
   - Open: http://localhost:9090/targets
   - All should be GREEN (UP)

4. **Check Dashboard Data**
   - Open Grafana: http://localhost:3015
   - Navigate to: Infrastructure Monitoring dashboard
   - All panels should show data

## 📋 Maintenance Tasks

### Daily
- Monitor alert notifications
- Check for high error rates

### Weekly
- Review dashboard trends
- Check storage usage

### Monthly
- Backup dashboards
- Update images
- Review retention policy

### Quarterly
- Archive old metrics data
- Optimize alert rules
- Performance tuning

## 🎓 Learning Resources

- Prometheus: https://prometheus.io/docs/
- Grafana: https://grafana.com/docs/grafana/
- Node Exporter: https://github.com/prometheus/node_exporter
- Redis Exporter: https://github.com/oliver006/redis_exporter
- PostgreSQL Exporter: https://github.com/prometheuscommunity/postgres_exporter

## 📞 Support & Troubleshooting

### Common Issues

**Prometheus targets showing DOWN**
- Wait 30-60 seconds for initial scrape
- Check container logs: `docker logs kirimkarya-<service>-exporter`
- Verify network connectivity: `docker network ls`

**Grafana "No data"**
- Test datasource: Configuration > Data Sources > Test
- Check PromQL query: http://localhost:9090/graph
- Ensure metrics are being scraped

**High memory usage**
- Reduce scrape interval
- Reduce retention time
- Check cardinality of metrics

### Contact Info
- Check logs: `make monitoring-logs <service>`
- Read docs: `make monitoring-docs`
- View this guide: `cat MONITORING.md`

## 🎉 Next Steps

1. ✅ Start monitoring: `make monitoring-start`
2. ✅ Verify setup: `bash scripts/test-monitoring.sh`
3. ✅ Open Grafana dashboard
4. ✅ Change admin password
5. ✅ Setup alert notifications
6. ✅ Create team dashboards
7. ✅ Implement SLA tracking
8. ✅ Regular backups and maintenance

---

**Setup Complete!** You now have enterprise-grade monitoring for:
- System resources (CPU, RAM, Disk)
- Cache layer (Redis)
- Database (PostgreSQL)
- Object storage (MinIO)
- Job processing (BullMQ)
- API performance

Happy monitoring! 📊

