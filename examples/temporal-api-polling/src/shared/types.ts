// ---------------------------------------------------------------------------
// Shared types used by the mock API, activities, and workflows.
// ---------------------------------------------------------------------------

/** Lifecycle states of a submitted job. */
export type JobState = 'pending' | 'processing' | 'completed' | 'failed';

/** Full job record returned by the mock API. */
export interface Job {
  id: string;
  payload: Record<string, unknown>;
  state: JobState;
  /** 0–100 */
  progress: number;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/** Body sent to POST /jobs */
export interface CreateJobRequest {
  payload: Record<string, unknown>;
}

/** Response from POST /jobs */
export interface CreateJobResponse {
  jobId: string;
}

/** Input accepted by the top-level Temporal workflow. */
export interface PollingWorkflowInput {
  payload: Record<string, unknown>;
  /** Seconds to wait between each poll (default: 5). */
  pollIntervalSeconds?: number;
  /** Maximum number of poll attempts before giving up (default: 20). */
  maxAttempts?: number;
}

/** Successful result returned by the workflow when the job completes. */
export interface PollingWorkflowResult {
  jobId: string;
  result: string;
  attempts: number;
}
