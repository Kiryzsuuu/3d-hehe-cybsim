// HTTP routes get rate limiting for free from @fastify/rate-limit (see
// index.ts), but that plugin only ever sees the single upgrade request for a
// WebSocket connection — every message sent afterward over the same socket
// bypasses it entirely. CLAUDE.md requires rate limiting on every endpoint,
// so each ws handler's message callback needs its own guard; this is a
// minimal per-connection sliding-window counter for that purpose.
export function createWsRateLimiter(maxPerWindow: number, windowMs: number) {
  let count = 0;
  let windowStart = Date.now();

  return function allow(): boolean {
    const now = Date.now();
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= maxPerWindow;
  };
}
