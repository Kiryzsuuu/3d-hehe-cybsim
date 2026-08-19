import Docker from "dockerode";

// dockerode's docker-modem dependency reads process.env.DOCKER_HOST itself
// regardless of constructor options, so the unix:// default in .env.example
// (meant for Linux/macOS hosts) breaks it on Windows even when an explicit
// socketPath override is passed. Resolve the real per-platform default
// ourselves and only defer to DOCKER_HOST when it points somewhere that
// isn't that Linux/macOS default (e.g. a remote tcp:// daemon).
const DEFAULT_UNIX_DOCKER_HOST = "unix:///var/run/docker.sock";
const dockerHost = process.env.DOCKER_HOST;

export const docker =
  dockerHost && dockerHost !== DEFAULT_UNIX_DOCKER_HOST
    ? new Docker({ socketPath: dockerHost.replace(/^unix:\/\//, "") })
    : new Docker({ socketPath: process.platform === "win32" ? "//./pipe/docker_engine" : "/var/run/docker.sock" });

export function safeContainerId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_.-]/g, "");
}
