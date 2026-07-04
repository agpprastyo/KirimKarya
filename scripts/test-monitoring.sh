#!/bin/bash

# Test script untuk monitoring setup
# Verify bahwa semua components berfungsi dengan baik

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC} $1"
  echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
  echo ""
}

print_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

print_fail() {
  echo -e "${RED}✗${NC} $1"
}

print_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

test_endpoint() {
  local url=$1
  local name=$2
  local expected_code=${3:-200}

  if response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
    if [ "$response_code" = "$expected_code" ] || [ "$response_code" = "200" ] || [ "$response_code" = "000" ]; then
      if [ "$response_code" = "000" ]; then
        print_fail "$name - Connection refused"
        return 1
      else
        print_pass "$name (HTTP $response_code)"
        return 0
      fi
    else
      print_fail "$name (HTTP $response_code, expected $expected_code)"
      return 1
    fi
  else
    print_fail "$name - Connection error"
    return 1
  fi
}

test_metrics() {
  local url=$1
  local name=$2

  if curl -s "$url" 2>/dev/null | grep -q "# HELP\|# TYPE\|^[a-z_]*{"; then
    print_pass "$name has metrics"
    return 0
  else
    print_fail "$name - No metrics found"
    return 1
  fi
}

test_prometheus_target() {
  local job=$1
  local expected_state=${2:-up}

  local state=$(curl -s http://localhost:9090/api/v1/targets 2>/dev/null | grep -o "\"job\":\"$job\"" | head -1)

  if [ -n "$state" ]; then
    print_pass "Prometheus has target: $job"
    return 0
  else
    print_warn "Prometheus target not found: $job (may need time to scrape)"
    return 1
  fi
}

main() {
  print_header "Monitoring Setup Tests"

  echo "Testing monitoring infrastructure connectivity..."
  echo ""

  local failed=0
  local passed=0

  # Test Prometheus
  print_header "Prometheus"
  if test_endpoint "http://localhost:9090/-/healthy" "Prometheus Health"; then
    ((passed++))
  else
    ((failed++))
  fi

  # Test Grafana
  print_header "Grafana"
  if test_endpoint "http://localhost:3015/api/health" "Grafana Health"; then
    ((passed++))
  else
    ((failed++))
  fi

  # Test Tempo
  print_header "Tempo (Traces)"
  if test_endpoint "http://localhost:3200/api/status" "Tempo Health"; then
    ((passed++))
  else
    print_warn "Tempo may not have /api/status endpoint, checking alternative..."
    if test_endpoint "http://localhost:3200/" "Tempo Readiness"; then
      ((passed++))
    else
      ((failed++))
    fi
  fi

  # Test Loki
  print_header "Loki (Logs)"
  if test_endpoint "http://localhost:3100/ready" "Loki Readiness"; then
    ((passed++))
  else
    ((failed++))
  fi

  # Test Exporters
  print_header "Exporters"

  if test_metrics "http://localhost:9100/metrics" "Node Exporter"; then
    ((passed++))
  else
    ((failed++))
  fi

  if test_metrics "http://localhost:9121/metrics" "Redis Exporter"; then
    ((passed++))
  else
    ((failed++))
  fi

  if test_metrics "http://localhost:9187/metrics" "PostgreSQL Exporter"; then
    ((passed++))
  else
    ((failed++))
  fi

  # Test Prometheus Targets
  print_header "Prometheus Targets"

  # List available targets
  echo "Fetching Prometheus targets..."
  if curl -s http://localhost:9090/api/v1/targets 2>/dev/null | grep -q "job_name"; then
    targets=$(curl -s http://localhost:9090/api/v1/targets 2>/dev/null | grep -o '"job":"[^"]*"' | cut -d'"' -f4 | sort -u)

    echo "Found targets:"
    for target in $targets; do
      echo "  - $target"
    done
    ((passed++))
  else
    print_warn "Could not fetch Prometheus targets"
    ((failed++))
  fi

  # Test Sample Metrics
  print_header "Sample Metrics (PromQL)"

  # Test node metrics
  if curl -s 'http://localhost:9090/api/v1/query?query=node_memory_MemTotal_bytes' 2>/dev/null | grep -q '"value"'; then
    print_pass "node_memory_MemTotal_bytes query works"
    ((passed++))
  else
    print_warn "node_memory_MemTotal_bytes - No data yet (may need time)"
    ((failed++))
  fi

  # Test redis metrics
  if curl -s 'http://localhost:9090/api/v1/query?query=redis_info_server_uptime_in_seconds' 2>/dev/null | grep -q '"value"'; then
    print_pass "redis_info_server_uptime_in_seconds query works"
    ((passed++))
  else
    print_warn "redis_info_server_uptime_in_seconds - No data yet (may need time)"
  fi

  # Test postgres metrics
  if curl -s 'http://localhost:9090/api/v1/query?query=pg_up' 2>/dev/null | grep -q '"value"'; then
    print_pass "pg_up query works"
    ((passed++))
  else
    print_warn "pg_up - No data yet (may need time)"
  fi

  # Summary
  print_header "Test Summary"
  echo -e "${GREEN}Passed: $passed${NC}"
  echo -e "${RED}Failed: $failed${NC}"
  echo ""

  if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Open Grafana: http://localhost:3015 (admin/admin)"
    echo "  2. Check Prometheus targets: http://localhost:9090/targets"
    echo "  3. View Infrastructure Monitoring dashboard"
    echo ""
    return 0
  else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Troubleshooting tips:"
    echo "  1. Wait 30-60 seconds for exporters to register with Prometheus"
    echo "  2. Check service logs: docker compose logs <service>"
    echo "  3. Verify network connectivity: docker network ls"
    echo "  4. Check environment variables in docker-compose files"
    echo ""
    return 1
  fi
}

main "$@"

