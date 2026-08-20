"use client";

import { useEffect, useRef, useState } from "react";

// FPV rooms use PointerLockControls for mouselook, which has no touch
// equivalent (there's no way to "lock" a touchscreen pointer the way a
// mouse can be captured), so those stay desktop-only — a real platform
// constraint, not something a virtual joystick can paper over. The World
// hub's camera is a fixed top-down follow-cam with no free-look, though, so
// movement alone is enough to make it fully playable on a touchscreen.
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);
  return isTouch;
}

const DEADZONE = 0.25;
const STICK_RADIUS = 42;

// Drives the exact same keysRef["w"/"a"/"s"/"d"] flags the keyboard handler
// sets, so Player's movement code in WorldExplorer.tsx needs no touch-aware
// branch at all — a diagonal drag naturally sets two flags at once, which
// Player already normalizes correctly since keyboard diagonals (e.g. W+D)
// do the same thing.
export function TouchJoystick({ keysRef }: { keysRef: React.MutableRefObject<Record<string, boolean>> }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const clearDirections = () => {
    keysRef.current["w"] = false;
    keysRef.current["a"] = false;
    keysRef.current["s"] = false;
    keysRef.current["d"] = false;
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, STICK_RADIUS);
    if (dist > 0) {
      dx = (dx / dist) * clamped;
      dy = (dy / dist) * clamped;
    }
    setStickOffset({ x: dx, y: dy });

    const nx = dx / STICK_RADIUS;
    const ny = dy / STICK_RADIUS;
    clearDirections();
    if (Math.hypot(nx, ny) < DEADZONE) return;
    if (ny < -DEADZONE) keysRef.current["w"] = true;
    if (ny > DEADZONE) keysRef.current["s"] = true;
    if (nx < -DEADZONE) keysRef.current["a"] = true;
    if (nx > DEADZONE) keysRef.current["d"] = true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    activePointerId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const endTouch = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setStickOffset({ x: 0, y: 0 });
    clearDirections();
  };

  useEffect(() => clearDirections, []);

  return (
    <div
      ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endTouch}
      onPointerCancel={endTouch}
      className="absolute bottom-6 left-6 h-28 w-28 touch-none rounded-full border border-gray-600 bg-black/40"
      style={{ zIndex: 20 }}
    >
      <div
        className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/70"
        style={{ left: `calc(50% + ${stickOffset.x}px)`, top: `calc(50% + ${stickOffset.y}px)` }}
      />
    </div>
  );
}

// Compact action buttons for E (interact), T (chat), and the four emotes,
// mirroring the keyboard shortcuts already documented in the hint text.
export function TouchActionButtons({
  onInteract,
  interactLabel,
  onChat,
  onEmote,
  emotes,
}: {
  onInteract?: () => void;
  interactLabel?: string;
  onChat: () => void;
  onEmote: (emoji: string) => void;
  emotes: string[];
}) {
  return (
    <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
      <div className="flex gap-1.5">
        {emotes.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onEmote(emoji)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-600 bg-black/60 text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onChat}
          className="rounded-full border border-gray-600 bg-black/60 px-4 py-2 text-sm text-gray-200"
        >
          💬 Chat
        </button>
        {onInteract && (
          <button
            onClick={onInteract}
            className="rounded-full border border-accent bg-accent/80 px-4 py-2 text-sm font-medium text-black"
          >
            {interactLabel ?? "Masuk"}
          </button>
        )}
      </div>
    </div>
  );
}
