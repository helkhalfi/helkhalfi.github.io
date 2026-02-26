/**
 * Temporal Activities — the only place that talks to the outside world.
 *
 * Activities run in the normal Node.js environment (no sandbox), so they
 * can freely use I/O, Node.js APIs, and third-party libraries.
 *
 * Two activities are defined here:
 *   submitJob       — POST to the mock API, return the new job ID
 *   checkJobStatus  — GET the current state of a job, with heartbeating
 */

import { heartbeat, isCancellation } from '@temporalio/activity';
import type { JobState } from '../shared/types';

const API_BASE_URL = process.env.MOCK_API_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Exported shape that the workflow imports as a type (never imported at
// runtime inside the workflow sandbox).
// ---------------------------------------------------------------------------

export interface JobStatus {
  state: JobState;
  progress: number;
  result?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// submitJob
// ---------------------------------------------------------------------------

/**
 * Submit a new job to the external API.
 * Returns the opaque job ID that all subsequent polls will reference.
 */
export async function submitJob(
  payload: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });

  if (!response.ok) {
    throw new Error(
      `submitJob: API returned ${response.status} ${response.statusText}`,
    );
  }

  const { jobId } = (await response.json()) as { jobId: string };
  console.log(`[activity:submitJob] Created job ${jobId}`);
  return jobId;
}

// ---------------------------------------------------------------------------
// checkJobStatus
// ---------------------------------------------------------------------------

/**
 * Fetch the current status of a job.
 *
 * Heartbeats on every call so Temporal knows the activity is still alive
 * and can surface progress in the Web UI.  If the activity is cancelled
 * (e.g. because the workflow received a cancel signal), the heartbeat
 * throws a `CancelledFailure` which we re-throw to propagate the
 * cancellation correctly.
 */
export async function checkJobStatus(jobId: string): Promise<JobStatus> {
  // Tell Temporal we're still alive; surfaces progress in the Web UI.
  try {
    heartbeat({ jobId, checkedAt: new Date().toISOString() });
  } catch (err) {
    if (isCancellation(err)) {
      console.log(`[activity:checkJobStatus] Activity cancelled for job ${jobId}`);
      throw err; // propagate CancelledFailure
    }
    throw err;
  }

  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);

  if (!response.ok) {
    throw new Error(
      `checkJobStatus: API returned ${response.status} for job ${jobId}`,
    );
  }

  const status = (await response.json()) as JobStatus;
  console.log(
    `[activity:checkJobStatus] Job ${jobId}  state=${status.state}  progress=${status.progress}%`,
  );
  return status;
}
