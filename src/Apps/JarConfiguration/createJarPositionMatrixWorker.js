export function createJarPositionMatrixWorker() {
  return new Worker(new URL('./jarPositionMatrixWorker.js', import.meta.url));
}
