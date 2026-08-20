import { docker } from "./docker-client.js";

const MAX_AGE_HOURS = Number(process.env.SANDBOX_MAX_AGE_HOURS ?? "4");
const SWEEP_INTERVAL_MS = Number(process.env.SANDBOX_REAP_INTERVAL_MS ?? String(15 * 60 * 1000));
const NAME_PREFIXES = ["cybersim-sandbox-", "cybersim-dvwa-"];

// Sandbox and DVWA containers are meant to be short training sessions, but
// nothing stops a user from starting one and closing the tab (or the app
// crashing) without ever hitting /stop — the container just runs forever,
// eating the resource limits set aside for it. This periodic sweep removes
// any cybersim-owned container older than MAX_AGE_HOURS regardless of
// state, plus any now-orphaned per-user DVWA network, so an abandoned
// session doesn't accumulate indefinitely on the host.
export async function reapStaleContainers(): Promise<{ removed: string[]; errors: string[] }> {
  const removed: string[] = [];
  const errors: string[] = [];
  const cutoffSeconds = Date.now() / 1000 - MAX_AGE_HOURS * 3600;

  const containers = await docker.listContainers({ all: true });
  for (const c of containers) {
    const name = c.Names.find((n) => NAME_PREFIXES.some((p) => n.startsWith(`/${p}`)));
    if (!name) continue;
    if (c.Created > cutoffSeconds) continue;

    try {
      const container = docker.getContainer(c.Id);
      await container.stop().catch(() => undefined);
      await container.remove().catch(() => undefined);
      removed.push(name ?? c.Id);
    } catch (err) {
      errors.push(`${c.Id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Orphaned per-user DVWA bridge networks left behind once their container
  // is gone (crash, or removed by this same sweep above).
  const networks = await docker.listNetworks({ filters: JSON.stringify({ name: ["cybersim-dvwa-net-"] }) });
  for (const net of networks) {
    if (!net.Name?.startsWith("cybersim-dvwa-net-")) continue;
    try {
      const inUse = await docker
        .getNetwork(net.Id!)
        .inspect()
        .then((info) => Object.keys(info.Containers ?? {}).length > 0);
      if (!inUse) {
        await docker.getNetwork(net.Id!).remove();
        removed.push(net.Name);
      }
    } catch (err) {
      errors.push(`network ${net.Name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { removed, errors };
}

export function startSandboxReaper(): NodeJS.Timeout {
  const sweep = () => {
    reapStaleContainers()
      .then(({ removed, errors }) => {
        if (removed.length > 0) console.log(`[sandbox-reaper] removed ${removed.length} stale resource(s):`, removed);
        if (errors.length > 0) console.error(`[sandbox-reaper] ${errors.length} error(s):`, errors);
      })
      .catch((err) => console.error("[sandbox-reaper] sweep failed:", err));
  };
  sweep();
  return setInterval(sweep, SWEEP_INTERVAL_MS);
}
