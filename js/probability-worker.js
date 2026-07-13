import { calculateHandOdds } from './probability.js';

self.addEventListener('message', event => {
  const { requestId, hand, selected, sampleSize } = event.data;
  try {
    const result = calculateHandOdds({ hand, selected, sampleSize });
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : 'Не удалось рассчитать вероятности.'
    });
  }
});
