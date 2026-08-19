import { randomInt } from "node:crypto";
import { prisma } from "../../db/client.js";

export class RoomError extends Error {}

interface ScenarioObjectiveData {
  objectives?: { id: string; description: string; points: number }[];
}

async function generateUniqueCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 to avoid ambiguity
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
    const existing = await prisma.room.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new RoomError("Could not generate a unique room code, try again");
}

export async function createRoom(hostId: string, scenarioSlug: string) {
  const scenario = await prisma.scenario.findUnique({ where: { slug: scenarioSlug } });
  if (!scenario) throw new RoomError("Scenario not found");

  const code = await generateUniqueCode();
  const room = await prisma.room.create({
    data: {
      code,
      scenarioId: scenario.id,
      hostId,
      members: { create: [{ userId: hostId }] },
    },
  });
  return room;
}

export async function joinRoom(userId: string, code: string) {
  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) throw new RoomError("Room not found");
  if (room.status === "completed") throw new RoomError("Room already completed");

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    update: {},
    create: { roomId: room.id, userId },
  });
  return room;
}

async function assertMember(roomId: string, userId: string) {
  const membership = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
  if (!membership) throw new RoomError("Not a member of this room");
}

export async function getRoomState(code: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) throw new RoomError("Room not found");
  await assertMember(room.id, userId);

  const [scenario, members] = await Promise.all([
    prisma.scenario.findUnique({ where: { id: room.scenarioId } }),
    prisma.roomMember.findMany({ where: { roomId: room.id }, include: { user: { select: { username: true } } } }),
  ]);
  if (!scenario) throw new RoomError("Scenario not found");

  const objectives = (scenario.data as ScenarioObjectiveData)?.objectives ?? [];

  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    scenario: { slug: scenario.slug, title: scenario.title, objectives },
    claims: room.claims as Record<string, string>,
    completedObjectives: room.completedObjectives as Record<string, boolean>,
    members: members.map((m) => ({ userId: m.userId, username: m.user.username })),
  };
}

export async function claimObjective(code: string, userId: string, objectiveId: string) {
  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) throw new RoomError("Room not found");
  await assertMember(room.id, userId);

  const claims = { ...(room.claims as Record<string, string>) };
  const completed = room.completedObjectives as Record<string, boolean>;
  if (completed[objectiveId]) throw new RoomError("Objective already completed");

  if (claims[objectiveId] === userId) {
    delete claims[objectiveId]; // toggle off: unclaim
  } else if (claims[objectiveId] && claims[objectiveId] !== userId) {
    throw new RoomError("Objective already claimed by another player");
  } else {
    claims[objectiveId] = userId;
  }

  await prisma.room.update({ where: { id: room.id }, data: { claims } });
  return claims;
}

export async function completeObjective(code: string, userId: string, objectiveId: string) {
  const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) throw new RoomError("Room not found");
  await assertMember(room.id, userId);

  const claims = room.claims as Record<string, string>;
  if (claims[objectiveId] !== userId) throw new RoomError("You must claim this objective before completing it");

  const scenario = await prisma.scenario.findUnique({ where: { id: room.scenarioId } });
  const objectives = (scenario?.data as ScenarioObjectiveData)?.objectives ?? [];
  const objective = objectives.find((o) => o.id === objectiveId);
  if (!objective) throw new RoomError("Objective not found");

  const completed = { ...(room.completedObjectives as Record<string, boolean>), [objectiveId]: true };

  // Award this member their own Progress score for the objective they did.
  const existingProgress = await prisma.progress.findUnique({
    where: { userId_scenarioId: { userId, scenarioId: room.scenarioId } },
  });
  await prisma.progress.upsert({
    where: { userId_scenarioId: { userId, scenarioId: room.scenarioId } },
    update: { score: (existingProgress?.score ?? 0) + objective.points },
    create: { userId, scenarioId: room.scenarioId, status: "in_progress", score: objective.points },
  });

  const allDone = objectives.every((o) => completed[o.id]);
  await prisma.room.update({
    where: { id: room.id },
    data: { completedObjectives: completed, status: allDone ? "completed" : room.status },
  });

  if (allDone) {
    const members = await prisma.roomMember.findMany({ where: { roomId: room.id } });
    await Promise.all(
      members.map((m) =>
        prisma.progress.updateMany({
          where: { userId: m.userId, scenarioId: room.scenarioId },
          data: { status: "completed", completedAt: new Date() },
        })
      )
    );
  }

  return { completed, allDone };
}
