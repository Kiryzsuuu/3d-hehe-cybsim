"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { EMOTES, type OtherPlayer, type EmoteState } from "@/hooks/usePresenceSocket";

const MOVE_SPEED = 6;

// Fades a room in on mount instead of popping in fully rendered, matching
// the same fade WorldExplorer does so entering/leaving a room reads as one
// continuous transition rather than a hard cut between pages.
export function useFadeIn() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return ready;
}

// Always-visible pill back to the World hub, fading the room out briefly
// (via onBeforeLeave, which the room wires to its own fade state) before the
// navigation fires so leaving a room feels the same as entering one.
export function FpvBackLink({ onBeforeLeave }: { onBeforeLeave?: () => void }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        onBeforeLeave?.();
        setTimeout(() => router.push("/world"), 200);
      }}
      className="absolute right-4 top-4 rounded-md border border-gray-700 bg-black/60 px-3 py-1.5 text-xs text-gray-300 transition-opacity hover:border-accent hover:text-accent"
    >
      ← Kembali ke World
    </button>
  );
}

export function useFpvKeys() {
  const keysRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => (keysRef.current[e.key.toLowerCase()] = true);
    const onKeyUp = (e: KeyboardEvent) => (keysRef.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
  return keysRef;
}

// Walks the default camera around the XZ plane relative to look direction,
// clamped to a square room. Call once inside a Canvas alongside
// <PointerLockControls>, which owns rotation; this only owns position.
export function FpvRig({
  keysRef,
  lookAt,
  bounds = 9,
}: {
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  lookAt: [number, number, number];
  bounds?: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 1.6, 0);
    camera.lookAt(...lookAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

    const move = new THREE.Vector3();
    if (keys["w"] || keys["arrowup"]) move.add(forward);
    if (keys["s"] || keys["arrowdown"]) move.sub(forward);
    if (keys["d"] || keys["arrowright"]) move.add(right);
    if (keys["a"] || keys["arrowleft"]) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(MOVE_SPEED * delta);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x + move.x, -bounds, bounds);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + move.z, -bounds, bounds);
    }
    camera.position.y = 1.6;
  });

  return null;
}

export function FpvRoom({ wallColor = "#1f2937", floorColor = "#111827" }: { wallColor?: string; floorColor?: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      <mesh position={[0, 3, -10]}>
        <boxGeometry args={[20, 6, 0.3]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[0, 3, 10]}>
        <boxGeometry args={[20, 6, 0.3]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[-10, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 6, 0.3]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
      <mesh position={[10, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 6, 0.3]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
    </group>
  );
}

// Raycasts from screen center (the crosshair) against a live map of target
// meshes on every click while pointer-locked. maxDistance must comfortably
// exceed the real distance from spawn to the farthest target, or every click
// silently "misses" regardless of aim (see NetworkRoom's history for why).
export function useFpvInteraction({
  locked,
  cameraRef,
  targetsRef,
  onHit,
  maxDistance = 15,
  pollMs = 100,
}: {
  locked: boolean;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
  targetsRef: React.MutableRefObject<Record<string, THREE.Object3D | null>>;
  onHit: (id: string) => void;
  maxDistance?: number;
  pollMs?: number;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!locked) return;
    const raycaster = new THREE.Raycaster();
    const onClick = () => {
      const camera = cameraRef.current;
      if (!camera) return;
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera as THREE.PerspectiveCamera);
      const entries = Object.entries(targetsRef.current).filter(([, m]) => !!m) as [string, THREE.Object3D][];
      const intersects = raycaster.intersectObjects(
        entries.map(([, m]) => m),
        false
      );
      if (intersects.length === 0 || intersects[0].distance > maxDistance) return;
      const hitId = entries.find(([, m]) => m === intersects[0].object)?.[0];
      if (hitId) onHit(hitId);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [locked, cameraRef, targetsRef, onHit, maxDistance]);

  useEffect(() => {
    if (!locked) return;
    const raycaster = new THREE.Raycaster();
    const interval = setInterval(() => {
      const camera = cameraRef.current;
      if (!camera) return;
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera as THREE.PerspectiveCamera);
      const entries = Object.entries(targetsRef.current).filter(([, m]) => !!m) as [string, THREE.Object3D][];
      const intersects = raycaster.intersectObjects(
        entries.map(([, m]) => m),
        false
      );
      if (intersects.length > 0 && intersects[0].distance <= maxDistance) {
        setHoveredId(entries.find(([, m]) => m === intersects[0].object)?.[0] ?? null);
      } else {
        setHoveredId(null);
      }
    }, pollMs);
    return () => clearInterval(interval);
  }, [locked, cameraRef, targetsRef, maxDistance, pollMs]);

  return { hoveredId };
}

// Reports this camera's XZ position into the room's presence channel every
// frame (throttled inside reportPosition itself), so other players in the
// same FPV room see this player move. Call once inside the Canvas.
export function FpvPresenceReporter({ reportPosition }: { reportPosition: (x: number, z: number) => void }) {
  const { camera } = useThree();
  useFrame(() => {
    reportPosition(camera.position.x, camera.position.z);
  });
  return null;
}

// Bounces a large emoji above the player for ~1.8s, restarting the bounce
// whenever `emoteKey` changes (even for a repeated emoji) since it remounts
// the elapsed-time clock the animation reads from.
export function EmoteBubble({ x, z, emoji, emoteKey, y = 2.6 }: { x: number; z: number; emoji: string; emoteKey: number; y?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textRef = useRef<any>(null);
  const startRef = useRef(0);
  useEffect(() => {
    startRef.current = performance.now();
  }, [emoteKey]);
  useFrame(() => {
    if (!textRef.current) return;
    const t = (performance.now() - startRef.current) / 1000;
    textRef.current.position.y = y + Math.abs(Math.sin(t * 6)) * 0.25;
  });
  return (
    <Text ref={textRef} position={[x, y, z]} fontSize={0.5} anchorX="center">
      {emoji}
    </Text>
  );
}

// Renders other players physically inside this FPV room as capsules with a
// floating username label, lerped toward their latest reported position
// since updates only arrive ~every 150ms over the socket. When a chat bubble
// is active for this player it's shown above the username instead of a
// separate UI panel, like a speech bubble in a physical space.
function OtherFpvPlayer({ player, bubble, emote }: { player: OtherPlayer; bubble?: string; emote?: EmoteState }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, player.x, Math.min(1, delta * 8));
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, player.z, Math.min(1, delta * 8));
  });

  return (
    <group>
      <mesh ref={meshRef} position={[player.x, 0.9, player.z]}>
        <capsuleGeometry args={[0.35, 1, 4, 8]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
      <Text position={[player.x, 1.9, player.z]} fontSize={0.3} color={player.color} anchorX="center">
        {player.username}
      </Text>
      {bubble && (
        <Text
          position={[player.x, 2.35, player.z]}
          fontSize={0.24}
          color="#f8fafc"
          maxWidth={2.5}
          textAlign="center"
          anchorX="center"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {bubble}
        </Text>
      )}
      {emote && <EmoteBubble x={player.x} z={player.z} emoji={emote.emoji} emoteKey={emote.key} />}
    </group>
  );
}

export function FpvOtherPlayers({
  players,
  chatBubbles,
  emotes,
}: {
  players: OtherPlayer[];
  chatBubbles?: Record<string, string>;
  emotes?: Record<string, EmoteState>;
}) {
  return (
    <>
      {players.map((p) => (
        <OtherFpvPlayer key={p.userId} player={p} bubble={chatBubbles?.[p.userId]} emote={emotes?.[p.userId]} />
      ))}
    </>
  );
}

// Number keys 1-4 fire one of the fixed emote emojis while pointer-locked,
// no menu needed, matching a quick physical gesture rather than typed chat.
export function useFpvEmoteKeys(locked: boolean, sendEmote: (emoji: string) => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!locked) return;
      const index = Number(e.key) - 1;
      if (index >= 0 && index < EMOTES.length) sendEmote(EMOTES[index]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, sendEmote]);
}

// Press T (or click the prompt) to open a one-line chat box, released
// pointer lock so the OS cursor comes back for typing, same trick used by
// CtfTerminalRoom's flag panel. Enter sends, Escape/blur cancels.
export function FpvChatBox({ locked, onSend }: { locked: boolean; onSend: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!locked || open) return;
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        document.exitPointerLock?.();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    if (value.trim()) onSend(value.trim());
    setValue("");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="absolute bottom-16 left-1/2 w-72 -translate-x-1/2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        onBlur={() => setOpen(false)}
        maxLength={140}
        placeholder="Ketik pesan, Enter untuk kirim..."
        className="w-full rounded-md border border-accent bg-black/85 px-3 py-2 text-sm text-gray-100 outline-none"
      />
    </div>
  );
}

export function FpvOverlay({
  locked,
  entryTitle,
  entryBody,
  hoveredLabel,
}: {
  locked: boolean;
  entryTitle: string;
  entryBody: string;
  hoveredLabel?: string | null;
}) {
  return (
    <>
      {!locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center">
          <p className="text-lg text-gray-100">{entryTitle}</p>
          <p className="max-w-sm text-sm text-gray-400">{entryBody}</p>
        </div>
      )}
      {locked && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70" />
          {hoveredLabel && (
            <div className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 text-xs text-yellow-300">
              Klik: {hoveredLabel}
            </div>
          )}
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/60 px-3 py-1.5 text-xs text-gray-400">
            {EMOTES.map((e, i) => `${i + 1}:${e}`).join("  ")} untuk emote
          </div>
        </>
      )}
    </>
  );
}
