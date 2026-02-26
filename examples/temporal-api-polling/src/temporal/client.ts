/**
 * Temporal Client — starts an apiPollingWorkflow and waits for its result.
 *
 * Run this after the Temporal dev server, mock API, and worker are all up:
 *   npm run client  (from the examples/temporal-api-polling directory)
 *
 * You can watch the workflow execute live in the Temporal Web UI:
 *   http://localhost:8233
 */

import { Client, Connection } from '@temporalio/client';
import { randomUUID } from 'crypto';
import {
  apiPollingWorkflow,
  cancelPollingSignal,
} from './workflows';
import type { PollingWorkflowInput, PollingWorkflowResult } from '../shared/types';

async function main(): Promise<void> {
  // Connect to the local Temporal dev server
  const connection = await Connection.connect({ address: 'localhost:7233' });
  const client = new Client({ connection });

  // ── Workflow input ────────────────────────────────────────────────────────
  const input: PollingWorkflowInput = {
    payload: {
      userId: 'user-42',
      action: 'generate-report',
      params: { format: 'pdf', dateRange: '2024-Q4' },
    },
    pollIntervalSeconds: 3,   // poll every 3 s (fast for demo purposes)
    maxAttempts: 15,
  };

  const workflowId = `api-polling-${randomUUID()}`;

  console.log('\n[client] Starting workflow:', workflowId);
  console.log('[client] Payload:', JSON.stringify(input.payload, null, 2));
  console.log(
    `[client] Watch it live → http://localhost:8233/namespaces/default/workflows/${workflowId}\n`,
  );

  const handle = await client.workflow.start(apiPollingWorkflow, {
    taskQueue: 'api-polling',
    workflowId,
    args: [input],
  });

  // ── Optional: demonstrate signal-based cancellation ───────────────────────
  // Uncomment the block below to cancel the workflow after 20 seconds.
  //
  // setTimeout(async () => {
  //   console.log('[client] Sending cancelPolling signal...');
  //   await handle.signal(cancelPollingSignal);
  // }, 20_000);

  // ── Wait for the result ───────────────────────────────────────────────────
  console.log('[client] Waiting for workflow to complete...\n');

  try {
    const result: PollingWorkflowResult = await handle.result();

    console.log('═══════════════════════════════════════');
    console.log('[client] Workflow completed successfully!');
    console.log('[client] Job ID   :', result.jobId);
    console.log('[client] Result   :', result.result);
    console.log('[client] Attempts :', result.attempts);
    console.log('═══════════════════════════════════════\n');
  } catch (err: unknown) {
    console.error('\n[client] Workflow failed:');
    if (err instanceof Error) {
      console.error('  Type   :', (err as { workflowError?: { type?: string } }).workflowError?.type ?? err.name);
      console.error('  Message:', err.message);
    } else {
      console.error(err);
    }
    process.exit(1);
  } finally {
    await connection.close();
  }
}

main().catch((err: unknown) => {
  console.error('[client] Unhandled error:', err);
  process.exit(1);
});
