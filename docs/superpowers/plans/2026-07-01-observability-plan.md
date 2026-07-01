# Observability Stack Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement centralized logging, metrics, and tracing using the LGTM Stack (Grafana, Loki, Tempo, Prometheus) and OpenTelemetry. Setup a shared `packages/observability` and integrate context propagation across Hono APIs and BullMQ Workers.

**Architecture:** Shared workspace package using OpenTelemetry JS SDK. Traces are exported via OTLP/gRPC. Active span contexts are injected into logger logs. Docker Compose handles self-hosted infrastructure under resource limits.

**Tech Stack:** Bun, TypeScript, OpenTelemetry API & SDK, Docker Compose, Grafana, Loki, Tempo, Prometheus.

## Global Constraints
- Never commit actual secrets or `.env` files.
- Ensure `bun x tsc --noEmit` and `bun test` pass at the end of every task.
- `docs/superpowers/` and `.superpowers/` are excluded from the public `origin` remote.

---

### Task 1: Initialize `packages/observability` Workspace Package

**Files:**
- Create: `packages/observability/package.json`
- Create: `packages/observability/tsconfig.json`
- Create: `packages/observability/src/index.ts`
- Create: `packages/observability/src/tracing-node.ts`
- Modify: `package.json` (root workspace definitions)

**Interfaces:**
- Produces: `initNodeTracing(serviceName: string, endpoint: string): void`
- Produces: `@kirimkarya/observability` package in monorepo

- [ ] **Step 1: Define packages/observability/package.json**

  Create file `packages/observability/package.json`:
  ```json
  {
    "name": "@kirimkarya/observability",
    "version": "1.0.0",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "dependencies": {
      "@opentelemetry/api": "^1.9.0",
      "@opentelemetry/sdk-node": "^0.52.0",
      "@opentelemetry/exporter-trace-otlp-grpc": "^0.52.0",
      "@opentelemetry/sdk-trace-base": "^1.25.0",
      "@opentelemetry/resources": "^1.25.0",
      "@opentelemetry/semantic-conventions": "^1.25.0",
      "@opentelemetry/instrumentation": "^0.52.0",
      "@opentelemetry/instrumentation-http": "^0.52.0"
    }
  }
  ```

- [ ] **Step 2: Define packages/observability/tsconfig.json**

  Create file `packages/observability/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "declaration": true
    },
    "include": ["src/**/*"]
  }
  ```

- [ ] **Step 3: Implement Node Tracing setup**

  Create file `packages/observability/src/tracing-node.ts`:
  ```typescript
  import { NodeSDK } from '@opentelemetry/sdk-node';
  import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
  import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
  import { Resource } from '@opentelemetry/resources';
  import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
  import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

  export function initNodeTracing(serviceName: string, collectorEndpoint: string) {
      const sdk = new NodeSDK({
          resource: new Resource({
              [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
          }),
          traceExporter: new OTLPTraceExporter({ url: collectorEndpoint }),
          spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter({ url: collectorEndpoint })),
          instrumentations: [
              new HttpInstrumentation(),
          ],
      });

      sdk.start();

      process.on('SIGTERM', () => {
          sdk.shutdown()
              .then(() => console.log('OTel SDK shut down successfully'))
              .catch((err) => console.error('Error shutting down OTel SDK', err));
      });
  }
  ```

- [ ] **Step 4: Create package exports**

  Create file `packages/observability/src/index.ts`:
  ```typescript
  export { initNodeTracing } from './tracing-node';
  export { trace, propagation, context, ROOT_CONTEXT } from '@opentelemetry/api';
  ```

- [ ] **Step 5: Register package and Install dependencies**

  Run:
  ```bash
  bun install
  ```

- [ ] **Step 6: Verify workspace type checking**

  Run:
  ```bash
  bun x tsc --noEmit
  ```
  Expected: Success, 0 errors.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/observability package.json bun.lock
  git commit -m "feat(observability): initialize shared observability workspace package"
  ```

---

### Task 2: Inject Trace Context into Core Logger

**Files:**
- Modify: `apps/api/src/core/logger.ts`
- Modify: `packages/observability/package.json` (ensure `@opentelemetry/api` is accessible)

**Interfaces:**
- Consumes: `@opentelemetry/api` tracing context API
- Produces: Log output lines containing `trace_id` and `span_id` when tracing is active

- [ ] **Step 1: Add Dependency to apps/api**

  Add `@kirimkarya/observability` workspace reference to `apps/api/package.json` dependencies:
  ```json
  "@kirimkarya/observability": "workspace:*"
  ```

- [ ] **Step 2: Update apps/api dependencies**

  Run:
  ```bash
  bun install
  ```

- [ ] **Step 3: Modify Core Logger logic**

  Edit `apps/api/src/core/logger.ts`. Add OTel check to inject trace contexts:
  ```typescript
  // Near the top imports:
  import { trace } from '@opentelemetry/api';

  // Inside your payload creation helper (where level, message, timestamp are set):
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      payload.trace_id = spanContext.traceId;
      payload.span_id = spanContext.spanId;
  }
  ```

- [ ] **Step 4: Verify test suite runs successfully**

  Run:
  ```bash
  cd apps/api && bun test src/core/logger.test.ts
  ```
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/package.json apps/api/src/core/logger.ts bun.lock
  git commit -m "refactor(logger): inject active trace_id and span_id into structured logs"
  ```

---

### Task 3: Setup Trace Propagation in BullMQ Queues

**Files:**
- Modify: `packages/queue/src/index.ts` (BullMQ wrapper)
- Modify: `apps/worker/src/index.ts` (Worker init)

**Interfaces:**
- Consumes: `@opentelemetry/api` propagation methods
- Produces: Trace headers inside job payloads propagating from API to Worker processes

- [ ] **Step 1: Update apps/worker dependencies**

  Add `@kirimkarya/observability` reference to `apps/worker/package.json` dependencies:
  ```json
  "@kirimkarya/observability": "workspace:*"
  ```
  Run:
  ```bash
  bun install
  ```

- [ ] **Step 2: Implement trace context injection in package/queue**

  Edit `packages/queue/src/index.ts` where jobs are dispatched to insert context propagation metadata:
  ```typescript
  import { propagation, context } from '@opentelemetry/api';

  // Inside the queue add/dispatch implementation:
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  
  // Stash carrier in job payload metadata:
  // e.g. payload: { ...data, _otel_carrier: carrier }
  ```

- [ ] **Step 3: Implement trace context extraction in apps/worker**

  Edit worker execution handler in `apps/worker/src/index.ts` or individual worker handlers to extract parent trace:
  ```typescript
  import { propagation, ROOT_CONTEXT, context } from '@opentelemetry/api';

  // Before executing job details:
  const parentContext = propagation.extract(ROOT_CONTEXT, job.data._otel_carrier);
  
  // Wrap worker task processing in context scope:
  await context.with(parentContext, async () => {
      // Execute original job processor code here
  });
  ```

- [ ] **Step 4: Verify workspace type checking**

  Run:
  ```bash
  bun x tsc --noEmit
  ```
  Expected: Success.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/queue apps/worker bun.lock
  git commit -m "feat(observability): implement tracing propagation across queue boundaries"
  ```

---

### Task 4: Configure Self-Hosted Observability Stack (Docker Compose)

**Files:**
- Create: `docker-compose.obsv.yml`
- Create: `config/otel-collector-config.yaml`
- Create: `config/prometheus-config.yaml`

**Interfaces:**
- Produces: Exporter endpoints at ports `4317` (gRPC OTel), `3000` (Grafana Dashboard)

- [ ] **Step 1: Create OTel Collector configuration**

  Create file `config/otel-collector-config.yaml`:
  ```yaml
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

  processors:
    batch:
      timeout: 1s
      send_batch_size: 256

  exporters:
    prometheus:
      endpoint: 0.0.0.0:8889
      namespace: "kirimkarya"
    otlp:
      endpoint: tempo:4317
      tls:
        insecure: true
    loki:
      endpoint: http://loki:3100/loki/api/v1/push

  service:
    pipelines:
      traces:
        receivers: [otlp]
        processors: [batch]
        exporters: [otlp]
      metrics:
        receivers: [otlp]
        processors: [batch]
        exporters: [prometheus]
  ```

- [ ] **Step 2: Create Prometheus configuration**

  Create file `config/prometheus-config.yaml`:
  ```yaml
  global:
    scrape_interval: 15s

  scrape_configs:
    - job_name: 'otel-collector'
      static_configs:
        - targets: ['otel-collector:8889']
  ```

- [ ] **Step 3: Create docker-compose.obsv.yml**

  Create file `docker-compose.obsv.yml`:
  ```yaml
  version: '3.8'

  services:
    otel-collector:
      image: otel/opentelemetry-collector-contrib:0.95.0
      volumes:
        - ./config/otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml
      command: ["--config=/etc/otelcol-contrib/config.yaml"]
      ports:
        - "4317:4317" # OTLP gRPC
        - "4318:4318" # OTLP HTTP
      deploy:
        resources:
          limits:
            memory: 128M

    loki:
      image: grafana/loki:2.9.4
      ports:
        - "3100:3100"
      command: -config.file=/etc/loki/local-config.yaml
      deploy:
        resources:
          limits:
            memory: 256M

    tempo:
      image: grafana/tempo:2.3.1
      command: [ "-config.file=/etc/tempo.yaml" ]
      volumes:
        - ./config/tempo.yaml:/etc/tempo.yaml
      ports:
        - "3200:3200"   # tempo web
        - "4317"        # OTLP gRPC mapped internally
      deploy:
        resources:
          limits:
            memory: 256M

    prometheus:
      image: prom/prometheus:v2.49.1
      volumes:
        - ./config/prometheus-config.yaml:/etc/prometheus/prometheus.yml
      ports:
        - "9090:9090"
      deploy:
        resources:
          limits:
            memory: 256M

    grafana:
      image: grafana/grafana:10.3.1
      ports:
        - "3000:3000"
      environment:
        - GF_SECURITY_ADMIN_PASSWORD=admin
      deploy:
        resources:
          limits:
            memory: 256M
  ```

- [ ] **Step 4: Create minimal config/tempo.yaml**

  Create file `config/tempo.yaml`:
  ```yaml
  stream_over_http: true
  server:
    http_listen_port: 3200

  distributor:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317

  ingester:
    max_block_duration: 5m

  compactor:
    compaction:
      block_retention: 24h

  storage:
    trace:
      backend: local
      local:
        path: /tmp/tempo/traces
  ```

- [ ] **Step 5: Verify containers startup**

  Run:
  ```bash
  docker compose -f docker-compose.obsv.yml up -d
  ```
  Expected: All containers running cleanly.

- [ ] **Step 6: Commit**

  ```bash
  git add docker-compose.obsv.yml config/
  git commit -m "chore(observability): add docker-compose setup and config files for LGTM stack"
  ```
