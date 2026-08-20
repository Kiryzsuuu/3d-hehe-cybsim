import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@cybersim/types";
import { getRoomState, claimObjective, completeObjective, RoomError } from "../services/room/room.service.js";
import { createWsRateLimiter } from "./wsRateLimit.js";
import { publish, onMessage, INSTANCE_ID } from "../services/redis/pubsub.js";

interface RoomEvent {
  type: "state" | "error";
  state?: Awaited<ReturnType<typeof getRoomState>>;
  body?: string;
}

const STATE_CHANGED_CHANNEL = "room:state-changed";

const socketsByRoomCode = new Map<string, Set<any>>();

function register(code: string, socket: any) {
  if (!socketsByRoomCode.has(code)) socketsByRoomCode.set(code, new Set());
  socketsByRoomCode.get(code)!.add(socket);
}

function unregister(code: string, socket: any) {
  const set = socketsByRoomCode.get(code);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) socketsByRoomCode.delete(code);
}

async function sendStateToLocalSockets(code: string, userId: string) {
  const set = socketsByRoomCode.get(code);
  if (!set || set.size === 0) return;
  const state = await getRoomState(code, userId);
  const payload = JSON.stringify({ type: "state", state } satisfies RoomEvent);
  for (const socket of set) socket.send(payload);
}

// Pushes the latest state to this instance's own local sockets in the room
// (unchanged from before Redis), then tells every other instance a claim/
// complete happened in this room so their own local members refresh too —
// a room's members can be split across instances behind a load balancer.
async function broadcastState(code: string, userId: string) {
  await sendStateToLocalSockets(code, userId);
  void publish(STATE_CHANGED_CHANNEL, { code, actingUserId: userId });
}

let crossInstanceHandlerRegistered = false;

function registerCrossInstanceHandlerOnce() {
  if (crossInstanceHandlerRegistered) return;
  crossInstanceHandlerRegistered = true;

  onMessage<{ code: string; actingUserId: string }>(STATE_CHANGED_CHANNEL, ({ code, actingUserId }, fromInstanceId) => {
    if (fromInstanceId === INSTANCE_ID) return;
    // actingUserId is guaranteed a member (the origin instance's action only
    // succeeded because it passed assertMember), and getRoomState's output
    // doesn't vary per viewer, so it's safe to reuse for refreshing this
    // instance's own local sockets in the room.
    sendStateToLocalSockets(code, actingUserId).catch((err) => console.error("[room.ws] relay refresh failed:", err));
  }).catch((err) => console.error("[room.ws] subscribe failed:", err));
}

export async function roomWebSocket(app: FastifyInstance) {
  registerCrossInstanceHandlerOnce();

  app.get("/ws/room", { websocket: true }, (socket, req) => {
    const token = (req.query as { token?: string })?.token;
    const code = ((req.query as { code?: string })?.code ?? "").toUpperCase();
    let payload: JwtPayload;
    try {
      if (!token || !code) throw new Error("missing token or code");
      payload = app.jwt.verify(token);
    } catch {
      socket.send(JSON.stringify({ type: "error", body: "Unauthorized" } satisfies RoomEvent));
      socket.close();
      return;
    }
    const userId = payload.sub;
    const allowAction = createWsRateLimiter(10, 5000);

    // getRoomState enforces membership (assertMember) internally, so it
    // doubles as the access check here. The socket must only be added to
    // socketsByRoomCode — and therefore only start receiving broadcastState
    // pushes — once that check has actually passed; registering first and
    // checking after (the previous bug) let anyone who knew a room code stay
    // subscribed to that room's full state even after the membership check
    // failed, since nothing ever unregistered them.
    getRoomState(code, userId)
      .then((state) => {
        register(code, socket);
        socket.send(JSON.stringify({ type: "state", state } satisfies RoomEvent));
      })
      .catch((err) => {
        socket.send(JSON.stringify({ type: "error", body: err.message } satisfies RoomEvent));
        socket.close();
      });

    socket.on("message", async (raw: Buffer) => {
      let message: unknown;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!allowAction()) return;
      const { action, objectiveId } = (message as { action?: string; objectiveId?: string }) ?? {};
      if (typeof objectiveId !== "string") return;

      try {
        if (action === "claim") await claimObjective(code, userId, objectiveId);
        else if (action === "complete") await completeObjective(code, userId, objectiveId);
        else return;
        await broadcastState(code, userId);
      } catch (err) {
        socket.send(
          JSON.stringify({ type: "error", body: err instanceof RoomError ? err.message : "Failed" } satisfies RoomEvent)
        );
      }
    });

    socket.on("close", () => unregister(code, socket));
  });
}
