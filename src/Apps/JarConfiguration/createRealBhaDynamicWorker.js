export function createRealBhaDynamicWorker() {
  return new Worker(new URL('./realBhaDynamicWorker.js', import.meta.url));
}
