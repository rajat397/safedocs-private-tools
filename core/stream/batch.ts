// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.

export interface BatchResult<T> {
  file: File;
  result: T;
}

export interface ProgressEvent {
  completed: number;
  total: number;
  currentFile: File | null;
  bytesProcessed: number;
}

export interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  signal?: AbortSignal;
}

async function* batchProcess<T>(
  files: File[],
  processor: (file: File) => Promise<T>,
  options: BatchOptions = {}
): AsyncIterableIterator<{ progress: ProgressEvent; results: BatchResult<T>[] }> {
  const { batchSize = 10, concurrency = 3, signal } = options;
  const total = files.length;
  let completed = 0;
  let bytesProcessed = 0;
  const results: BatchResult<T>[] = [];

  const queue: Array<{ file: File; resolve: (value: T) => void; reject: (reason?: Error) => void }> = [];
  let activeCount = 0;
  let index = 0;

  const controller = new AbortController();
  const abortSignal = signal ?? controller.signal;

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const processFile = async (file: File): Promise<T> => {
    const result = await processor(file);
    bytesProcessed += file.size;
    return result;
  };

  const next = async (): Promise<void> => {
    if (abortSignal.aborted) return;
    if (index >= files.length && activeCount === 0) return;

    while (activeCount < concurrency && index < files.length) {
      const file = files[index++];
      activeCount++;

      const promise = processFile(file).then(
        (result) => {
          completed++;
          results.push({ file, result });
          activeCount--;
          return result;
        },
        (error) => {
          activeCount--;
          throw error;
        }
      );

      queue.push({ file, resolve: promise.then.bind(promise), reject: promise.catch.bind(promise) });
    }
  };

  const stream = new ReadableStream<{ progress: ProgressEvent; results: BatchResult<T>[] }>({
    async start(controller) {
      await next();

      while (completed < total && !abortSignal.aborted) {
        const batchResults: BatchResult<T>[] = [];
        const batchSizeActual = Math.min(batchSize, total - completed);

        for (let i = 0; i < batchSizeActual; i++) {
          if (queue.length === 0) break;
          const { file, resolve } = queue.shift()!;
          try {
            const result = await resolve();
            batchResults.push({ file, result });
          } catch (error) {
            controller.error(error);
            return;
          }
        }

        const progress: ProgressEvent = {
          completed,
          total,
          currentFile: batchResults[batchResults.length - 1]?.file ?? null,
          bytesProcessed,
        };

        controller.enqueue({ progress, results: batchResults });
        await next();
      }

      controller.close();
    },
    cancel() {
      controller.abort();
    },
  });

  const transform = new TransformStream<{ progress: ProgressEvent; results: BatchResult<T>[] }, { progress: ProgressEvent; results: BatchResult<T>[] }>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
    },
  });

  const readable = stream.pipeThrough(transform);

  for await (const chunk of readable) {
    yield chunk;
    if (abortSignal.aborted) break;
  }
}

export { batchProcess };