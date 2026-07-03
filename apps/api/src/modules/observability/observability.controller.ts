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
