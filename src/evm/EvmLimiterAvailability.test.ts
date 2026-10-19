import { describe, expect, it } from "vitest";

import {
  EVM_PRLIMIT_COMMAND_DEFAULT,
  evmLimiterAvailability,
} from "./EvmoleInterfaceProvider.js";

const passingLinuxFs = {
  accessSync: () => undefined,
  statSync: () => ({ isFile: () => true }),
};

describe("evmLimiterAvailability", () => {
  it("reports the selected limiter available when it is an executable regular file", () => {
    expect(
      evmLimiterAvailability(
        {},
        { platform: "linux", arch: "x64", fs: passingLinuxFs },
      ),
    ).toMatchObject({
      status: "available",
      diagnostics: { limiter_path: EVM_PRLIMIT_COMMAND_DEFAULT },
    });
  });

  it("honours an absolute REA_EVM_PRLIMIT_COMMAND override", () => {
    const availability = evmLimiterAvailability(
      { REA_EVM_PRLIMIT_COMMAND: "/opt/util-linux/bin/prlimit" },
      {
        platform: "linux",
        arch: "x64",
        fs: {
          accessSync: (path) => {
            if (path !== "/opt/util-linux/bin/prlimit")
              throw new Error(`probed unexpected path ${path}`);
          },
          statSync: (path) => ({
            isFile: () => path === "/opt/util-linux/bin/prlimit",
          }),
        },
      },
    );
    expect(availability).toMatchObject({
      status: "available",
      diagnostics: { limiter_path: "/opt/util-linux/bin/prlimit" },
    });
  });

  it("reports a missing limiter unavailable with executable_missing", () => {
    const availability = evmLimiterAvailability(
      {},
      {
        platform: "linux",
        arch: "x64",
        fs: {
          accessSync: () => {
            const error = new Error(
              "ENOENT: no such file or directory, access '/usr/bin/prlimit'",
            );
            throw error;
          },
          statSync: () => {
            throw new Error("stat must not run after a failed access");
          },
        },
      },
    );
    expect(availability).toMatchObject({
      status: "unavailable",
      code: "executable_missing",
      diagnostics: { limiter_path: EVM_PRLIMIT_COMMAND_DEFAULT },
    });
    expect(
      availability?.status === "unavailable" ? availability.reason : "",
    ).toContain("caller-supplied util-linux prlimit: /usr/bin/prlimit; ENOENT");
  });

  it("rejects a non-file limiter the way execution does", () => {
    const availability = evmLimiterAvailability(
      {},
      {
        platform: "linux",
        arch: "x64",
        fs: {
          accessSync: () => undefined,
          statSync: () => ({ isFile: () => false }),
        },
      },
    );
    expect(availability).toMatchObject({
      status: "unavailable",
      code: "executable_missing",
    });
    expect(
      availability?.status === "unavailable" ? availability.reason : "",
    ).toContain("regular executable file");
  });

  it("rejects a relative override before touching the filesystem", () => {
    const availability = evmLimiterAvailability(
      { REA_EVM_PRLIMIT_COMMAND: "prlimit" },
      {
        platform: "linux",
        arch: "x64",
        fs: {
          accessSync: () => {
            throw new Error("a relative override must not be probed");
          },
          statSync: () => ({ isFile: () => true }),
        },
      },
    );
    expect(availability).toMatchObject({
      status: "unavailable",
      code: "executable_missing",
    });
    expect(
      availability?.status === "unavailable" ? availability.reason : "",
    ).toContain("absolute executable path");
  });

  it("stays silent outside Linux x64 so non-Linux hosts keep their own gate", () => {
    expect(
      evmLimiterAvailability({}, { platform: "darwin", arch: "arm64" }),
    ).toBeUndefined();
    expect(
      evmLimiterAvailability({}, { platform: "linux", arch: "arm64" }),
    ).toBeUndefined();
  });

  it("stays silent on this host without injected probes", () => {
    expect(evmLimiterAvailability(process.env)).toBeUndefined();
  });
});
