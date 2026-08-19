"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { useTerminalSocket } from "@/hooks/useTerminalSocket";
import { terminalCommandSchema, type TerminalCommandInput } from "@cybersim/types";

const KNOWN_COMMANDS = terminalCommandSchema.shape.command.options;

function toCommandInput(command: string, args: string[]): TerminalCommandInput | null {
  const match = KNOWN_COMMANDS.find((c) => c === command);
  return match ? { command: match, args } : null;
}

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const lineBufferRef = useRef("");

  const { send, connected } = useTerminalSocket((event) => {
    xtermRef.current?.write(event.type === "error" ? `\r\n\x1b[31m${event.data}\x1b[0m\r\n` : `\r\n${event.data}\r\n`);
    prompt();
  });

  function prompt() {
    xtermRef.current?.write("\r\n$ ");
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      theme: { background: "#0a0e14", foreground: "#e6e6e6" },
      fontSize: 14,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);

    // xterm's renderer isn't attached until after the browser commits this
    // layout — calling fit() synchronously here throws "reading 'dimensions'"
    // (most visible under React StrictMode's mount/unmount/remount in dev).
    const safeFit = () => {
      try {
        fitAddon.fit();
      } catch {
        // renderer not ready yet or terminal already disposed — ignore
      }
    };
    requestAnimationFrame(safeFit);

    term.writeln("CyberSim Terminal — type 'help' for commands");
    prompt();

    term.onData((data) => {
      if (data === "\r") {
        const line = lineBufferRef.current.trim();
        lineBufferRef.current = "";
        if (line.length > 0) {
          const [command, ...args] = line.split(/\s+/);
          const input = toCommandInput(command, args);
          if (input) {
            send(input);
          } else {
            term.write(`\r\n\x1b[31mUnknown command: ${command}\x1b[0m\r\n`);
            prompt();
          }
        } else {
          prompt();
        }
      } else if (data === "") {
        if (lineBufferRef.current.length > 0) {
          lineBufferRef.current = lineBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else {
        lineBufferRef.current += data;
        term.write(data);
      }
    });

    xtermRef.current = term;

    window.addEventListener("resize", safeFit);

    return () => {
      window.removeEventListener("resize", safeFit);
      term.dispose();
    };
  }, []);

  return (
    <div className="rounded-lg border border-gray-800 bg-black p-2">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
        {connected ? "connected" : "disconnected"}
      </div>
      <div ref={containerRef} className="h-96 w-full" />
    </div>
  );
}
