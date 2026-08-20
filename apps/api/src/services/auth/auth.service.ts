import bcrypt from "bcrypt";
import type { RegisterInput, LoginInput, AuthUser, UserRole } from "@cybersim/types";
import { prisma } from "../../db/client.js";

const SALT_ROUNDS = 12;

export class AuthError extends Error {}

// The shared AuthUser type (packages/types) intentionally doesn't carry
// hasSeenTutorial — it's a frontend-only onboarding concern, not part of
// the JWT payload contract — so it's added here as a local extension of the
// shape actually sent back to the client, same pattern as avatarColor on
// the profile endpoint.
type AuthUserWithTutorial = AuthUser & { hasSeenTutorial: boolean };

export async function registerUser(input: RegisterInput): Promise<AuthUserWithTutorial> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });
  if (existing) throw new AuthError("Email or username already in use");

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: input.email, username: input.username, passwordHash },
  });
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role as UserRole,
    hasSeenTutorial: user.hasSeenTutorial,
  };
}

export async function verifyUser(input: LoginInput): Promise<AuthUserWithTutorial> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AuthError("Invalid credentials");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AuthError("Invalid credentials");

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role as UserRole,
    hasSeenTutorial: user.hasSeenTutorial,
  };
}
