import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, expect, it, vi } from "vitest";

import {
  resolveXcrunTool,
  type NativeCommandLauncher,
} from "../../../../src/native/CommandRunner.js";

/**
 * Optional seam to hold `realpath` pending, so a test can reject it with a
 * physical I/O failure after the caller cancellation has already arrived.
 */
let interceptRealpath: ((path: string) => Promise<string>) | undefined;

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    realpath: (
      path: string,
      options?: Parameters<typeof actual.realpath>[1],
    ): Promise<string> =>
      interceptRealpath === undefined
        ? actual.realpath(path, options)
        : interceptRealpath(path),
  };
});

afterEach(() => {
  interceptRealpath = undefined;
});

/** A launcher that completes `xcrun --find` with one candidate path. */
const successfulFindLauncher = (candidate: string): NativeCommandLauncher => {
  let launches = 0;
  return async (options) => {
    launches += 1;
    const child = Object.assign(new EventEmitter(), {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      exitCode: null as number | null,
      signalCode: null as NodeJS.Signals | null,
      kill: () => true,
    });
    setImmediate(() => {
      child.stdout.end(`${candidate}\n`);
      child.exitCode = 0;
      child.emit("exit", 0, null);
      setImmediate(() => child.emit("close", 0, null));
    });
    return {
      process: child,
      ownership: {
        runId: options.runId,
        leaderPid: 44_000 + launches,
        processGroupId: 44_000 + launches,
        expectedParentPid: process.pid,
      },
      cleanup: async () => ({ cleaned: true, signaled: false }),
    };
  };
};

const eaccesError = (path: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`EACCES: permission denied, realpath '${path}'`), {
    code: "EACCES",
    errno: -13,
    syscall: "realpath",
    path,
  });

it("keeps a late physical realpath I/O failure primary over the ambient cancellation signal", async () => {
  const candidate = "/opt/xcode/otool";
  let realpathPending = 0;
  let rejectRealpath!: (cause: NodeJS.ErrnoException) => void;
  interceptRealpath = (path) =>
    new Promise<string>((_resolve, reject) => {
      realpathPending += 1;
      rejectRealpath = reject;
      void path;
    });

  const controller = new AbortController();
  const pending = resolveXcrunTool(
    "otool",
    {},
    controller.signal,
    successfulFindLauncher(candidate),
  );
  // Wait until the resolver's physical realpath work is actually pending.
  while (realpathPending === 0)
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 1));
  // The caller cancels while the physical I/O failure is still unresolved.
  controller.abort();
  rejectRealpath(eaccesError(candidate));

  const resolution = await pending;

  expect(resolution.ok).toBe(false);
  if (resolution.ok) return;
  expect(resolution.error.reason).toBe("io");
  expect(resolution.error.cause).toMatchObject({
    code: "EACCES",
    path: candidate,
  });
});

it("retains the exact abort reason when a resolver hash read is cancelled", async () => {
  const controller = new AbortController();
  const callerReason = { opaque: "caller-reason" };
  const pending = resolveXcrunTool(
    "otool",
    {},
    controller.signal,
    successfulFindLauncher("/dev/zero"),
  );
  // Give the endless /dev/zero hash read time to start before cancelling.
  await new Promise((resolveTimer) => setTimeout(resolveTimer, 20));
  controller.abort(callerReason);

  const resolution = await pending;

  expect(resolution.ok).toBe(false);
  if (resolution.ok) return;
  expect(resolution.error.reason).toBe("cancelled");
  expect(resolution.error.cause).toBe(callerReason);
});
