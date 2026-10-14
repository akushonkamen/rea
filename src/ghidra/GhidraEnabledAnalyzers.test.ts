import { describe, expect, it } from "vitest";

import {
  MAX_GHIDRA_ENABLED_ANALYZER_NAMES,
  ghidraEnabledAnalyzersSchema,
} from "../config/ghidraEnabledAnalyzers.js";
import { parseConfig } from "../config/parseConfig.js";

const INSTALL = "/opt/ghidra_12.1.4_PUBLIC";

const configured = (setting?: string) => {
  const config = parseConfig({
    GHIDRA_INSTALL_DIR: INSTALL,
    ...(setting === undefined ? {} : { REA_GHIDRA_ENABLED_ANALYZERS: setting }),
  });
  if (!config.ok) throw config.error;
  return config.value.ghidraEnabledAnalyzers;
};

describe("REA_GHIDRA_ENABLED_ANALYZERS", () => {
  it("stays unset without the setting", () => {
    expect(configured(undefined)).toBeUndefined();
  });

  it("splits a comma-separated list and trims each name", () => {
    expect(
      configured(
        " Variadic Function Signature Override,Decompiler Switch Analysis ",
      ),
    ).toEqual([
      "Variadic Function Signature Override",
      "Decompiler Switch Analysis",
    ]);
  });

  it("treats an empty or blank list as unset", () => {
    expect(configured("")).toBeUndefined();
    expect(configured(" , ")).toBeUndefined();
  });

  it("keeps empty names out of the list instead of failing", () => {
    expect(
      configured(
        "Variadic Function Signature Override,,Decompiler Parameter ID",
      ),
    ).toEqual([
      "Variadic Function Signature Override",
      "Decompiler Parameter ID",
    ]);
  });

  it.each([
    ["a leading flag name", "-Variadic Function Signature Override"],
    ["a name with command metacharacters", "Analyzer(&calc)"],
    ["a non-ASCII name", "分析器"],
    ["an over-long name", "A".repeat(121)],
  ])("rejects %s", (_label, setting) => {
    const config = parseConfig({
      GHIDRA_INSTALL_DIR: INSTALL,
      REA_GHIDRA_ENABLED_ANALYZERS: setting,
    });
    expect(config.ok).toBe(false);
    if (!config.ok)
      expect(config.error).toMatchObject({
        settings: [
          expect.objectContaining({
            setting: "REA_GHIDRA_ENABLED_ANALYZERS",
          }),
        ],
      });
  });

  it("caps the list like the disabled list", () => {
    expect(MAX_GHIDRA_ENABLED_ANALYZER_NAMES).toBe(32);
    expect(
      ghidraEnabledAnalyzersSchema.safeParse("A,".repeat(32) + "A").success,
    ).toBe(false);
  });
});
