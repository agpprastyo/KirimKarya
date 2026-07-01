# Grafana Dashboard Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure automated dashboard provisioning in Grafana for the KirimKarya monorepo. This provides a unified monitoring dashboard containing API metrics, queue statuses, and live log streams out of the box.

**Architecture:** Grafana dashboard provider mapping. The JSON layout handles 24-column grid layout grids. Prometheus variables fetch HTTP server latencies and BullMQ active states.

**Tech Stack:** Grafana Provisioning API, JSON, Docker Compose.

## Global Constraints
- Avoid hardcoding host IP addresses; use service names (`prometheus`, `loki`, `tempo`) for container network communication.
- Ensure all YAML configurations use correct spaces indentation.
- Mount files to host directories under `config/` inside `/home/agprastyo/Developments/KirimKarya`.

---

### Task 1: Create Grafana Dashboards Provider Configuration

**Files:**
- Create: `config/grafana-dashboards.yaml`
- Modify: `docker-compose.obsv.yml` (mount directories)

**Interfaces:**
- Produces: Grafana provisioning provider pointing to `/etc/grafana/provisioning/dashboards/files`

- [ ] **Step 1: Create grafana-dashboards.yaml**

  Create file `config/grafana-dashboards.yaml`:
  ```yaml
  apiVersion: 1

  providers:
    - name: KirimKarya
      orgId: 1
      folder: 'KirimKarya'
      type: file
      disableDeletion: false
      editable: true
      options:
        path: /etc/grafana/provisioning/dashboards/files
  ```

- [ ] **Step 2: Update Docker Compose volume mappings**

  Modify `docker-compose.obsv.yml` under `grafana` service. Mount the dashboards config and folder:
  ```yaml
      volumes:
        - ./config/grafana-datasources.yaml:/etc/grafana/provisioning/datasources/datasources.yaml
        - ./config/grafana-dashboards.yaml:/etc/grafana/provisioning/dashboards/dashboards.yaml
        - ./config/dashboards:/etc/grafana/provisioning/dashboards/files
  ```

- [ ] **Step 3: Create target directories**

  Run:
  ```bash
  mkdir -p config/dashboards
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add config/grafana-dashboards.yaml docker-compose.obsv.yml
  git commit -m "chore(observability): add Grafana dashboards provisioning provider configuration"
  ```

---

### Task 2: Create KirimKarya Central Dashboard JSON Schema

**Files:**
- Create: `config/dashboards/kirimkarya-dashboard.json`

**Interfaces:**
- Produces: Visualized panels for RPS, Error Rate, HTTP latency, Worker queue states, and Live log panels.

- [ ] **Step 1: Write KirimKarya Dashboard JSON**

  Create file `config/dashboards/kirimkarya-dashboard.json`:
  ```json
  {
    "annotations": {
      "list": []
    },
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 0,
    "id": null,
    "links": [],
    "liveNow": false,
    "panels": [
      {
        "title": "API Gateway: Requests Per Second",
        "type": "gauge",
        "gridPos": {
          "h": 8,
          "w": 8,
          "x": 0,
          "y": 0
        },
        "id": 1,
        "datasource": {
          "type": "prometheus",
          "uid": "Prometheus"
        },
        "targets": [
          {
            "datasource": {
              "type": "prometheus",
              "uid": "Prometheus"
            },
            "editorMode": "code",
            "expr": "sum(rate(http_server_duration_milliseconds_count[2m]))",
            "legendFormat": "RPS",
            "range": true,
            "refId": "A"
          }
        ]
      },
      {
        "title": "API Gateway: Error Rate",
        "type": "stat",
        "gridPos": {
          "h": 8,
          "w": 8,
          "x": 8,
          "y": 0
        },
        "id": 2,
        "datasource": {
          "type": "prometheus",
          "uid": "Prometheus"
        },
        "targets": [
          {
            "datasource": {
              "type": "prometheus",
              "uid": "Prometheus"
            },
            "editorMode": "code",
            "expr": "(sum(rate(http_server_duration_milliseconds_count{status=~\"5..\"}[2m])) / sum(rate(http_server_duration_milliseconds_count[2m]))) * 100",
            "legendFormat": "Error Rate",
            "range": true,
            "refId": "A"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "value": null, "color": "green" },
                { "value": 1.0, "color": "orange" },
                { "value": 2.0, "color": "red" }
              ]
            }
          }
        }
      },
      {
        "title": "API Gateway: HTTP Latency (p95)",
        "type": "timeseries",
        "gridPos": {
          "h": 8,
          "w": 8,
          "x": 16,
          "y": 0
        },
        "id": 3,
        "datasource": {
          "type": "prometheus",
          "uid": "Prometheus"
        },
        "targets": [
          {
            "datasource": {
              "type": "prometheus",
              "uid": "Prometheus"
            },
            "editorMode": "code",
            "expr": "histogram_quantile(0.95, sum(rate(http_server_duration_milliseconds_bucket[2m])) by (le))",
            "legendFormat": "p95 Latency",
            "range": true,
            "refId": "A"
          }
        ]
      },
      {
        "title": "Worker Queue: Active & Processing Jobs",
        "type": "timeseries",
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 8
        },
        "id": 4,
        "datasource": {
          "type": "prometheus",
          "uid": "Prometheus"
        },
        "targets": [
          {
            "datasource": {
              "type": "prometheus",
              "uid": "Prometheus"
            },
            "editorMode": "code",
            "expr": "sum(bullmq_active_jobs) or vector(0)",
            "legendFormat": "Active Jobs",
            "range": true,
            "refId": "A"
          }
        ]
      },
      {
        "title": "Worker Queue: Failed Jobs (24h)",
        "type": "stat",
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 8
        },
        "id": 5,
        "datasource": {
          "type": "prometheus",
          "uid": "Prometheus"
        },
        "targets": [
          {
            "datasource": {
              "type": "prometheus",
              "uid": "Prometheus"
            },
            "editorMode": "code",
            "expr": "sum(increase(bullmq_failed_jobs_total[24h])) or vector(0)",
            "legendFormat": "Failed Jobs",
            "range": true,
            "refId": "A"
          }
        ]
      },
      {
        "title": "Live System Log Streams",
        "type": "logs",
        "gridPos": {
          "h": 10,
          "w": 24,
          "x": 0,
          "y": 16
        },
        "id": 6,
        "datasource": {
          "type": "loki",
          "uid": "Loki"
        },
        "targets": [
          {
            "datasource": {
              "type": "loki",
              "uid": "Loki"
            },
            "expr": "{service_name=~\"api|worker\"} | json | level=~\"error|warn\"",
            "refId": "A"
          }
        ]
      }
    ],
    "schemaVersion": 38,
    "title": "KirimKarya Central Dashboard",
    "uid": "kirimkarya-central-dashboard",
    "version": 1
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add config/dashboards/kirimkarya-dashboard.json
  git commit -m "chore(observability): create KirimKarya central dashboard JSON layout"
  ```

---

### Task 3: Reload Grafana and Verify Dashboard Integration

**Files:**
- No file changes.

**Interfaces:**
- Produces: Loaded dashboard rendered inside Grafana UI port `3015`

- [ ] **Step 1: Restart Grafana service**

  Run:
  ```bash
  docker compose -f docker-compose.obsv.yml up -d --force-recreate grafana
  ```

- [ ] **Step 2: Verify Grafana initialization logs**

  Run:
  ```bash
  docker compose -f docker-compose.obsv.yml logs grafana | grep -i "provisioning" | tail -10
  ```
  Expected: Logs show "inserting datasource..." and "loading dashboard providers...".

- [ ] **Step 3: Verify on Browser**

  Open dashboard URL: `http://localhost:3015/dashboards`
  - Expected: Folder named `KirimKarya` is present.
  - Expected: Clicking it reveals **"KirimKarya Central Dashboard"**.
  - Expected: Opening the dashboard renders all 6 panels without GUI errors.
