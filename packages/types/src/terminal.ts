import { z } from "zod";

// Whitelisted commands only — anything not in this union is rejected server-side.
export const terminalCommandSchema = z.object({
  command: z.enum(["help", "ls", "ping", "whoami", "clear", "show", "ifconfig", "connect"]),
  args: z.array(z.string().max(64)).max(8).default([]),
});
export type TerminalCommandInput = z.infer<typeof terminalCommandSchema>;

export interface TerminalOutputEvent {
  type: "output" | "error";
  data: string;
}

export interface TerminalClientEvent {
  type: "command";
  payload: TerminalCommandInput;
}
