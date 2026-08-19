const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body as T;
}

export function login(email: string, password: string) {
  return request<{ user: AuthUser; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, username: string, password: string) {
  return request<{ user: AuthUser; token: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
}

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("cybersim_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ReachabilityResult {
  reachable: boolean;
  path: string[];
}

export function checkReachability(
  nodes: { id: string; type: string }[],
  edges: { source: string; target: string }[],
  source: string,
  target: string
) {
  return request<ReachabilityResult>("/api/network/reachability", {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ nodes, edges, source, target }),
  });
}

export interface ScenarioSummary {
  id: string;
  slug: string;
  title: string;
  level: string;
  description: string;
}

export interface ScenarioObjective {
  id: string;
  description: string;
  points: number;
}

export interface ScenarioDetail extends ScenarioSummary {
  data: { objectives: ScenarioObjective[]; hints: string[] };
}

export interface ProgressEntry {
  id: string;
  scenarioId: string;
  status: string;
  score: number;
  completedAt: string | null;
  updatedAt: string;
  scenario: { slug: string; title: string; level: string };
}

export function listScenarios() {
  return request<{ scenarios: ScenarioSummary[] }>("/api/scenarios");
}

export function getScenario(slug: string) {
  return request<{ scenario: ScenarioDetail }>(`/api/scenarios/${slug}`);
}

export function listProgress() {
  return request<{ progress: ProgressEntry[] }>("/api/progress", { headers: authHeader() });
}

export function startScenario(slug: string) {
  return request<{ progress: ProgressEntry }>(`/api/scenarios/${slug}/start`, {
    method: "POST",
    headers: authHeader(),
  });
}
