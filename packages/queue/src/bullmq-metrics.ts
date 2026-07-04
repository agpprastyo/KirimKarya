/**
 * BullMQ Metrics Export untuk Prometheus
 *
 * Terintegrasi dengan OpenTelemetry atau Prometheus client langsung
 * Metrics yang diexport:
 * - bullmq_active_jobs
 * - bullmq_waiting_jobs
 * - bullmq_completed_jobs_total
 * - bullmq_failed_jobs_total
 * - bullmq_job_duration_milliseconds
 *
 * Usage di API/Worker:
 * import { initBullMQMetrics } from './bullmq-metrics'
 * initBullMQMetrics(photoQueue, notificationQueue, cleanupQueue)
 */

import { Queue, QueueListener } from 'bullmq';
import { Counter, Gauge, Histogram, register } from 'prom-client';

// Metrics definition
const activeJobsGauge = new Gauge({
  name: 'bullmq_active_jobs',
  help: 'Number of jobs currently being processed',
  labelNames: ['queue'],
  registers: [register],
});

const waitingJobsGauge = new Gauge({
  name: 'bullmq_waiting_jobs',
  help: 'Number of jobs waiting in queue',
  labelNames: ['queue'],
  registers: [register],
});

const completedJobsCounter = new Counter({
  name: 'bullmq_completed_jobs_total',
  help: 'Total number of completed jobs',
  labelNames: ['queue'],
  registers: [register],
});

const failedJobsCounter = new Counter({
  name: 'bullmq_failed_jobs_total',
  help: 'Total number of failed jobs',
  labelNames: ['queue'],
  registers: [register],
});

const jobDurationHistogram = new Histogram({
  name: 'bullmq_job_duration_milliseconds',
  help: 'Job processing duration in milliseconds',
  labelNames: ['queue', 'status'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
});

/**
 * Initialize BullMQ metrics collection
 * Call this once during application startup
 */
export function initBullMQMetrics(...queues: Queue[]) {
  queues.forEach((queue) => {
    const queueName = queue.name;

    // Update active jobs periodically
    setInterval(async () => {
      const activeCount = await queue.getActiveCount();
      activeJobsGauge.set({ queue: queueName }, activeCount);
    }, 15000); // Every 15 seconds

    // Update waiting jobs periodically
    setInterval(async () => {
      const waitingCount = await queue.getWaitingCount();
      waitingJobsGauge.set({ queue: queueName }, waitingCount);
    }, 15000);

    // Listen for job completion
    queue.on('completed', (job) => {
      completedJobsCounter.inc({ queue: queueName });

      if (job.progress() >= 0) {
        const duration = Date.now() - job.attemptStarted;
        jobDurationHistogram.observe(
          { queue: queueName, status: 'success' },
          duration
        );
      }
    });

    // Listen for job failures
    queue.on('failed', (job, err) => {
      failedJobsCounter.inc({ queue: queueName });

      if (job && job.attemptStarted) {
        const duration = Date.now() - job.attemptStarted;
        jobDurationHistogram.observe(
          { queue: queueName, status: 'failed' },
          duration
        );
      }

      console.error(`[BullMQ] Job ${job?.id} failed:`, err.message);
    });

    // Listen for job errors (retryable)
    queue.on('error', (err) => {
      console.error(`[BullMQ] Queue error (${queueName}):`, err);
    });

    console.log(`[BullMQ Metrics] Initialized for queue: ${queueName}`);
  });
}

/**
 * Get current metrics endpoint
 * Use this to expose metrics for Prometheus scraping
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Example: Expose metrics endpoint in Express/Hono
 *
 * In apps/api/src/index.ts:
 *
 * import { getMetrics } from '@kirimkarya/queue/bullmq-metrics'
 *
 * app.get('/metrics', async (c) => {
 *   const metrics = await getMetrics()
 *   return new Response(metrics, {
 *     headers: { 'Content-Type': 'text/plain' }
 *   })
 * })
 */

