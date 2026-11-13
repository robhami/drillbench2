export function createCompressionAssessmentWorker() {
  return new Worker(new URL('./compressionAssessmentWorker.js', import.meta.url));
}
