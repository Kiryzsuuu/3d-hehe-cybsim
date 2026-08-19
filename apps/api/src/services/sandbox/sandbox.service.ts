import Docker from "dockerode";

const docker = new Docker({ socketPath: process.env.DOCKER_HOST?.replace("unix://", "") ?? "/var/run/docker.sock" });

const CPU_LIMIT = Number(process.env.SANDBOX_CPU_LIMIT ?? "0.5");
const MEMORY_LIMIT = process.env.SANDBOX_MEMORY_LIMIT ?? "256m";
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "cybersim-sandbox:latest";

function parseMemoryLimit(value: string): number {
  const match = /^(\d+)([mg])$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid SANDBOX_MEMORY_LIMIT: ${value}`);
  const amount = Number(match[1]);
  return match[2].toLowerCase() === "g" ? amount * 1024 * 1024 * 1024 : amount * 1024 * 1024;
}

// One isolated, resource-capped, network-less container per user session.
// Never exposes the Docker socket to the frontend — this runs server-side only.
export async function createUserSandbox(userId: string) {
  const container = await docker.createContainer({
    Image: SANDBOX_IMAGE,
    name: `cybersim-sandbox-${userId}`,
    HostConfig: {
      NetworkMode: "none",
      CpuQuota: Math.floor(CPU_LIMIT * 100000),
      CpuPeriod: 100000,
      Memory: parseMemoryLimit(MEMORY_LIMIT),
      MemorySwap: parseMemoryLimit(MEMORY_LIMIT),
      AutoRemove: true,
      ReadonlyRootfs: true,
      SecurityOpt: ["no-new-privileges"],
    },
  });
  await container.start();
  return { id: container.id, name: `cybersim-sandbox-${userId}` };
}

export async function removeUserSandbox(containerId: string) {
  const container = docker.getContainer(containerId);
  await container.stop().catch(() => undefined);
}
