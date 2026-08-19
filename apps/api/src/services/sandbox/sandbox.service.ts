import Docker from "dockerode";

// dockerode's docker-modem dependency reads process.env.DOCKER_HOST itself
// regardless of constructor options, so the unix:// default in .env.example
// (meant for Linux/macOS hosts) breaks it on Windows even when we try to
// override socketPath explicitly. Resolve the real per-platform default
// ourselves and only defer to DOCKER_HOST when it points somewhere that
// isn't that Linux/macOS default (e.g. a remote tcp:// daemon).
const DEFAULT_UNIX_DOCKER_HOST = "unix:///var/run/docker.sock";
const dockerHost = process.env.DOCKER_HOST;
const docker =
  dockerHost && dockerHost !== DEFAULT_UNIX_DOCKER_HOST
    ? new Docker({ socketPath: dockerHost.replace(/^unix:\/\//, "") })
    : new Docker({ socketPath: process.platform === "win32" ? "//./pipe/docker_engine" : "/var/run/docker.sock" });

const CPU_LIMIT = Number(process.env.SANDBOX_CPU_LIMIT ?? "0.5");
const MEMORY_LIMIT = process.env.SANDBOX_MEMORY_LIMIT ?? "256m";
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "cybersim-sandbox:latest";

function parseMemoryLimit(value: string): number {
  const match = /^(\d+)([mg])$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid SANDBOX_MEMORY_LIMIT: ${value}`);
  const amount = Number(match[1]);
  return match[2].toLowerCase() === "g" ? amount * 1024 * 1024 * 1024 : amount * 1024 * 1024;
}

function sandboxName(userId: string): string {
  // Docker container names only allow [a-zA-Z0-9_.-]; MongoDB ObjectIds are
  // already hex, but this keeps the function safe if the id format changes.
  return `cybersim-sandbox-${userId.replace(/[^a-zA-Z0-9_.-]/g, "")}`;
}

export interface SandboxStatus {
  running: boolean;
  containerId: string | null;
  name: string;
}

export async function getUserSandboxStatus(userId: string): Promise<SandboxStatus> {
  const name = sandboxName(userId);
  const containers = await docker.listContainers({ all: true, filters: JSON.stringify({ name: [name] }) });
  const match = containers.find((c) => c.Names.some((n) => n === `/${name}`));
  return { running: match?.State === "running", containerId: match?.Id ?? null, name };
}

// One isolated, resource-capped, network-less container per user session.
// Never exposes the Docker socket to the frontend, this runs server-side only.
export async function createUserSandbox(userId: string): Promise<SandboxStatus> {
  const existing = await getUserSandboxStatus(userId);
  if (existing.running) return existing;

  const name = sandboxName(userId);
  if (existing.containerId) {
    // A stopped container with this name exists (e.g. from a crashed session); remove it first.
    await docker.getContainer(existing.containerId).remove().catch(() => undefined);
  }

  const container = await docker.createContainer({
    Image: SANDBOX_IMAGE,
    name,
    HostConfig: {
      NetworkMode: "none",
      CpuQuota: Math.floor(CPU_LIMIT * 100000),
      CpuPeriod: 100000,
      Memory: parseMemoryLimit(MEMORY_LIMIT),
      MemorySwap: parseMemoryLimit(MEMORY_LIMIT),
      AutoRemove: false,
      ReadonlyRootfs: true,
      SecurityOpt: ["no-new-privileges"],
    },
  });
  await container.start();
  return { running: true, containerId: container.id, name };
}

export async function stopUserSandbox(userId: string): Promise<SandboxStatus> {
  const existing = await getUserSandboxStatus(userId);
  if (existing.containerId) {
    const container = docker.getContainer(existing.containerId);
    await container.stop().catch(() => undefined);
    await container.remove().catch(() => undefined);
  }
  return { running: false, containerId: null, name: existing.name };
}
