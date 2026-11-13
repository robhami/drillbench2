export function createTargetJarDownWorker() {
  return new Worker(new URL('./targetJarDownWorker.js', import.meta.url));
}
