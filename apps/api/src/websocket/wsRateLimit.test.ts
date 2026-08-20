import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWsRateLimiter } from "./wsRateLimit.js";

describe("createWsRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the max calls within a window", () => {
    const allow = createWsRateLimiter(3, 1000);
    expect(allow()).toBe(true);
    expect(allow()).toBe(true);
    expect(allow()).toBe(true);
  });

  it("rejects calls beyond the max within the same window", () => {
    const allow = createWsRateLimiter(3, 1000);
    allow();
    allow();
    allow();
    expect(allow()).toBe(false);
    expect(allow()).toBe(false);
  });

  it("resets the count once the window elapses", () => {
    const allow = createWsRateLimiter(2, 1000);
    expect(allow()).toBe(true);
    expect(allow()).toBe(true);
    expect(allow()).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(allow()).toBe(true);
    expect(allow()).toBe(true);
    expect(allow()).toBe(false);
  });

  it("keeps separate counters per limiter instance (per-connection isolation)", () => {
    const allowA = createWsRateLimiter(1, 1000);
    const allowB = createWsRateLimiter(1, 1000);
    expect(allowA()).toBe(true);
    expect(allowA()).toBe(false);
    // A different connection's limiter is unaffected by A's usage.
    expect(allowB()).toBe(true);
  });
});
