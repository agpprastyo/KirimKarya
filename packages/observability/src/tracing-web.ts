import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export function initWebTracing(serviceName: string, traceEndpoint: string) {
    if (typeof globalThis === 'undefined' || !('window' in globalThis)) return;

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
