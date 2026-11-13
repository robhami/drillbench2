// Kept separate so non-worker test environments need not evaluate import.meta.
export function createClearanceWorker() {
  return new Worker(new URL('./clearanceWorker.js', import.meta.url));
}
