import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";

// node-redis (and Redis pub/sub in general) requires a dedicated connection
// for SUBSCRIBE — a client that's subscribed can't also issue normal
// commands like PUBLISH — so this needs two separate clients, not one.
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Uniquely identifies this server process so a subscriber can recognize and
// skip messages it published itself (each instance also always receives its
// own publishes back, since it's a separate connection subscribed to the
// same channel like everyone else).
export const INSTANCE_ID = randomUUID();

let publisher: RedisClientType | null = null;
let subscriber: RedisClientType | null = null;
let connectPromise: Promise<void> | null = null;

async function ensureConnected(): Promise<void> {
  if (connectPromise) return connectPromise;
  connectPromise = (async () => {
    publisher = createClient({ url: REDIS_URL });
    subscriber = createClient({ url: REDIS_URL });
    publisher.on("error", (err) => console.error("[redis-pubsub] publisher error:", err.message));
    subscriber.on("error", (err) => console.error("[redis-pubsub] subscriber error:", err.message));
    await Promise.all([publisher.connect(), subscriber.connect()]);
  })();
  return connectPromise;
}

export interface CrossInstanceMessage<T> {
  instanceId: string;
  payload: T;
}

// Broadcasts `payload` to every server instance subscribed to `channel`
// (including this one — see onMessage). Fire-and-forget: presence/chat
// fanout is best-effort real-time state, not something worth blocking a
// request on or retrying if Redis hiccups.
export async function publish<T>(channel: string, payload: T): Promise<void> {
  try {
    await ensureConnected();
    const message: CrossInstanceMessage<T> = { instanceId: INSTANCE_ID, payload };
    await publisher!.publish(channel, JSON.stringify(message));
  } catch (err) {
    console.error(`[redis-pubsub] publish to ${channel} failed:`, err instanceof Error ? err.message : err);
  }
}

const handlersByChannel = new Map<string, Set<(payload: unknown, fromInstanceId: string) => void>>();

// Registers `handler` to run for every message on `channel`, including this
// instance's own publishes — callers that only care about OTHER instances
// (because they already handle the local-origin case directly) should
// filter on their own known local state, not on instanceId equality, since
// a single-instance deployment must keep working identically with Redis
// entirely absent or down.
export async function onMessage<T>(channel: string, handler: (payload: T, fromInstanceId: string) => void): Promise<void> {
  await ensureConnected();
  if (!handlersByChannel.has(channel)) {
    handlersByChannel.set(channel, new Set());
    await subscriber!.subscribe(channel, (raw) => {
      let parsed: CrossInstanceMessage<unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      for (const h of handlersByChannel.get(channel) ?? []) {
        h(parsed.payload, parsed.instanceId);
      }
    });
  }
  handlersByChannel.get(channel)!.add(handler as (payload: unknown, fromInstanceId: string) => void);
}
