/**
 * Temporal Workflow — API polling with sleep, signals, and error handling.
 *
 * Workflow code runs inside Temporal's deterministic V8 sandbox, so:
 *   ✗  No direct I/O, timers (setTimeout), or random values
 *   ✓  proxyActivities  — delegate I/O to activities
 *   ✓  workflow.sleep   — deterministic, durable wait
 *   ✓  defineSignal     — external cancellation
 *   ✓  ApplicationFailure — typed errors visible in the Temporal Web UI
 *
 * Pattern implemented:
 *   1. Submit the job via the submitJob activity.
 *   2. Loop: call checkJobStatus, sleep pollIntervalSeconds, repeat.
 *   3. Exit when the job reaches 'completed' or 'failed'.
 *   4. A 'cancelPolling' signal can abort the loop at any time.
 */

import {
  proxyActivities,
  sleep,
  defineSignal,
  setHandler,
  ApplicationFailure,
  log,
} from '@temporalio/workflow';

// Import *only the type* — the actual module is never loaded inside the sandbox.
import type * as activities from './activities';
import type { PollingWorkflowInput, PollingWorkflowResult } from '../shared/types';

// ---------------------------------------------------------------------------
// Activity proxies
// ---------------------------------------------------------------------------

const { submitJob, checkJobStatus } = proxyActivities<typeof activities>({
  // Each activity call must complete within this window; Temporal retries on failure.
  startToCloseTimeout: '15 seconds',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '10 seconds',
  },
});

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/** Send this signal to the running workflow to abort polling early. */
export const cancelPollingSignal = defineSignal('cancelPolling');

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function apiPollingWorkflow(
  input: PollingWorkflowInput,
): Promise<PollingWorkflowResult> {
  const {
    payload,
    pollIntervalSeconds = 5,
    maxAttempts = 20,
  } = input;

  // ── Signal handler ───────────────────────────────────────────────────────
  // Registered before any await so the signal can arrive at any time.
  let cancelled = false;
  setHandler(cancelPollingSignal, () => {
    log.warn('cancelPolling signal received — aborting poll loop');
    cancelled = true;
  });

  // ── Step 1: submit ───────────────────────────────────────────────────────
  log.info('Submitting job', { payload });
  const jobId = await submitJob(payload);
  log.info('Job submitted', { jobId });

  // ── Step 2: poll ─────────────────────────────────────────────────────────
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (cancelled) {
      throw ApplicationFailure.create({
        message: `Polling aborted by cancelPolling signal after ${attempt - 1} attempts`,
        type: 'Cancelled',
      });
    }

    log.info('Polling job status', { jobId, attempt, maxAttempts });

    const status = await checkJobStatus(jobId);

    if (status.state === 'completed') {
      log.info('Job completed', { jobId, result: status.result });
      return { jobId, result: status.result!, attempts: attempt };
    }

    if (status.state === 'failed') {
      throw ApplicationFailure.create({
        message: `Job ${jobId} failed: ${status.error}`,
        type: 'JobFailed',
        // nonRetryable prevents Temporal from re-running the workflow
        nonRetryable: true,
      });
    }

    // Still in progress — wait before the next poll.
    // workflow.sleep is durable: a server restart won't miss the timer.
    log.info('Job still in progress, sleeping before next poll', {
      jobId,
      state: status.state,
      progress: status.progress,
      sleepSeconds: pollIntervalSeconds,
    });

    await sleep(`${pollIntervalSeconds} seconds`);
  }

  // Exhausted all attempts without a terminal state
  throw ApplicationFailure.create({
    message: `Job did not complete within ${maxAttempts} polling attempts`,
    type: 'MaxAttemptsExceeded',
  });
}
