// OTel client tracing disabled to prevent browser fetch/formData locking
/*
import { initWebTracing } from '@kirimkarya/observability';
import { env } from '$env/dynamic/public';

if (env.PUBLIC_OTEL_ENABLED === 'true') {
    initWebTracing('kirimkarya-frontend', '/api/observability/traces');
}
*/
