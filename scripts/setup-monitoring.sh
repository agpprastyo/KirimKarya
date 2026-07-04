#!/bin/bash

# Setup script untuk Infrastructure Monitoring Dashboard KirimKarya
# Usage: ./scripts/setup-monitoring.sh [start|stop|restart|status]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MONITORING_SERVICES=(
  "node-exporter"
  "redis-exporter"
  "postgres-exporter"
  "prometheus"
  "loki"
  "tempo"
  "otel-collector"
  "grafana"
)

print_status() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo -e "${GREEN}  $1${NC}"
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo ""
}

check_docker() {
  if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
  fi
  print_status "Docker is installed"
}

check_docker_compose() {
  if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
  fi
  print_status "Docker Compose is installed"
}

start_monitoring() {
  print_header "Starting Monitoring Infrastructure"

  check_docker
  check_docker_compose

  print_status "Starting base services (PostgreSQL, Redis, MinIO)"
  docker compose up -d postgres redis minio

  print_status "Starting observability stack (Prometheus, Grafana, Tempo, Loki)"
  docker compose -f docker-compose.obsv.yml up -d

  print_status "Starting exporters (Node, Redis, PostgreSQL)"
  docker compose -f docker-compose.exporters.yml up -d

  sleep 5

  print_status "Waiting for Prometheus to scrape metrics..."
  sleep 10

  print_header "Monitoring Infrastructure Started"
  echo "Services:"
  echo "  Grafana:        http://localhost:3015 (admin/admin)"
  echo "  Prometheus:     http://localhost:9090"
  echo "  Tempo (Traces): http://localhost:3200"
  echo "  Loki (Logs):    http://localhost:3100"
  echo ""
  echo "Exporters:"
  echo "  Node Exporter:       http://localhost:9100/metrics"
  echo "  Redis Exporter:      http://localhost:9121/metrics"
  echo "  PostgreSQL Exporter: http://localhost:9187/metrics"
  echo ""
  echo "Next steps:"
  echo "  1. Open Grafana: http://localhost:3015"
  echo "  2. Check Prometheus targets: http://localhost:9090/targets"
  echo "  3. View Infrastructure Monitoring dashboard"
  echo ""
  print_warning "Remember to change Grafana admin password in production!"
}

stop_monitoring() {
  print_header "Stopping Monitoring Infrastructure"

  docker compose -f docker-compose.yml \
                 -f docker-compose.obsv.yml \
                 -f docker-compose.exporters.yml \
                 down

  print_status "Monitoring infrastructure stopped"
}

restart_monitoring() {
  stop_monitoring
  sleep 2
  start_monitoring
}

check_status() {
  print_header "Checking Monitoring Infrastructure Status"

  for service in "${MONITORING_SERVICES[@]}"; do
    if docker ps --filter "name=$service" --filter "status=running" | grep -q $service; then
      print_status "$service is running"
    else
      print_error "$service is NOT running"
    fi
  done

  echo ""
  echo "Checking service health:"

  # Check Prometheus
  if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
    print_status "Prometheus is healthy"
  else
    print_error "Prometheus is not responding"
  fi

  # Check Grafana
  if curl -s http://localhost:3015/api/health > /dev/null 2>&1; then
    print_status "Grafana is healthy"
  else
    print_error "Grafana is not responding"
  fi

  # Check Node Exporter
  if curl -s http://localhost:9100/metrics > /dev/null 2>&1; then
    print_status "Node Exporter is healthy"
  else
    print_error "Node Exporter is not responding"
  fi

  # Check Redis Exporter
  if curl -s http://localhost:9121/metrics > /dev/null 2>&1; then
    print_status "Redis Exporter is healthy"
  else
    print_error "Redis Exporter is not responding"
  fi

  # Check PostgreSQL Exporter
  if curl -s http://localhost:9187/metrics > /dev/null 2>&1; then
    print_status "PostgreSQL Exporter is healthy"
  else
    print_error "PostgreSQL Exporter is not responding"
  fi
}

show_logs() {
  service=$1
  if [ -z "$service" ]; then
    print_error "Usage: $0 logs <service>"
    echo "Available services: ${MONITORING_SERVICES[@]}"
    exit 1
  fi

  docker compose -f docker-compose.yml \
                 -f docker-compose.obsv.yml \
                 -f docker-compose.exporters.yml \
                 logs -f "$service"
}

show_usage() {
  echo "Usage: $0 {start|stop|restart|status|logs <service>}"
  echo ""
  echo "Commands:"
  echo "  start              Start monitoring infrastructure"
  echo "  stop               Stop monitoring infrastructure"
  echo "  restart            Restart monitoring infrastructure"
  echo "  status             Check status of all services"
  echo "  logs <service>     View logs for a specific service"
  echo "  backup             Backup Grafana dashboards"
  echo ""
  echo "Examples:"
  echo "  $0 start"
  echo "  $0 logs prometheus"
  echo "  $0 status"
}

backup_dashboards() {
  print_header "Backing up Grafana Dashboards"

  if ! command -v jq &> /dev/null; then
    print_error "jq is required for backup. Install with: sudo apt-get install jq"
    exit 1
  fi

  BACKUP_DIR="$PROJECT_ROOT/backups/grafana-dashboards-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR"

  # Get all dashboards
  DASHBOARDS=$(curl -s -H "Authorization: Bearer admin" \
    http://localhost:3015/api/search?query=&starred=false | jq -r '.[] | .id')

  if [ -z "$DASHBOARDS" ]; then
    print_warning "No dashboards found"
    return
  fi

  for id in $DASHBOARDS; do
    DASHBOARD=$(curl -s -H "Authorization: Bearer admin" \
      http://localhost:3015/api/dashboards/uid/$id | jq '.dashboard')

    echo "$DASHBOARD" > "$BACKUP_DIR/${id}.json"
    print_status "Backed up dashboard: $id"
  done

  print_status "Dashboards backed up to: $BACKUP_DIR"
}

main() {
  case "${1:-}" in
    start)
      start_monitoring
      ;;
    stop)
      stop_monitoring
      ;;
    restart)
      restart_monitoring
      ;;
    status)
      check_status
      ;;
    logs)
      show_logs "$2"
      ;;
    backup)
      backup_dashboards
      ;;
    *)
      show_usage
      exit 0
      ;;
  esac
}

main "$@"

