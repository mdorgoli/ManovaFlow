import { describe, expect, it, vi } from "vitest";
import {
  RetryableError,
  withBoundedRetry
} from "@/modules/growth/application/retry";

describe("withBoundedRetry", () => {
  it("stops after three transient attempts", async () => {
    const operation = vi.fn(async () => {
      throw new RetryableError("temporary database failure");
    });

    await expect(
      withBoundedRetry(operation, { maxAttempts: 3, baseDelayMs: 0 })
    ).rejects.toThrow("temporary database failure");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("returns after a later transient attempt succeeds", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new RetryableError("first"))
      .mockResolvedValue("ok");

    await expect(
      withBoundedRetry(operation, { maxAttempts: 3, baseDelayMs: 0 })
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry policy or validation failures", async () => {
    const operation = vi.fn(async () => {
      throw new Error("policy rejected");
    });

    await expect(
      withBoundedRetry(operation, { maxAttempts: 3, baseDelayMs: 0 })
    ).rejects.toThrow("policy rejected");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
