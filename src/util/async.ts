import { AsyncJob, SonarModel } from '../schema.js';

// In-memory job storage (in production, use a persistent store)
const asyncJobs = new Map<string, AsyncJob>();

// Webhook timeout configuration
const WEBHOOK_TIMEOUT = 30000; // 30 seconds
const POLL_INTERVAL = 2000; // 2 seconds

/**
 * Create a new async job
 */
export function createAsyncJob(
  id: string,
  model: SonarModel,
  webhook?: string
): AsyncJob {
  const job: AsyncJob = {
    id,
    model,
    status: 'CREATED',
    createdAt: Date.now(),
  };

  asyncJobs.set(id, job);
  return job;
}

/**
 * Get an async job by ID
 */
export function getAsyncJob(id: string): AsyncJob | null {
  return asyncJobs.get(id) || null;
}

/**
 * Update job status
 */
export function updateAsyncJob(
  id: string,
  updates: Partial<AsyncJob>
): AsyncJob | null {
  const job = asyncJobs.get(id);
  if (!job) return null;

  const updatedJob = { ...job, ...updates };
  asyncJobs.set(id, updatedJob);
  return updatedJob;
}

/**
 * Mark job as started
 */
export function startAsyncJob(id: string): AsyncJob | null {
  return updateAsyncJob(id, {
    status: 'IN_PROGRESS',
    startedAt: Date.now(),
  });
}

/**
 * Complete job successfully
 */
export function completeAsyncJob(id: string, response: any): AsyncJob | null {
  return updateAsyncJob(id, {
    status: 'COMPLETED',
    completedAt: Date.now(),
    response,
  });
}

/**
 * Fail job with error
 */
export function failAsyncJob(id: string, errorMessage: string): AsyncJob | null {
  return updateAsyncJob(id, {
    status: 'FAILED',
    failedAt: Date.now(),
    errorMessage,
  });
}

/**
 * Send webhook notification
 */
export async function sendWebhook(
  webhookUrl: string,
  jobId: string,
  status: string,
  data?: any
): Promise<boolean> {
  try {
    const payload = {
      jobId,
      status,
      timestamp: new Date().toISOString(),
      data,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'pplx-zero/1.0.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT),
    });

    return response.ok;
  } catch (error) {
    console.error(`Webhook failed for job ${jobId}:`, error);
    return false;
  }
}

/**
 * Clean up old jobs (older than 24 hours)
 */
export function cleanupOldJobs(): number {
  const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
  let cleaned = 0;

  for (const [id, job] of asyncJobs.entries()) {
    if (job.createdAt < cutoff) {
      asyncJobs.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get all jobs (for debugging/monitoring)
 */
export function getAllAsyncJobs(): AsyncJob[] {
  return Array.from(asyncJobs.values());
}

/**
 * Poll for job completion
 */
export async function pollJobCompletion(
  jobId: string,
  maxPollTime: number = 60000, // 1 minute default
  pollInterval: number = POLL_INTERVAL
): Promise<{ job: AsyncJob | null; success: boolean }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTime) {
    const job = getAsyncJob(jobId);

    if (!job) {
      return { job: null, success: false };
    }

    if (job.status === 'COMPLETED') {
      return { job, success: true };
    }

    if (job.status === 'FAILED') {
      return { job, success: false };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Timeout reached
  return { job: getAsyncJob(jobId), success: false };
}

/**
 * Job status checker for CLI polling
 */
export function isJobComplete(job: AsyncJob): boolean {
  return job.status === 'COMPLETED' || job.status === 'FAILED';
}

/**
 * Get job result or error
 */
export function getJobResult(job: AsyncJob): { success: boolean; data?: any; error?: string } {
  if (job.status === 'COMPLETED') {
    return { success: true, data: job.response };
  } else if (job.status === 'FAILED') {
    return { success: false, error: job.errorMessage || 'Job failed' };
  } else {
    return { success: false, error: `Job not complete (status: ${job.status})` };
  }
}

// Auto-cleanup old jobs every hour
setInterval(cleanupOldJobs, 60 * 60 * 1000);