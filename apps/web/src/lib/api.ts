const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
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
  data: { objectives: ScenarioObjective[]; hints: string[]; hasFlag: boolean };
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

export function completeScenario(slug: string, score: number) {
  return request<{ progress: ProgressEntry }>(`/api/scenarios/${slug}/complete`, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ score }),
  });
}

export interface SubmitFlagResult {
  correct: boolean;
  alreadyCaptured: boolean;
  pointsAwarded: number;
}

export function submitFlag(slug: string, flag: string) {
  return request<SubmitFlagResult>(`/api/scenarios/${slug}/submit-flag`, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ flag }),
  });
}

export interface LeaderboardEntry {
  username: string;
  totalScore: number;
}

export function getLeaderboard() {
  return request<{ leaderboard: LeaderboardEntry[] }>("/api/leaderboard");
}

export interface SandboxStatus {
  running: boolean;
  containerId: string | null;
  name: string;
}

export function getSandboxStatus() {
  return request<SandboxStatus>("/api/sandbox", { headers: authHeader() });
}

export function startSandbox() {
  return request<SandboxStatus>("/api/sandbox/start", { method: "POST", headers: authHeader() });
}

export function stopSandbox() {
  return request<SandboxStatus>("/api/sandbox/stop", { method: "POST", headers: authHeader() });
}

export interface DvwaStatus {
  running: boolean;
  url: string | null;
}

export function getDvwaStatus() {
  return request<DvwaStatus>("/api/sandbox/dvwa", { headers: authHeader() });
}

export function startDvwa() {
  return request<DvwaStatus>("/api/sandbox/dvwa/start", { method: "POST", headers: authHeader() });
}

export function stopDvwa() {
  return request<DvwaStatus>("/api/sandbox/dvwa/stop", { method: "POST", headers: authHeader() });
}

// --- Profile ---

export interface ProfileStats {
  totalScore: number;
  scenariosCompleted: number;
  scenariosInProgress: number;
  flagsCaptured: number;
  rank: number | null;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string;
  target: number;
  metric: "totalScore" | "scenariosCompleted" | "flagsCaptured" | "rank";
  unlocked: boolean;
  progress: number;
}

export interface ProfileResponse {
  user: { id: string; email: string; username: string; role: "user" | "admin"; avatarColor: string; createdAt: string };
  stats: ProfileStats;
  history: ProgressEntry[];
  achievements: Achievement[];
}

export function getProfile() {
  return request<ProfileResponse>("/api/profile", { headers: authHeader() });
}

export function getAvatarColors() {
  return request<{ colors: string[] }>("/api/profile/avatar-colors");
}

export function setAvatarColor(color: string) {
  return request<{ user: { id: string; avatarColor: string } }>("/api/profile/avatar", {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ color }),
  });
}

// --- Admin ---

export interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
  createdAt: string;
  totalScore: number;
  scenariosCompleted: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalScenarios: number;
  totalCompletions: number;
  totalMessages: number;
}

export function getAdminUsers() {
  return request<{ users: AdminUserRow[] }>("/api/admin/users", { headers: authHeader() });
}

export function getAdminStats() {
  return request<{ stats: PlatformStats }>("/api/admin/stats", { headers: authHeader() });
}

export function setUserRole(userId: string, role: "user" | "admin") {
  return request<{ user: { id: string; username: string; role: string } }>(`/api/admin/users/${userId}/role`, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ role }),
  });
}

// --- Chat ---

export interface ConversationSummary {
  id: string;
  type: "world" | "direct" | "group";
  name: string | null;
  lastMessage: { body: string; senderUsername: string; createdAt: string } | null;
}

export interface ChatMessage {
  id: string;
  body: string;
  senderUsername: string;
  createdAt: string;
}

export interface PendingInvite {
  conversationId: string;
  groupName: string;
}

export function listConversations() {
  return request<{ conversations: ConversationSummary[] }>("/api/chat/conversations", { headers: authHeader() });
}

export function getMessages(conversationId: string) {
  return request<{ messages: ChatMessage[] }>(`/api/chat/conversations/${conversationId}/messages`, {
    headers: authHeader(),
  });
}

export function startDirectConversation(username: string) {
  return request<{ conversationId: string }>("/api/chat/conversations/direct", {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ username }),
  });
}

export function createGroup(name: string) {
  return request<{ conversationId: string }>("/api/chat/conversations/group", {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ name }),
  });
}

export function inviteToGroup(conversationId: string, username: string) {
  return request<{ invited: boolean }>(`/api/chat/conversations/${conversationId}/invite`, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ username }),
  });
}

export function listInvites() {
  return request<{ invites: PendingInvite[] }>("/api/chat/invites", { headers: authHeader() });
}

export function acceptInvite(conversationId: string) {
  return request<{ accepted: boolean }>(`/api/chat/invites/${conversationId}/accept`, {
    method: "POST",
    headers: authHeader(),
  });
}

export function getWorldConversationId() {
  return request<{ worldId: string }>("/api/chat/world-id");
}

// --- Rooms (multiplayer co-op) ---

export interface RoomState {
  code: string;
  status: "open" | "completed";
  hostId: string;
  scenario: { slug: string; title: string; objectives: ScenarioObjective[] };
  claims: Record<string, string>;
  completedObjectives: Record<string, boolean>;
  members: { userId: string; username: string }[];
}

export function createRoom(scenarioSlug: string) {
  return request<{ code: string }>("/api/rooms", {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ scenarioSlug }),
  });
}

export function joinRoom(code: string) {
  return request<{ joined: boolean }>(`/api/rooms/${code}/join`, { method: "POST", headers: authHeader() });
}

export function getRoomState(code: string) {
  return request<{ state: RoomState }>(`/api/rooms/${code}`, { headers: authHeader() });
}
