import type { AnalysisError } from "../domain/analysisErrorBase.js";

/** Ownership identity that anchors previously emitted cleanup-bound errors. */
export interface ProcessOwnershipCleanupKey {
  readonly runId: string;
  readonly leaderPid: number;
  readonly processGroupId: number;
}

const boundErrors = new Map<string, Set<WeakRef<AnalysisError>>>();

/** Stable owner attribution across retries; labels never match resource text. */
export const ownedProcessGroupCleanupKey = (
  ownership: ProcessOwnershipCleanupKey,
): string =>
  [
    ownership.runId,
    String(ownership.leaderPid),
    String(ownership.processGroupId),
  ].join("\u0000");

/**
 * Attribute one previously emitted error to this owner so a later confirmed
 * cleanup can resolve it. Attribution stays exact: unknown owners never
 * resolve and the error keeps its own dependency rules.
 */
export const bindProcessOwnershipCleanupError = (
  ownership: ProcessOwnershipCleanupKey,
  error: AnalysisError,
): void => {
  const key = ownedProcessGroupCleanupKey(ownership);
  const references = boundErrors.get(key) ?? new Set<WeakRef<AnalysisError>>();
  references.add(new WeakRef(error));
  boundErrors.set(key, references);
};

/**
 * Confirmed full release for this owner resolves exactly its bound errors in
 * place. Errors with independently owned unresolved dependencies stay
 * incomplete; failures never reach this path.
 */
export const resolveProcessOwnershipCleanup = (
  ownership: ProcessOwnershipCleanupKey,
): void => {
  const key = ownedProcessGroupCleanupKey(ownership);
  const references = boundErrors.get(key);
  if (references === undefined) return;
  boundErrors.delete(key);
  for (const reference of references) {
    const error = reference.deref();
    if (error === undefined) continue;
    error.resolveCleanup();
    if (!error.cleanupIncomplete) error.clearCleanupResources();
  }
};
