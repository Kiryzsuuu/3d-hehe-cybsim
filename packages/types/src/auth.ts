import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
}
