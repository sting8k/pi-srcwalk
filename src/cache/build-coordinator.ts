import path from "node:path";

export interface AbortableFlight<T> {
  promise: Promise<T>;
  controller: AbortController;
  waiters: number;
  settled: boolean;
}

const repoBuildQueues = new Map<string, Promise<void>>();

export function runSingleFlight<T>(inflight: Map<string, Promise<T>>, key: string, task: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = Promise.resolve()
    .then(task)
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

export function runAbortableSingleFlight<T>(
  inflight: Map<string, AbortableFlight<T>>,
  key: string,
  signal: AbortSignal | undefined,
  message: string,
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (signal?.aborted) throw new Error(message);

  let flight = inflight.get(key);
  if (flight?.controller.signal.aborted && flight.waiters === 0 && !flight.settled) {
    inflight.delete(key);
    flight = undefined;
  }
  if (!flight) {
    const controller = new AbortController();
    flight = {
      controller,
      promise: Promise.resolve(undefined as T),
      waiters: 0,
      settled: false,
    };
    const promise = Promise.resolve()
      .then(() => task(controller.signal))
      .finally(() => {
        flight!.settled = true;
        if (inflight.get(key) === flight) inflight.delete(key);
      });
    flight.promise = promise;
    inflight.set(key, flight);
  }

  flight.waiters += 1;
  const releaseWaiter = () => {
    flight!.waiters -= 1;
    if (flight!.waiters === 0 && !flight!.settled && !flight!.controller.signal.aborted) flight!.controller.abort();
  };

  return waitForAbort(flight.promise, signal, message).finally(releaseWaiter);
}

export async function runWithRepoBuildQueue<T>(repo: string, task: () => Promise<T>): Promise<T> {
  const key = path.resolve(repo);
  const previous = repoBuildQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  repoBuildQueues.set(key, tail);

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (repoBuildQueues.get(key) === tail) repoBuildQueues.delete(key);
  }
}

export async function waitForAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined, message: string): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw new Error(message);

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error(message));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}
