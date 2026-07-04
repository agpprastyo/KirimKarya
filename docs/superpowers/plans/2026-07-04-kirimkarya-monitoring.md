# KirimKarya Monitoring & Alerting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three production-ready Grafana dashboard JSON files and one Prometheus alerting rules YAML file for the KirimKarya platform.

**Architecture:** Approach A — each dashboard is a standalone JSON file importable via Grafana UI (or auto-provisioned). The alerting rules extend the existing `config/alert-rules.yaml` with four KirimKarya-specific alert groups. The Grafana provisioning pipeline (`config/grafana-dashboards.yaml`) already points to `config/dashboards/`, so all three JSON files placed there will be picked up automatically.

**Tech Stack:** Grafana v10+ JSON schema, PromQL (Prometheus), LogQL (Loki)

## Global Constraints

- Grafana datasource name for metrics: `Prometheus` (must match exactly — see `config/grafana-datasources.yaml`)
- Grafana datasource name for logs: `Loki` (must match exactly — see `config/grafana-datasources.yaml`)
- Dashboard JSON files go to: `config/dashboards/` (provisioned at `/etc/grafana/provisioning/dashboards/files`)
- Alerting rules file: `config/alert-rules.yaml` — append new groups to the existing file; do NOT delete existing rules
- Prometheus `rule_files` path already set to `/etc/prometheus/alert-rules.yaml` (see `config/prometheus-config.yaml`)
- All JSON must be valid: run `python3 -m json.tool <file>` after writing each file
- Dashboard canvas width: 24 units. Two panels per row → each panel `w: 12`. Full-width panel → `w: 24`.
- Stat panel height (`h`): 8. Time-series/logs panel height: 10.
- All dashboard `uid` values must be unique short strings (8 chars, lowercase alphanumeric).
- Error Rate threshold steps: green=null, yellow=0.001, red=5 (for %).
- Failed Jobs threshold steps: green=null, yellow=0.001, red=1 (any failure = red).
- Latency threshold steps: green=null, yellow=500, red=1000 (in ms).
- RPS panel: no thresholds, use blue/fixed color `#1F60C4`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `config/dashboards/kirimkarya-overview-dashboard.json` | KirimKarya Overview dashboard |
| Create | `config/dashboards/infrastructure-dashboard.json` | Infrastructure & Persistence dashboard |
| Create | `config/dashboards/worker-app-dashboard.json` | Application & Worker dashboard |
| Modify | `config/alert-rules.yaml` | Append 3 new rule groups (kirimkarya-api, kirimkarya-worker, kirimkarya-storage) |

---

## Task 1: KirimKarya Overview Dashboard

**Files:**
- Create: `config/dashboards/kirimkarya-overview-dashboard.json`

**Interfaces:**
- Produces: A Grafana-importable JSON dashboard with UID `kkoverview`, 4 panels in 2 rows, ready for Grafana v10+.
- Consumes: Prometheus datasource named `Prometheus`.

- [ ] **Step 1: Write the dashboard JSON file**

  Create `config/dashboards/kirimkarya-overview-dashboard.json` with the following exact content:

  ```json
  {
    "__inputs": [],
    "__requires": [
      { "type": "grafana", "id": "grafana", "name": "Grafana", "version": "10.0.0" },
      { "type": "datasource", "id": "prometheus", "name": "Prometheus", "version": "1.0.0" }
    ],
    "annotations": { "list": [] },
    "description": "High-level traffic-light overview for KirimKarya API and background jobs.",
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 1,
    "id": null,
    "links": [],
    "panels": [
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "fixedColor": "#1F60C4", "mode": "fixed" },
            "mappings": [],
            "thresholds": { "mode": "absolute", "steps": [] },
            "unit": "reqps"
          },
          "overrides": []
        },
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "id": 1,
        "options": {
          "colorMode": "background",
          "graphMode": "area",
          "justifyMode": "center",
          "orientation": "auto",
          "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
          "textMode": "auto"
        },
        "pluginVersion": "10.0.0",
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "sum(rate(http_server_duration_milliseconds_count[5m]))",
            "legendFormat": "RPS",
            "refId": "A"
          }
        ],
        "title": "API Gateway RPS",
        "type": "stat"
      },
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "mode": "palette-classic" },
            "custom": {
              "axisCenteredZero": false,
              "axisColorMode": "text",
              "axisLabel": "",
              "axisPlacement": "auto",
              "barAlignment": 0,
              "drawStyle": "line",
              "fillOpacity": 10,
              "gradientMode": "none",
              "hideFrom": { "legend": false, "tooltip": false, "viz": false },
              "lineInterpolation": "linear",
              "lineWidth": 2,
              "pointSize": 5,
              "scaleDistribution": { "type": "linear" },
              "showPoints": "never",
              "spanNulls": false,
              "stacking": { "group": "A", "mode": "none" },
              "thresholdsStyle": { "mode": "off" }
            },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 500 },
                { "color": "red", "value": 1000 }
              ]
            },
            "unit": "ms"
          },
          "overrides": []
        },
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "id": 2,
        "options": {
          "legend": { "calcs": [], "displayMode": "list", "placement": "bottom", "showLegend": true },
          "tooltip": { "mode": "single", "sort": "none" }
        },
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "histogram_quantile(0.95, sum(rate(http_server_duration_milliseconds_bucket[5m])) by (le))",
            "legendFormat": "P95 Latency",
            "refId": "A"
          }
        ],
        "title": "API P95 Latency",
        "type": "timeseries"
      },
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "mode": "thresholds" },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 0.001 },
                { "color": "red", "value": 5 }
              ]
            },
            "unit": "percent"
          },
          "overrides": []
        },
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
        "id": 3,
        "options": {
          "colorMode": "background",
          "graphMode": "area",
          "justifyMode": "center",
          "orientation": "auto",
          "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
          "textMode": "auto"
        },
        "pluginVersion": "10.0.0",
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "(sum(rate(http_server_duration_milliseconds_count{status=~\"5..\"}[5m])) / sum(rate(http_server_duration_milliseconds_count[5m]))) * 100",
            "legendFormat": "Error Rate %",
            "refId": "A"
          }
        ],
        "title": "API Error Rate 5xx %",
        "type": "stat"
      },
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "mode": "thresholds" },
            "mappings": [
              { "options": { "0": { "color": "green", "index": 0, "text": "0 failures" } }, "type": "value" }
            ],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 0.001 },
                { "color": "red", "value": 1 }
              ]
            },
            "unit": "short"
          },
          "overrides": []
        },
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
        "id": 4,
        "options": {
          "colorMode": "background",
          "graphMode": "none",
          "justifyMode": "center",
          "orientation": "auto",
          "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
          "textMode": "auto"
        },
        "pluginVersion": "10.0.0",
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "sum(increase(bullmq_failed_jobs_total[1h])) or vector(0)",
            "legendFormat": "Failed Jobs",
            "refId": "A"
          }
        ],
        "title": "Total Failed Jobs (1h)",
        "type": "stat"
      }
    ],
    "refresh": "30s",
    "schemaVersion": 38,
    "tags": ["kirimkarya", "overview", "api"],
    "time": { "from": "now-1h", "to": "now" },
    "timepicker": {},
    "timezone": "browser",
    "title": "KirimKarya Overview",
    "uid": "kkoverview",
    "version": 1
  }
  ```

- [ ] **Step 2: Validate the JSON**

  ```bash
  python3 -m json.tool config/dashboards/kirimkarya-overview-dashboard.json > /dev/null && echo "JSON valid" || echo "JSON INVALID"
  ```

  Expected output: `JSON valid`

- [ ] **Step 3: Commit**

  ```bash
  git add config/dashboards/kirimkarya-overview-dashboard.json
  git commit -m "feat(monitoring): add KirimKarya Overview Grafana dashboard"
  ```

---

## Task 2: Infrastructure & Persistence Dashboard

**Files:**
- Create: `config/dashboards/infrastructure-dashboard.json`

**Interfaces:**
- Produces: A Grafana-importable JSON dashboard with UID `kkinfra`, 4 panels in 2 rows.
- Consumes: Prometheus datasource named `Prometheus`.

- [ ] **Step 1: Write the dashboard JSON file**

  Create `config/dashboards/infrastructure-dashboard.json` with the following exact content:

  ```json
  {
    "__inputs": [],
    "__requires": [
      { "type": "grafana", "id": "grafana", "name": "Grafana", "version": "10.0.0" },
      { "type": "datasource", "id": "prometheus", "name": "Prometheus", "version": "1.0.0" }
    ],
    "annotations": { "list": [] },
    "description": "Server resources, database, and storage monitoring for KirimKarya.",
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 1,
    "id": null,
    "links": [],
    "panels": [
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "mode": "palette-classic" },
            "custom": {
              "axisCenteredZero": false,
              "axisColorMode": "text",
              "axisLabel": "",
              "axisPlacement": "auto",
              "barAlignment": 0,
              "drawStyle": "line",
              "fillOpacity": 10,
              "gradientMode": "none",
              "hideFrom": { "legend": false, "tooltip": false, "viz": false },
              "lineInterpolation": "linear",
              "lineWidth": 2,
              "pointSize": 5,
              "scaleDistribution": { "type": "linear" },
              "showPoints": "never",
              "spanNulls": false,
              "stacking": { "group": "A", "mode": "none" },
              "thresholdsStyle": { "mode": "off" }
            },
            "mappings": [],
            "max": 100,
            "min": 0,
            "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }] },
            "unit": "percent"
          },
          "overrides": []
        },
        "gridPos": { "h": 10, "w": 12, "x": 0, "y": 0 },
        "id": 1,
        "options": {
          "legend": { "calcs": ["mean", "max"], "displayMode": "list", "placement": "bottom", "showLegend": true },
          "tooltip": { "mode": "single", "sort": "none" }
        },
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "CPU {{ instance }}",
            "refId": "A"
          }
        ],
        "title": "CPU Usage %",
        "type": "timeseries"
      },
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "mode": "palette-classic" },
            "custom": {
              "axisCenteredZero": false,
              "axisColorMode": "text",
              "axisLabel": "",
              "axisPlacement": "auto",
              "barAlignment": 0,
              "drawStyle": "line",
              "fillOpacity": 10,
              "gradientMode": "none",
              "hideFrom": { "legend": false, "tooltip": false, "viz": false },
              "lineInterpolation": "linear",
              "lineWidth": 2,
              "pointSize": 5,
              "scaleDistribution": { "type": "linear" },
              "showPoints": "never",
              "spanNulls": false,
              "stacking": { "group": "A", "mode": "none" },
              "thresholdsStyle": { "mode": "off" }
            },
            "mappings": [],
            "max": 100,
            "min": 0,
            "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }] },
            "unit": "percent"
          },
          "overrides": []
        },
        "gridPos": { "h": 10, "w": 12, "x": 12, "y": 0 },
        "id": 2,
        "options": {
          "legend": { "calcs": ["mean", "max"], "displayMode": "list", "placement": "bottom", "showLegend": true },
          "tooltip": { "mode": "single", "sort": "none" }
        },
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "legendFormat": "RAM {{ instance }}",
            "refId": "A"
          }
        ],
        "title": "RAM Usage %",
        "type": "timeseries"
      },
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "mode": "thresholds" },
            "mappings": [],
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 80 },
                { "color": "red", "value": 100 }
              ]
            },
            "unit": "short"
          },
          "overrides": []
        },
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 10 },
        "id": 3,
        "options": {
          "colorMode": "background",
          "graphMode": "area",
          "justifyMode": "center",
          "orientation": "auto",
          "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
          "textMode": "auto"
        },
        "pluginVersion": "10.0.0",
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "pg_stat_activity_count or vector(0)",
            "legendFormat": "Active Connections",
            "refId": "A"
          }
        ],
        "title": "PostgreSQL Active Connections",
        "type": "stat"
      },
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "mode": "thresholds" },
            "mappings": [],
            "max": 1,
            "min": 0,
            "thresholds": {
              "mode": "percentage",
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 70 },
                { "color": "red", "value": 85 }
              ]
            },
            "unit": "bytes"
          },
          "overrides": []
        },
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 10 },
        "id": 4,
        "options": {
          "minVizHeight": 75,
          "minVizWidth": 75,
          "orientation": "auto",
          "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
          "showThresholdLabels": false,
          "showThresholdMarkers": true,
          "sizing": "auto"
        },
        "pluginVersion": "10.0.0",
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "minio_cluster_capacity_usable_total_bytes - minio_cluster_capacity_usable_free_bytes or vector(0)",
            "legendFormat": "Used Storage",
            "refId": "A"
          }
        ],
        "title": "MinIO Used Storage",
        "type": "gauge"
      }
    ],
    "refresh": "30s",
    "schemaVersion": 38,
    "tags": ["kirimkarya", "infrastructure", "database", "storage"],
    "time": { "from": "now-1h", "to": "now" },
    "timepicker": {},
    "timezone": "browser",
    "title": "Infrastructure & Persistence",
    "uid": "kkinfra",
    "version": 1
  }
  ```

- [ ] **Step 2: Validate the JSON**

  ```bash
  python3 -m json.tool config/dashboards/infrastructure-dashboard.json > /dev/null && echo "JSON valid" || echo "JSON INVALID"
  ```

  Expected output: `JSON valid`

- [ ] **Step 3: Commit**

  ```bash
  git add config/dashboards/infrastructure-dashboard.json
  git commit -m "feat(monitoring): add Infrastructure & Persistence Grafana dashboard"
  ```

---

## Task 3: Application & Worker Dashboard

**Files:**
- Create: `config/dashboards/worker-app-dashboard.json`

**Interfaces:**
- Produces: A Grafana-importable JSON dashboard with UID `kkworker`, 3 panels in 2 rows. The Logs panel uses Loki.
- Consumes: Prometheus datasource named `Prometheus`; Loki datasource named `Loki`.

- [ ] **Step 1: Write the dashboard JSON file**

  Create `config/dashboards/worker-app-dashboard.json` with the following exact content:

  ```json
  {
    "__inputs": [],
    "__requires": [
      { "type": "grafana", "id": "grafana", "name": "Grafana", "version": "10.0.0" },
      { "type": "datasource", "id": "prometheus", "name": "Prometheus", "version": "1.0.0" },
      { "type": "datasource", "id": "loki", "name": "Loki", "version": "1.0.0" }
    ],
    "annotations": { "list": [] },
    "description": "BullMQ worker queue health and live error logs for KirimKarya.",
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 1,
    "id": null,
    "links": [],
    "panels": [
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "mode": "palette-classic" },
            "custom": {
              "axisCenteredZero": false,
              "axisColorMode": "text",
              "axisLabel": "",
              "axisPlacement": "auto",
              "barAlignment": 0,
              "drawStyle": "line",
              "fillOpacity": 20,
              "gradientMode": "none",
              "hideFrom": { "legend": false, "tooltip": false, "viz": false },
              "lineInterpolation": "linear",
              "lineWidth": 2,
              "pointSize": 5,
              "scaleDistribution": { "type": "linear" },
              "showPoints": "never",
              "spanNulls": false,
              "stacking": { "group": "A", "mode": "normal" },
              "thresholdsStyle": { "mode": "off" }
            },
            "mappings": [],
            "min": 0,
            "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }] },
            "unit": "short"
          },
          "overrides": []
        },
        "gridPos": { "h": 10, "w": 12, "x": 0, "y": 0 },
        "id": 1,
        "options": {
          "legend": { "calcs": ["max"], "displayMode": "list", "placement": "bottom", "showLegend": true },
          "tooltip": { "mode": "multi", "sort": "none" }
        },
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "sum(bullmq_waiting_jobs) by (queue) or vector(0)",
            "legendFormat": "{{ queue }}",
            "refId": "A"
          }
        ],
        "title": "Jobs Waiting by Queue",
        "type": "timeseries"
      },
      {
        "datasource": { "type": "prometheus", "uid": "prometheus" },
        "fieldConfig": {
          "defaults": {
            "color": { "mode": "thresholds" },
            "mappings": [],
            "min": 0,
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "color": "green", "value": null },
                { "color": "blue", "value": 1 }
              ]
            },
            "unit": "short"
          },
          "overrides": []
        },
        "gridPos": { "h": 10, "w": 12, "x": 12, "y": 0 },
        "id": 2,
        "options": {
          "colorMode": "background",
          "graphMode": "none",
          "justifyMode": "center",
          "orientation": "auto",
          "reduceOptions": { "calcs": ["lastNotNull"], "fields": "", "values": false },
          "textMode": "auto"
        },
        "pluginVersion": "10.0.0",
        "targets": [
          {
            "datasource": { "type": "prometheus", "uid": "prometheus" },
            "expr": "sum(bullmq_active_jobs) by (queue) or vector(0)",
            "legendFormat": "{{ queue }}",
            "refId": "A"
          }
        ],
        "title": "Active Jobs",
        "type": "stat"
      },
      {
        "datasource": { "type": "loki", "uid": "loki" },
        "fieldConfig": { "defaults": {}, "overrides": [] },
        "gridPos": { "h": 10, "w": 24, "x": 0, "y": 10 },
        "id": 3,
        "options": {
          "dedupStrategy": "none",
          "enableLogDetails": true,
          "prettifyLogMessage": false,
          "showCommonLabels": false,
          "showLabels": false,
          "showTime": true,
          "sortOrder": "Descending",
          "wrapLogMessage": false
        },
        "targets": [
          {
            "datasource": { "type": "loki", "uid": "loki" },
            "expr": "{service_name=~\"api|worker\"} | json | level=~\"error|warn\"",
            "legendFormat": "",
            "refId": "A"
          }
        ],
        "title": "Live Error Logs (API & Worker)",
        "type": "logs"
      }
    ],
    "refresh": "10s",
    "schemaVersion": 38,
    "tags": ["kirimkarya", "worker", "bullmq", "logs"],
    "time": { "from": "now-1h", "to": "now" },
    "timepicker": {},
    "timezone": "browser",
    "title": "Application & Worker",
    "uid": "kkworker",
    "version": 1
  }
  ```

- [ ] **Step 2: Validate the JSON**

  ```bash
  python3 -m json.tool config/dashboards/worker-app-dashboard.json > /dev/null && echo "JSON valid" || echo "JSON INVALID"
  ```

  Expected output: `JSON valid`

- [ ] **Step 3: Commit**

  ```bash
  git add config/dashboards/worker-app-dashboard.json
  git commit -m "feat(monitoring): add Application & Worker Grafana dashboard"
  ```

---

## Task 4: Append KirimKarya Alerting Rules to `config/alert-rules.yaml`

**Files:**
- Modify: `config/alert-rules.yaml` (append three new groups — do NOT remove or alter existing groups)

**Interfaces:**
- Consumes: Existing `config/alert-rules.yaml` with `groups` array already containing `infrastructure_alerts`.
- Produces: The same file with three additional groups appended: `kirimkarya-api`, `kirimkarya-worker`, `kirimkarya-storage`.

- [ ] **Step 1: Append the three new rule groups**

  Open `config/alert-rules.yaml` and append the following YAML **at the end of the file**, after the last existing rule. The `groups` key already exists — you are appending new items to the `groups` list, so add two leading spaces to each item to align with the existing list items:

  ```yaml

    - name: kirimkarya-api
      rules:
        - alert: API_HighErrorRate
          expr: >
            (sum(rate(http_server_duration_milliseconds_count{status=~"5.."}[5m])) /
            sum(rate(http_server_duration_milliseconds_count[5m]))) * 100 > 5
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "API Error Rate > 5%"
            description: "Lebih dari 5% request ke layanan API gagal dalam 5 menit terakhir."

        - alert: API_HighLatency
          expr: >
            histogram_quantile(0.95, sum(rate(http_server_duration_milliseconds_bucket[5m])) by (le)) > 1000
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "P95 Latency > 1s"
            description: "Respons API melambat, 5% pengguna mengalami waktu muat di atas 1 detik."

    - name: kirimkarya-worker
      rules:
        - alert: Worker_QueueStagnation
          expr: sum(bullmq_waiting_jobs) > 50
          for: 10m
          labels:
            severity: critical
          annotations:
            summary: "Worker Queue Macet"
            description: "Antrean pekerja menumpuk lebih dari 50 pekerjaan. Worker service mungkin terhenti."

    - name: kirimkarya-storage
      rules:
        - alert: MinIO_StorageWarning
          expr: >
            (minio_cluster_capacity_usable_total_bytes - minio_cluster_capacity_usable_free_bytes) /
            minio_cluster_capacity_usable_total_bytes * 100 > 85
          for: 15m
          labels:
            severity: warning
          annotations:
            summary: "MinIO Storage > 85%"
            description: "Kapasitas penyimpanan foto hampir penuh."
  ```

- [ ] **Step 2: Validate YAML syntax**

  ```bash
  python3 -c "import yaml, sys; yaml.safe_load(open('config/alert-rules.yaml'))" && echo "YAML valid" || echo "YAML INVALID"
  ```

  Expected output: `YAML valid`

- [ ] **Step 3: Verify existing rules are untouched**

  ```bash
  grep -c "alert:" config/alert-rules.yaml
  ```

  Expected output: `18` (14 existing rules + 4 new rules = 18 total)

- [ ] **Step 4: Commit**

  ```bash
  git add config/alert-rules.yaml
  git commit -m "feat(monitoring): add KirimKarya API, worker, and storage alert rules"
  ```

---

## Task 5: Smoke-test the Full Setup

**Files:**
- No files created/modified — this is a validation-only task.

**Interfaces:**
- Consumes: All four files from Tasks 1–4. Docker Compose observability stack (`docker-compose.obsv.yml`).

- [ ] **Step 1: Start the observability stack**

  ```bash
  docker compose -f docker-compose.obsv.yml up -d
  ```

  Expected: All services start without errors. Confirm with:

  ```bash
  docker compose -f docker-compose.obsv.yml ps
  ```

  Expected: `grafana`, `prometheus`, `loki` containers show `running` status.

- [ ] **Step 2: Verify Prometheus loads the new alert rules**

  ```bash
  curl -s http://localhost:9090/api/v1/rules | python3 -m json.tool | grep '"name"'
  ```

  Expected: Output includes `"name": "kirimkarya-api"`, `"name": "kirimkarya-worker"`, `"name": "kirimkarya-storage"`.

- [ ] **Step 3: Verify dashboards are provisioned in Grafana**

  ```bash
  curl -s -u admin:admin http://localhost:3000/api/search?query=KirimKarya | python3 -m json.tool | grep '"title"'
  ```

  Expected: Output includes `"KirimKarya Overview"`, `"Infrastructure & Persistence"`, `"Application & Worker"`.

  > Note: default Grafana credentials are `admin/admin`. If your setup uses different credentials, adjust accordingly.

- [ ] **Step 4: Final commit**

  ```bash
  git add .
  git commit -m "chore(monitoring): verify KirimKarya monitoring stack smoke test passes"
  ```
