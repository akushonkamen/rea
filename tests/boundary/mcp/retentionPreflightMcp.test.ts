import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { expect, it, vi } from "vitest";

import { WasmArtifactService } from "../../../src/application/wasm/WasmArtifactService.js";
import type { WasmArtifactPort } from "../../../src/application/wasm/WasmArtifactPort.js";
import { AnalysisInputError } from "../../../src/domain/analysisErrorCore.js";
import { err, ok } from "../../../src/domain/result.js";
import { parseEvidence } from "../../../src/domain/evidence.js";
import { createServer } from "../../../src/server/createServer.js";
import { createTestBinarySession } from "../../fixtures/binarySession.js";
import { parseMcpToolError } from "../../fixtures/mcpToolError.js";
import {
  wasmArtifactExecution,
  wasmArtifactFixture,
} from "../../fixtures/wasm/artifact.js";

it("refuses summary delivery before entering the WASM provider on a fixed MCP server", async () => {
  const value = wasmArtifactFixture();
  const inspect = vi.fn<WasmArtifactPort["inspect"]>(() =>
    Promise.resolve(ok(wasmArtifactExecution(value))),
  );
  const service = new WasmArtifactService({
    close: () => Promise.resolve(),
    inspect,
  });
  const session = createTestBinarySession(() => {
    throw new Error("No native provider expected");
  });
  const server = createServer(
    { kind: "fixed", analysis: session },
    { wasmArtifact: service, environment: {} },
  );
  const client = new Client({ name: "retention-preflight", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // Summary on a server without Evidence retention must be refused before
    // any provider work, with the retention diagnostic.
    const summary = await client.callTool({
      name: "inspect_wasm_artifact",
      arguments: { path: value.artifact.path, detail: "summary" },
    });
    const summaryError = parseMcpToolError(summary).error;
    expect(summaryError.code).toBe("capability_unavailable");
    expect(summaryError.message).toContain("does not retain Evidence");
    expect(inspect).toHaveBeenCalledTimes(0);

    // Complete delivery keeps working on the same server.
    const complete = await client.callTool({
      name: "inspect_wasm_artifact",
      arguments: { path: value.artifact.path, detail: "complete" },
    });
    expect(complete.isError).not.toBe(true);
    expect(parseEvidence(complete.structuredContent).normalized_result).toEqual(
      value,
    );
    expect(inspect).toHaveBeenCalledTimes(1);

    // Once the preflight passes (complete delivery), provider failures keep
    // their original semantics.
    const providerFailure = err(
      new AnalysisInputError(
        "inspect_wasm_artifact",
        { userMessage: "synthetic failure" },
      ),
    ) as Awaited<ReturnType<WasmArtifactPort["inspect"]>>;
    inspect.mockImplementationOnce(() => Promise.resolve(providerFailure));
    const failed = await client.callTool({
      name: "inspect_wasm_artifact",
      arguments: { path: value.artifact.path, detail: "complete" },
    });
    const failure = parseMcpToolError(failed).error;
    expect(failure.code).toBe("invalid_request");
    expect(inspect).toHaveBeenCalledTimes(2);

    await client.ping();
  } finally {
    await client.close();
    await server.close();
    await session.close();
  }
});
