const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
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
  const token = typeof window !== "undefined" ? localStorage.getItem("cybersim_token") : null;
  return request<ReachabilityResult>("/api/network/reachability", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ nodes, edges, source, target }),
  });
}
