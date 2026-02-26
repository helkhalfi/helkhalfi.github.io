/**
 * Mock HTTP API — simulates an asynchronous job-processing service.
 *
 * Endpoints:
 *   POST /jobs        — submit a new job, returns { jobId }
 *   GET  /jobs/:id    — returns the current Job record
 *
 * The state machine progresses automatically based on wall-clock time
 * so you don't need a real external service to run the Temporal example:
 *
 *   0 – 2 s   → pending    (0 %)
 *   2 – 8 s   → processing (0 → 90 %)
 *   > 8 s     → completed  (100 %) for most jobs
 *              → failed            for jobs whose ID ends in 0 or 5
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Job, CreateJobRequest, CreateJobResponse } from '../shared/types';

const app = express();
app.use(express.json());

// In-memory job store (sufficient for local dev)
const jobs = new Map<string, Job>();

/** Compute the current state of a job based on elapsed time. */
function resolveJobState(job: Job): Job {
  const elapsed = Date.now() - job.createdAt;

  if (elapsed < 2_000) {
    return { ...job, state: 'pending', progress: 0 };
  }

  if (elapsed < 8_000) {
    const progress = Math.min(90, Math.floor(((elapsed - 2_000) / 6_000) * 90));
    return { ...job, state: 'processing', progress };
  }

  // Deterministically fail ~20 % of jobs so we can observe error handling
  const lastHexNibble = parseInt(job.id.slice(-1), 16);
  const shouldFail = lastHexNibble % 5 === 0;

  if (shouldFail) {
    return {
      ...job,
      state: 'failed',
      progress: 0,
      error: 'Downstream timeout: upstream service did not respond in time',
    };
  }

  return {
    ...job,
    state: 'completed',
    progress: 100,
    result: `Processed successfully: ${JSON.stringify(job.payload)}`,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.post('/jobs', (req: Request, res: Response) => {
  const { payload } = req.body as CreateJobRequest;

  const job: Job = {
    id: randomUUID(),
    payload,
    state: 'pending',
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  jobs.set(job.id, job);

  console.log(`[mock-api] ✚ Created job ${job.id}`, payload);
  const body: CreateJobResponse = { jobId: job.id };
  res.status(201).json(body);
});

app.get('/jobs/:id', (req: Request, res: Response) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: `Job '${req.params.id}' not found` });
    return;
  }

  const current = resolveJobState(job);
  console.log(
    `[mock-api] ↳ Job ${job.id}  state=${current.state}  progress=${current.progress}%`,
  );
  res.json(current);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  console.log(`\nMock API server listening on http://localhost:${PORT}`);
  console.log('  POST /jobs       — submit a new job');
  console.log('  GET  /jobs/:id   — poll job status\n');
});
