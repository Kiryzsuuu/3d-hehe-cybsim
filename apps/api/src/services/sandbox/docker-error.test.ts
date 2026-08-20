import { describe, it, expect } from "vitest";
import { describeDockerError } from "./docker-error.js";

describe("describeDockerError", () => {
  it("maps socket-connection errors to 503 Docker-unreachable", () => {
    for (const code of ["ENOENT", "ECONNREFUSED", "EACCES"]) {
      const result = describeDockerError({ code });
      expect(result.status).toBe(503);
      expect(result.message).toMatch(/docker/i);
    }
  });

  it("maps a 409 conflict to a retry-worthy message", () => {
    const result = describeDockerError({ statusCode: 409 });
    expect(result.status).toBe(409);
  });

  it("maps a 404 to a missing-image message", () => {
    const result = describeDockerError({ statusCode: 404 });
    expect(result.status).toBe(503);
    expect(result.message).toMatch(/image/i);
  });

  it("maps a 500 daemon error to a 502", () => {
    const result = describeDockerError({ statusCode: 500 });
    expect(result.status).toBe(502);
  });

  it("falls back to the raw error message for anything unrecognized", () => {
    const result = describeDockerError(new Error("something unusual happened"));
    expect(result.status).toBe(502);
    expect(result.message).toBe("something unusual happened");
  });

  it("never throws, even for a completely malformed input", () => {
    expect(() => describeDockerError(null)).not.toThrow();
    expect(() => describeDockerError(undefined)).not.toThrow();
    expect(() => describeDockerError("plain string")).not.toThrow();
  });
});
