/**
 * `mach-o/loader.h` `PLATFORM_*` numbers and their SDK spellings without the
 * prefix. One vocabulary for every face that names a build platform, so the
 * native otool parser and the pure-TS load-command reader cannot drift apart.
 */
export const MACHO_PLATFORM_NAMES: ReadonlyMap<number, string> = new Map([
  [1, "MACOS"],
  [2, "IOS"],
  [3, "TVOS"],
  [4, "WATCHOS"],
  [5, "BRIDGEOS"],
  [6, "MACCATALYST"],
  [7, "IOSSIMULATOR"],
  [8, "TVOSSIMULATOR"],
  [9, "WATCHOSSIMULATOR"],
  [10, "DRIVERKIT"],
  [11, "VISIONOS"],
  [12, "VISIONOSSIMULATOR"],
  [13, "FIRMWARE"],
  [14, "SEPOS"],
  [15, "MACOS_EXCLAVECORE"],
  [16, "MACOS_EXCLAVEKIT"],
  [17, "IOS_EXCLAVECORE"],
  [18, "IOS_EXCLAVEKIT"],
  [19, "TVOS_EXCLAVECORE"],
  [20, "TVOS_EXCLAVEKIT"],
  [21, "WATCHOS_EXCLAVECORE"],
  [22, "WATCHOS_EXCLAVEKIT"],
  [23, "VISIONOS_EXCLAVECORE"],
  [24, "VISIONOS_EXCLAVEKIT"],
]);

/**
 * SDK-style name for one platform code. Unknown future codes have no name;
 * callers keep the code itself visible instead of mapping to a neighbor.
 */
export const machoPlatformName = (code: number): string | null =>
  MACHO_PLATFORM_NAMES.get(code) ?? null;
