/**
 * Temporal Worker — bridges the Temporal server with our workflow + activities.
 *
 * The worker:
 *   • Bundles the workflow code (webpack, handled by the SDK) and runs it
 *     inside a deterministic V8 sandbox.
 *   • Runs activities directly in Node.js (full I/O access).
 *   • Listens on the 'api-polling' task queue.
 *
 * Prerequisites (run in separate terminals before starting this):
 *   1. temporal server start-dev      (Temporal dev server on :7233 / UI on :8233)
 *   2. npm run mock-api               (mock HTTP API on :3000)
 */

import { Worker } from '@temporalio/worker';
import * as activities from './activities';

async function main(): Promise<void> {
  const worker = await Worker.create({
    // The SDK bundles this file and all its imports for the workflow sandbox.
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'api-polling',
  });

  console.log('\n[worker] Temporal worker started');
  console.log('[worker] Task queue : api-polling');
  console.log('[worker] Temporal   : localhost:7233');
  console.log('[worker] Mock API   : http://localhost:3000');
  console.log('[worker] Web UI     : http://localhost:8233\n');

  // worker.run() resolves only when the worker is shut down (SIGINT / SIGTERM).
  await worker.run();
}

main().catch((err: unknown) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
