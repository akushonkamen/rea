import { ghidraAnalyzerNameListSchema } from "./ghidraAnalyzerNames.js";

export { MAX_GHIDRA_ANALYZER_NAMES as MAX_GHIDRA_ENABLED_ANALYZER_NAMES } from "./ghidraAnalyzerNames.js";

/**
 * Parse `REA_GHIDRA_ENABLED_ANALYZERS` into the Ghidra auto-analyzers to
 * enable before default auto-analysis, such as `Variadic Function Signature
 * Override`.
 */
export const ghidraEnabledAnalyzersSchema = ghidraAnalyzerNameListSchema;
