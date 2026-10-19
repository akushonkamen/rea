import { describe, expect, it } from "vitest";

import { CdpBrowserProvider } from "../../../src/browser/CdpBrowserProvider.js";
import { analyzeWebBundleInputSchema } from "../../../src/domain/webBundleAnalysis.js";
import { startFakeCdpBrowser } from "../../fixtures/fakeCdpBrowser.js";
import { trackBrowser } from "./cdpBrowserProvider.support.js";

describe("analyzeWebBundle: static WebMCP declaration metadata through spreads", () => {
  it("keeps inline literal-spread metadata while preserving unknown spreads", async () => {
    const cases = [
      [
        "direct",
        'navigator.modelContext.registerTool({name:"catalog",description:"Browse catalog",inputSchema:{properties:{q:{}}}});',
        "catalog",
        "Browse catalog",
        ["q"],
      ],
      [
        "literal-spread",
        'navigator.modelContext.registerTool({...{name:"catalog",description:"Browse catalog",inputSchema:{properties:{q:{}}}}});',
        "catalog",
        "Browse catalog",
        ["q"],
      ],
      [
        "unrelated-literal-spread",
        'navigator.modelContext.registerTool({name:"catalog",description:"Browse catalog",inputSchema:{properties:{q:{}}},...{timeout:5}});',
        "catalog",
        "Browse catalog",
        ["q"],
      ],
      [
        "dynamic-spread-control",
        'navigator.modelContext.registerTool({name:"catalog",...dynamic});',
        null,
        null,
        [],
      ],
    ] as const;
    let source = "";
    const browser = await startFakeCdpBrowser({
      commandResult: (command) =>
        command.method === "Debugger.getScriptSource"
          ? { scriptSource: source }
          : undefined,
    });
    trackBrowser(browser);
    const provider = new CdpBrowserProvider();
    for (const [label, text, name, description, properties] of cases) {
      source = text;
      const result = await provider.analyzeBundle(
        analyzeWebBundleInputSchema.parse({
          cdp_endpoint: browser.endpoint,
          target_id: "allowed-page",
          observation_ms: 0,
          include_script_sources: true,
        }),
      );
      if (!result.ok) throw result.error;
      const declarations = result.value.observations.webmcp_declarations;
      expect(declarations.length, label).toBeGreaterThan(0);
      for (const declaration of declarations)
        expect(declaration, label).toMatchObject({
          name,
          description,
          schema_property_names: properties,
          trust: "page-declared-untrusted",
        });
    }
  });
});
