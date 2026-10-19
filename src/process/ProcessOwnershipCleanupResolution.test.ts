import { randomUUID } from "node:crypto";

import { expect, it } from "vitest";

import { ProviderAdapterError } from "../domain/providerAdapterError.js";
import {
  bindProcessOwnershipCleanupError,
  resolveProcessOwnershipCleanup,
} from "./ProcessOwnershipCleanupResolution.js";
import {
  cleanupOwnedProcessGroup,
  type ProcessOwnershipHost,
} from "./ProcessOwnership.js";
import { spawnOwnedProviderProcess } from "./ProviderProcess.js";

const liveWorkerOptions = () => ({
  command: process.execPath,
  arguments: ["-e", "process.stdin.resume(); setInterval(() => {}, 1000);"],
  runId: `rea-owner-cleanup-test-${randomUUID()}`,
});

/** Refusal barrier: cleanup cannot even inspect the process table. */
const refusingHost = (): ProcessOwnershipHost => ({
  platform: "linux",
  listProcesses: async () => {
    throw new Error("controlled process-table refusal");
  },
  environment: async () => ({}),
  signalGroup: () => {
    throw new Error("controlled signal refusal");
  },
});

const cleanupBoundError = (
  ownership: { readonly runId: string },
): ProviderAdapterError =>
  new ProviderAdapterError("fixture-provider", "fixture-operation", {
    cleanup: {
      reason: "owned process cleanup remains incomplete",
      resources: [
        ownership.runId,
        "pid:0",
        "process-group:0",
      ],
    },
  });

it(
  "resolves the original cleanup-bound error in place after repeated refused cleanups are finally confirmed",
  { timeout: 120_000 },
  async () => {
    const spawned = await spawnOwnedProviderProcess(liveWorkerOptions());
    const ownership = spawned.ownership;
    const error = cleanupBoundError(ownership);
    expect(error.cleanupIncomplete).toBe(true);
    bindProcessOwnershipCleanupError(ownership, error);

    try {
      // Two owner-retry attempts refuse to confirm cleanup; the emitted
      // error must keep blocking every time.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const refused = await cleanupOwnedProcessGroup(
          ownership,
          refusingHost(),
        );
        expect(refused.cleaned).toBe(false);
        expect(error.cleanupIncomplete).toBe(true);
        expect(error.cleanupResources).toContain(ownership.runId);
      }

      // The owner then confirms a real cleanup of the same process group.
      const confirmed = await cleanupOwnedProcessGroup(ownership);
      expect(confirmed.cleaned).toBe(true);
      expect(error.cleanupIncomplete).toBe(false);
      expect(error.cleanupResources).toEqual([]);
    } finally {
      if (error.cleanupIncomplete)
        await cleanupOwnedProcessGroup(ownership).catch(() => undefined);
      spawned.process.kill("SIGKILL");
    }
  },
);

it("keeps unknown owners and still-owned dependencies unresolved", async () => {
  const resolved = cleanupBoundError({ runId: "rea-owner-cleanup-resolved" });
  const blocked = cleanupBoundError({ runId: "rea-owner-cleanup-resolved" });
  const stillOwned = cleanupBoundError({ runId: "rea-owner-cleanup-resolved" });
  blocked.bindCleanupDependencies([stillOwned]);

  bindProcessOwnershipCleanupError(
    { runId: "rea-owner-cleanup-resolved", leaderPid: 1, processGroupId: 1 },
    resolved,
  );
  bindProcessOwnershipCleanupError(
    { runId: "rea-owner-cleanup-resolved", leaderPid: 1, processGroupId: 1 },
    blocked,
  );

  resolveProcessOwnershipCleanup({
    runId: "rea-owner-cleanup-other",
    leaderPid: 2,
    processGroupId: 2,
  });
  expect(resolved.cleanupIncomplete).toBe(true);

  resolveProcessOwnershipCleanup({
    runId: "rea-owner-cleanup-resolved",
    leaderPid: 1,
    processGroupId: 1,
  });
  expect(resolved.cleanupIncomplete).toBe(false);
  // The owner released, but an independently owned resource is still held.
  expect(blocked.cleanupIncomplete).toBe(true);
  expect(stillOwned.cleanupIncomplete).toBe(true);
});
