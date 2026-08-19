import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: UserRole;
}
