import test from "node:test";
import assert from "node:assert/strict";
import {
  runAbortableSingleFlight,
  runSingleFlight,
  runWithRepoBuildQueue,
  type AbortableFlight,
} from "../src/cache/build-coordinator.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("runSingleFlight shares one in-flight task for the same key", async () => {
  const inflight = new Map<string, Promise<number>>();
  let calls = 0;

  const first = runSingleFlight(inflight, "same", async () => {
    calls += 1;
    await delay(10);
    return 42;
  });
  const second = runSingleFlight(inflight, "same", async () => {
    calls += 1;
    return 7;
  });

  assert.equal(await first, 42);
  assert.equal(await second, 42);
  assert.equal(calls, 1);
  assert.equal(inflight.size, 0);
});

test("runSingleFlight clears a failed flight so the key can retry", async () => {
  const inflight = new Map<string, Promise<number>>();
  let calls = 0;

  await assert.rejects(
    runSingleFlight(inflight, "retry", async () => {
      calls += 1;
      throw new Error("boom");
    }),
    /boom/,
  );

  const value = await runSingleFlight(inflight, "retry", async () => {
    calls += 1;
    return 2;
  });

  assert.equal(value, 2);
  assert.equal(calls, 2);
  assert.equal(inflight.size, 0);
});

test("runWithRepoBuildQueue serializes builds for the same repo", async () => {
  const events: string[] = [];
  const repo = "/tmp/pi-srcwalk-same-repo";

  const first = runWithRepoBuildQueue(repo, async () => {
    events.push("first:start");
    await delay(20);
    events.push("first:end");
    return "first";
  });
  const second = runWithRepoBuildQueue(repo, async () => {
    events.push("second:start");
    events.push("second:end");
    return "second";
  });

  assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
  assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);
});

test("runWithRepoBuildQueue allows different repos to build concurrently", async () => {
  let firstStarted = false;
  let secondStartedWhileFirstRunning = false;

  const first = runWithRepoBuildQueue("/tmp/pi-srcwalk-repo-a", async () => {
    firstStarted = true;
    await delay(30);
  });
  const second = runWithRepoBuildQueue("/tmp/pi-srcwalk-repo-b", async () => {
    secondStartedWhileFirstRunning = firstStarted;
  });

  await Promise.all([first, second]);
  assert.equal(secondStartedWhileFirstRunning, true);
});

test("runAbortableSingleFlight lets one waiter abort without cancelling another waiter", async () => {
  const inflight = new Map<string, AbortableFlight<number>>();
  const firstController = new AbortController();
  let taskCalls = 0;
  let resolveTask!: (value: number) => void;

  const task = (buildSignal: AbortSignal) =>
    new Promise<number>((resolve, reject) => {
      taskCalls += 1;
      resolveTask = resolve;
      buildSignal.addEventListener("abort", () => reject(new Error("build aborted")), { once: true });
    });

  const first = runAbortableSingleFlight(inflight, "abort", firstController.signal, "caller aborted", task);
  const second = runAbortableSingleFlight(inflight, "abort", undefined, "caller aborted", task);

  firstController.abort();
  await assert.rejects(first, /caller aborted/);
  assert.equal(taskCalls, 1);

  resolveTask(99);
  assert.equal(await second, 99);
  assert.equal(inflight.size, 0);
});

test("runAbortableSingleFlight abandons an unobserved build and allows a later retry", async () => {
  const inflight = new Map<string, AbortableFlight<number>>();
  const controller = new AbortController();
  let calls = 0;

  const first = runAbortableSingleFlight(inflight, "abandon", controller.signal, "caller aborted", (buildSignal) => {
    calls += 1;
    return new Promise<number>((resolve, reject) => {
      buildSignal.addEventListener("abort", () => reject(new Error("build aborted")), { once: true });
    });
  });

  controller.abort();
  await assert.rejects(first, /caller aborted/);
  await delay(0);

  const second = await runAbortableSingleFlight(inflight, "abandon", undefined, "caller aborted", async () => {
    calls += 1;
    return 5;
  });

  assert.equal(second, 5);
  assert.equal(calls, 2);
});
