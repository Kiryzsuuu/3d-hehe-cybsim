import { docker, safeContainerId } from "./docker-client.js";

const DVWA_IMAGE = process.env.DVWA_IMAGE ?? "vulnerables/web-dvwa";
const DVWA_MEMORY_LIMIT_MB = Number(process.env.DVWA_MEMORY_LIMIT_MB ?? "512");
const DVWA_CPU_LIMIT = Number(process.env.DVWA_CPU_LIMIT ?? "0.5");

function containerName(userId: string): string {
  return `cybersim-dvwa-${safeContainerId(userId)}`;
}

function networkName(userId: string): string {
  return `cybersim-dvwa-net-${safeContainerId(userId)}`;
}

export interface DvwaStatus {
  running: boolean;
  url: string | null;
}

async function findContainer(name: string) {
  const containers = await docker.listContainers({ all: true, filters: JSON.stringify({ name: [name] }) });
  return containers.find((c) => c.Names.some((n) => n === `/${name}`)) ?? null;
}

export async function getDvwaStatus(userId: string): Promise<DvwaStatus> {
  const match = await findContainer(containerName(userId));
  if (!match || match.State !== "running") return { running: false, url: null };

  const port = match.Ports.find((p) => p.PrivatePort === 80 && p.PublicPort);
  if (!port) return { running: false, url: null };
  return { running: true, url: `http://localhost:${port.PublicPort}` };
}

// Each user gets DVWA on its own private bridge network (not the default
// bridge, and never shared between users), reachable only via a port bound
// to 127.0.0.1 on the host so it can't be reached from outside this machine.
// This is deliberately NOT NetworkMode:none like the generic CLI sandbox,
// since DVWA has to serve HTTP to the browser. Docker's `--internal` network
// flag would fully block outbound internet from the container too, but it
// was verified (empirically, not just in docs) to also break the published
// port, so it can't be used here without giving up browser access. Known
// tradeoff: this container CAN still reach the open internet outbound, even
// though it can't reach other users' containers or the host's other Docker
// networks. See README's Known gap section.
export async function startDvwaForUser(userId: string): Promise<DvwaStatus> {
  const existing = await getDvwaStatus(userId);
  if (existing.running) return existing;

  const netName = networkName(userId);
  const cName = containerName(userId);

  const existingContainer = await findContainer(cName);
  if (existingContainer) {
    await docker
      .getContainer(existingContainer.Id)
      .remove({ force: true })
      .catch(() => undefined);
  }

  const networks = await docker.listNetworks({ filters: JSON.stringify({ name: [netName] }) });
  if (networks.length === 0) {
    await docker.createNetwork({ Name: netName, Driver: "bridge", Internal: false });
  }

  const container = await docker.createContainer({
    Image: DVWA_IMAGE,
    name: cName,
    ExposedPorts: { "80/tcp": {} },
    HostConfig: {
      NetworkMode: netName,
      PortBindings: { "80/tcp": [{ HostIp: "127.0.0.1", HostPort: "" }] },
      CpuQuota: Math.floor(DVWA_CPU_LIMIT * 100000),
      CpuPeriod: 100000,
      Memory: DVWA_MEMORY_LIMIT_MB * 1024 * 1024,
      MemorySwap: DVWA_MEMORY_LIMIT_MB * 1024 * 1024,
      AutoRemove: false,
      SecurityOpt: ["no-new-privileges"],
    },
  });
  await container.start();

  const info = await container.inspect();
  const binding = info.NetworkSettings.Ports["80/tcp"]?.[0];
  const url = binding ? `http://localhost:${binding.HostPort}` : null;

  return { running: true, url };
}

export async function stopDvwaForUser(userId: string): Promise<DvwaStatus> {
  const match = await findContainer(containerName(userId));
  if (match) {
    const container = docker.getContainer(match.Id);
    await container.stop().catch(() => undefined);
    await container.remove().catch(() => undefined);
  }

  const netName = networkName(userId);
  const networks = await docker.listNetworks({ filters: JSON.stringify({ name: [netName] }) });
  for (const net of networks) {
    await docker
      .getNetwork(net.Id!)
      .remove()
      .catch(() => undefined);
  }

  return { running: false, url: null };
}
