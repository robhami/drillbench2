export function createJarDownResearchWorker() {
  return new Worker(new URL('./jarDownResearchWorker.js', import.meta.url));
}
