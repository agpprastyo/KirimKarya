# Distributed Tracing Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement end-to-end distributed tracing linking the SvelteKit frontend browser client to the Hono API and BullMQ Workers. Add a Hono router proxy `/api/observability/traces` to route browser traces safely to the internal OTel Collector.

**Architecture:** Web SDK instrumentation for SvelteKit using ZoneContextManager and FetchInstrumentation. Hono proxy endpoints forward OTLP payloads. Context propagation uses W3C header injection.

**Tech Stack:** OpenTelemetry Web SDK, SvelteKit, Hono.js, Bun.

## Global Constraints
- Do not expose OTel Collector raw ports (`4317` / `4318`) to the host in production.
- Ensure all type definitions compile cleanly in the workspace.
- The `docs/superpowers/` and `.superpowers/` folders must remain in the `private` remote backup only.

---

### Task 1: Extend `@kirimkarya/observability` with Web Tracing Support

**Files:**
- Modify: `packages/observability/package.json`
- Create: `packages/observability/src/tracing-web.ts`
- Modify: `packages/observability/src/index.ts`

**Interfaces:**
- Produces: `initWebTracing(serviceName: string, traceEndpoint: string): void`

- [ ] **Step 1: Add Web SDK dependencies to packages/observability/package.json**

  Edit `packages/observability/package.json` dependencies block:
  ```json
    "dependencies": {
      "@opentelemetry/api": "^1.9.0",
      "@opentelemetry/sdk-node": "^0.52.0",
      "@opentelemetry/exporter-trace-otlp-grpc": "^0.52.0",
      "@opentelemetry/sdk-trace-base": "^1.25.0",
      "@opentelemetry/resources": "^1.25.0",
      "@opentelemetry/semantic-conventions": "^1.25.0",
      "@opentelemetry/instrumentation": "^0.52.0",
      "@opentelemetry/instrumentation-http": "^0.52.0",
      "@opentelemetry/sdk-trace-web": "^1.25.0",
      "@opentelemetry/context-zone": "^1.25.0",
      "@opentelemetry/instrumentation-fetch": "^0.52.0",
      "@opentelemetry/exporter-trace-otlp-http": "^0.52.0"
    }
  ```

- [ ] **Step 2: Implement tracing-web.ts**

  Create file `packages/observability/src/tracing-web.ts`:
  ```typescript
  import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
  import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
  import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
  import { registerInstrumentations } from '@opentelemetry/instrumentation';
  import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
  import { ZoneContextManager } from '@opentelemetry/context-zone';
  import { Resource } from '@opentelemetry/resources';
  import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

  export function initWebTracing(serviceName: string, traceEndpoint: string) {
      if (typeof window === 'undefined') return;

      const provider = new WebTracerProvider({
          resource: new Resource({
              [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
          }),
      });

      const exporter = new OTLPTraceExporter({
          url: traceEndpoint,
      });

      provider.addSpanProcessor(new BatchSpanProcessor(exporter));
      provider.register({
          contextManager: new ZoneContextManager(),
      });

      registerInstrumentations({
          instrumentations: [
              new FetchInstrumentation({
                  propagateTraceHeaderCorsUrls: [
                      /http:\/\/localhost:\d+/,
                      /https:\/\/.*\.kirimkarya\.com/
                  ],
              }),
          ],
      });
  }
  ```

- [ ] **Step 3: Update package exports**

  Edit `packages/observability/src/index.ts` to export the new method:
  ```typescript
  export { initNodeTracing } from './tracing-node';
  export { initWebTracing } from './tracing-web';
  export { trace, propagation, context, ROOT_CONTEXT } from '@opentelemetry/api';
  ```

- [ ] **Step 4: Install packages**

  Run:
  ```bash
  bun install
  ```

- [ ] **Step 5: Verify types**

  Run:
  ```bash
  bun x tsc --noEmit
  ```
  Expected: Success, 0 errors.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/observability package.json bun.lock
  git commit -m "feat(observability): add Web Tracing SDK support and instrumentations"
  ```

---

### Task 2: Create Hono API Proxy Route

**Files:**
- Create: `apps/api/src/modules/observability/observability.controller.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Produces: Endpoint `POST /api/observability/traces` in Hono app

- [ ] **Step 1: Implement Observability Controller**

  Create file `apps/api/src/modules/observability/observability.controller.ts`:
  ```typescript
  import { Hono } from 'hono';

  export const observabilityRouter = new Hono();

  observabilityRouter.post('/traces', async (c) => {
      try {
          const body = await c.req.json();
          
          fetch('http://otel-collector:4318/v1/traces', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
          }).catch((err) => {
              console.error('[OTel Proxy] Failed to forward traces to collector:', err);
          });
          
          return c.json({ status: 'Accepted' }, 202);
      } catch (err) {
          return c.json({ error: 'Invalid Payload' }, 400);
      }
  });
  ```

- [ ] **Step 2: Register route in API Gateway**

  Edit `apps/api/src/index.ts` to mount this router:
  ```typescript
  // Import:
  import { observabilityRouter } from './modules/observability/observability.controller';

  // Mount (around other api route mounts):
  app.route('/api/observability', observabilityRouter);
  ```

- [ ] **Step 3: Verify strict type checks**

  Run:
  ```bash
  bun x tsc --noEmit --project apps/api/tsconfig.json
  ```
  Expected: Success, 0 errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/api/src/modules/observability apps/api/src/index.ts
  git commit -m "feat(api): add trace proxy route forwarding to OTel Collector"
  ```

---

### Task 3: Initialize Tracing in SvelteKit Frontend Client

**Files:**
- Create: `apps/web/src/hooks.client.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: `@kirimkarya/observability` Web SDK
- Produces: Tracing spans for client-side interactions sent on startup

- [ ] **Step 1: Add workspace dependency to apps/web**

  Edit `apps/web/package.json` dependencies block:
  ```json
  "@kirimkarya/observability": "workspace:*"
  ```

- [ ] **Step 2: Install dependencies**

  Run:
  ```bash
  bun install
  ```

- [ ] **Step 3: Create hooks.client.ts**

  Create file `apps/web/src/hooks.client.ts`:
  ```typescript
  import { initWebTracing } from '@kirimkarya/observability';
  import { env } from '$env/dynamic/public';

  if (env.PUBLIC_OTEL_ENABLED === 'true') {
      initWebTracing('kirimkarya-frontend', '/api/observability/traces');
  }
  ```

- [ ] **Step 4: Verify type safety**

  Run:
  ```bash
  bun x tsc --noEmit --skipLibCheck 2>&1 | grep -v "apps/web"
  ```
  Expected: Success.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/package.json apps/web/src/hooks.client.ts bun.lock
  git commit -m "feat(web): initialize OTel Web Tracing on client startup"
  ```
