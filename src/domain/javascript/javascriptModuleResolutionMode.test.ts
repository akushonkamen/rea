import { describe, expect, it } from "vitest";

import { moduleResolutionModeForJavaScriptReference } from "./javascriptModuleResolutionMode.js";

describe("moduleResolutionModeForJavaScriptReference", () => {
  it("resolves explicit CommonJS sources in require mode", () => {
    expect(
      moduleResolutionModeForJavaScriptReference(
        "/app/entry.cjs",
        "static-import",
      ),
    ).toBe("require");
  });

  it("keeps the other extension and reference-kind mappings", () => {
    expect(
      moduleResolutionModeForJavaScriptReference("/app/a.cts", "static-import"),
    ).toBe("require");
    expect(
      moduleResolutionModeForJavaScriptReference("/app/a.mts", "static-import"),
    ).toBe("import");
    expect(
      moduleResolutionModeForJavaScriptReference("/app/a.ts", "static-import"),
    ).toBe("compiler-dependent");
    expect(
      moduleResolutionModeForJavaScriptReference("/app/a.js", "static-import"),
    ).toBe("import");
    expect(
      moduleResolutionModeForJavaScriptReference("/app/a.js", "require"),
    ).toBe("require");
    expect(
      moduleResolutionModeForJavaScriptReference("/app/a.js", "dynamic-import"),
    ).toBe("import");
  });
});
