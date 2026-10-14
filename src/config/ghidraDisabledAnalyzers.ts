import { ghidraAnalyzerNameListSchema } from "./ghidraAnalyzerNames.js";

export { MAX_GHIDRA_ANALYZER_NAMES as MAX_GHIDRA_DISABLED_ANALYZER_NAMES } from "./ghidraAnalyzerNames.js";

/**
 * Parse `REA_GHIDRA_DISABLED_ANALYZERS` into the Ghidra auto-analyzers to
 * disable before default auto-analysis, such as
 * `Objective-C Message Analyzer`.
 */
export const ghidraDisabledAnalyzersSchema = ghidraAnalyzerNameListSchema;
