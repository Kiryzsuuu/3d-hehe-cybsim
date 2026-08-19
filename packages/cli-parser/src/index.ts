import { terminalCommandSchema, type TerminalCommandInput } from "@cybersim/types";

export interface CommandContext {
  username: string;
}

export type CommandHandler = (args: string[], ctx: CommandContext) => string;

// Every entry here corresponds 1:1 to the whitelist enum in terminalCommandSchema.
// No handler ever shells out — each returns a plain string, so there is no
// injection surface regardless of what the client sends as `args`.
const handlers: Record<TerminalCommandInput["command"], CommandHandler> = {
  help: () =>
    ["Available commands:", "help, ls, ping <host>, whoami, clear, show <target>, ifconfig, connect <host>"].join(
      "\n"
    ),
  ls: () => "topology.yaml  scenarios/  README.md",
  ping: (args) => {
    const host = args[0] ?? "127.0.0.1";
    return `PING ${host}: 4 packets transmitted, 4 received, 0% packet loss`;
  },
  whoami: (_args, ctx) => ctx.username,
  clear: () => "\x1b[2J\x1b[H",
  show: (args) => `show ${args[0] ?? "running-config"}: (simulated output)`,
  ifconfig: () => "eth0: flags=UP mtu 1500  inet 10.0.0.2  netmask 255.255.255.0",
  connect: (args) => `Connecting to ${args[0] ?? "unknown-host"}... simulated connection established.`,
};

export function parseAndRun(raw: unknown, ctx: CommandContext): string {
  const parsed = terminalCommandSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Command rejected: not on whitelist or invalid arguments");
  }
  const handler = handlers[parsed.data.command];
  return handler(parsed.data.args, ctx);
}
