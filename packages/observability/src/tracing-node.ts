import * as opentelemetrySdkNode from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export function initNodeTracing(serviceName: string, collectorEndpoint: string) {
    const SDKConstructor = (opentelemetrySdkNode.NodeSDK || (opentelemetrySdkNode as any).default?.NodeSDK || opentelemetrySdkNode);
    const sdk = new (SDKConstructor as any)({
        resource: new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        }),
        traceExporter: new OTLPTraceExporter({ url: collectorEndpoint }),
        spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter({ url: collectorEndpoint })),
        instrumentations: [],
    });

    sdk.start();

    process.on('SIGTERM', () => {
        sdk.shutdown()
            .then(() => console.log('OTel SDK shut down successfully'))
            .catch((err: unknown) => console.error('Error shutting down OTel SDK', err));
    });
}
