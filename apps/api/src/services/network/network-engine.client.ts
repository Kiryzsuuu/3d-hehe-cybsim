const NETWORK_ENGINE_URL = process.env.NETWORK_ENGINE_URL ?? "http://localhost:8000";
const NETWORK_ENGINE_SECRET = process.env.NETWORK_ENGINE_SECRET;

export interface ReachabilityResult {
  reachable: boolean;
  path: string[];
}

interface MinimalTopology {
  nodes: { id: string; type: string }[];
  edges: { source: string; target: string }[];
}

export async function checkReachability(
  topology: MinimalTopology,
  source: string,
  target: string
): Promise<ReachabilityResult> {
  if (!NETWORK_ENGINE_SECRET) throw new Error("NETWORK_ENGINE_SECRET is not configured");

  const url = new URL("/simulate/reachability", NETWORK_ENGINE_URL);
  url.searchParams.set("source", source);
  url.searchParams.set("target", target);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": NETWORK_ENGINE_SECRET,
    },
    body: JSON.stringify({
      nodes: topology.nodes.map((n) => ({ id: n.id, type: n.type })),
      edges: topology.edges.map((e) => ({ source: e.source, target: e.target })),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`network-engine request failed (${res.status}): ${body}`);
  }

  return (await res.json()) as ReachabilityResult;
}
