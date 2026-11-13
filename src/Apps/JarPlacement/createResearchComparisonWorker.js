export function createResearchComparisonWorker() {
  return new Worker(new URL('./researchComparisonWorker.js', import.meta.url));
}
