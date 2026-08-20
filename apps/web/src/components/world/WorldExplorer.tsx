"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Text } from "@react-three/drei";
import * as THREE from "three";
import { usePresenceSocket, EMOTES, type OtherPlayer, type EmoteState } from "@/hooks/usePresenceSocket";
import { EmoteBubble } from "./fpv";
import { BlockyAvatar } from "./avatar";
import { useRequireAuth } from "@/hooks/useAuth";
import { getProfile } from "@/lib/api";

interface Station {
  id: string;
  label: string;
  icon: string;
  href: string;
  x: number;
  z: number;
  color: string;
}

const STATIONS: Station[] = [
  { id: "terminal", label: "Dashboard & Terminal", icon: "💻", href: "/dashboard", x: 0, z: -10, color: "#22d3ee" },
  { id: "scenarios", label: "Skenario", icon: "🎯", href: "/dashboard/scenarios", x: 12, z: -4, color: "#22c55e" },
  { id: "rooms", label: "Room Multiplayer", icon: "🧩", href: "/dashboard/rooms", x: 12, z: 8, color: "#a855f7" },
  { id: "network", label: "Network Topology", icon: "🌐", href: "/dashboard/network", x: 0, z: 14, color: "#3b82f6" },
  { id: "server-room", label: "Ruang Server (FPV)", icon: "🔌", href: "/world/network-room", x: -6, z: 14, color: "#f59e0b" },
  { id: "server-console", label: "Konsol Server (FPV)", icon: "🖥️", href: "/world/server-console", x: 6, z: 14, color: "#06b6d4" },
  { id: "ctf-terminal", label: "Terminal CTF (FPV)", icon: "🕵️", href: "/world/ctf-terminal", x: 0, z: 18, color: "#8b5cf6" },
  { id: "chat", label: "Chat", icon: "💬", href: "/dashboard/chat", x: -12, z: 8, color: "#f472b6" },
  { id: "leaderboard", label: "Leaderboard", icon: "🏆", href: "/leaderboard", x: -12, z: -4, color: "#eab308" },
  { id: "profile", label: "Profil", icon: "🪪", href: "/dashboard/profile", x: -6, z: -14, color: "#f97316" },
  { id: "tutorial", label: "Tutorial", icon: "📖", href: "/tutorial", x: 6, z: -14, color: "#94a3b8" },
];

const PLAYER_SPEED = 8;
const INTERACT_DISTANCE = 3;
const POSITION_STORAGE_KEY = "cybersim_world_position";

function loadStoredPosition(): { x: number; z: number } {
  if (typeof window === "undefined") return { x: 0, z: 0 };
  try {
    const raw = sessionStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return { x: 0, z: 0 };
    const parsed = JSON.parse(raw);
    if (typeof parsed.x === "number" && typeof parsed.z === "number") return parsed;
  } catch {
    // ignore malformed storage
  }
  return { x: 0, z: 0 };
}

function StationMarker({ station, active }: { station: Station; active: boolean }) {
  return (
    <group position={[station.x, 0, station.z]}>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 2, 24]} />
        <meshStandardMaterial
          color={station.color}
          emissive={active ? station.color : "#000000"}
          emissiveIntensity={active ? 0.6 : 0}
          transparent
          opacity={0.35}
        />
      </mesh>
      <Text position={[0, 3, 0]} fontSize={0.6} color="#e6e6e6" anchorX="center" anchorY="middle">
        {station.icon} {station.label}
      </Text>
    </group>
  );
}

function Player({
  positionRef,
  keysRef,
  onMove,
  color,
}: {
  positionRef: React.MutableRefObject<{ x: number; z: number }>;
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  onMove: (x: number, z: number) => void;
  color: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const facing = useRef(0);
  const movingRef = useRef(false);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    let dx = 0;
    let dz = 0;
    if (keys["w"] || keys["arrowup"]) dz -= 1;
    if (keys["s"] || keys["arrowdown"]) dz += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;

    movingRef.current = dx !== 0 || dz !== 0;
    if (movingRef.current) {
      const len = Math.hypot(dx, dz);
      dx = (dx / len) * PLAYER_SPEED * delta;
      dz = (dz / len) * PLAYER_SPEED * delta;
      positionRef.current.x = THREE.MathUtils.clamp(positionRef.current.x + dx, -20, 20);
      positionRef.current.z = THREE.MathUtils.clamp(positionRef.current.z + dz, -20, 20);
      facing.current = Math.atan2(dx, dz);
    }

    if (groupRef.current) {
      groupRef.current.position.set(positionRef.current.x, 0, positionRef.current.z);
      groupRef.current.rotation.y = facing.current;
    }

    const targetCamPos = new THREE.Vector3(positionRef.current.x, 9, positionRef.current.z + 9);
    camera.position.lerp(targetCamPos, Math.min(1, delta * 4));
    camera.lookAt(positionRef.current.x, 0, positionRef.current.z);

    onMove(positionRef.current.x, positionRef.current.z);
  });

  return (
    <group ref={groupRef}>
      <BlockyAvatar color={color} movingRef={movingRef} />
    </group>
  );
}

function OtherPlayerAvatar({ player, bubble, emote }: { player: OtherPlayer; bubble?: string; emote?: EmoteState }) {
  const groupRef = useRef<THREE.Group>(null);
  const movingRef = useRef(false);
  const facingRef = useRef(0);

  // Smoothly lerp toward the latest reported position each frame instead of
  // snapping, since updates only arrive ~every 150ms over the socket. Whether
  // it's currently "walking" (for the arm/leg swing) and which way it's
  // facing are both inferred from that same lerp delta, since the server
  // only ever tells us the destination, not the gait.
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const prevX = groupRef.current.position.x;
    const prevZ = groupRef.current.position.z;
    const nextX = THREE.MathUtils.lerp(prevX, player.x, Math.min(1, delta * 8));
    const nextZ = THREE.MathUtils.lerp(prevZ, player.z, Math.min(1, delta * 8));
    const moveDx = nextX - prevX;
    const moveDz = nextZ - prevZ;
    movingRef.current = Math.hypot(moveDx, moveDz) > 0.005;
    if (movingRef.current) facingRef.current = Math.atan2(moveDx, moveDz);
    groupRef.current.position.set(nextX, 0, nextZ);
    groupRef.current.rotation.y = facingRef.current;
  });

  return (
    <group>
      <group ref={groupRef} position={[player.x, 0, player.z]}>
        <BlockyAvatar color={player.color} movingRef={movingRef} />
      </group>
      <Text position={[player.x, 2.1, player.z]} fontSize={0.35} color={player.color} anchorX="center">
        {player.username}
      </Text>
      {bubble && (
        <Text
          position={[player.x, 2.65, player.z]}
          fontSize={0.28}
          color="#f8fafc"
          maxWidth={3}
          textAlign="center"
          anchorX="center"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {bubble}
        </Text>
      )}
      {emote && <EmoteBubble x={player.x} z={player.z} emoji={emote.emoji} emoteKey={emote.key} y={2.65} />}
    </group>
  );
}

function Scene({
  positionRef,
  keysRef,
  nearStation,
  onMove,
  others,
  chatBubbles,
  emotes,
  myColor,
}: {
  positionRef: React.MutableRefObject<{ x: number; z: number }>;
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  nearStation: Station | null;
  onMove: (x: number, z: number) => void;
  others: OtherPlayer[];
  chatBubbles: Record<string, string>;
  emotes: Record<string, EmoteState>;
  myColor: string;
}) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 15, 5]} intensity={1.2} />
      <Grid args={[50, 50]} cellColor="#1f2937" sectionColor="#374151" fadeDistance={40} infiniteGrid />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#0a0e14" />
      </mesh>
      {STATIONS.map((s) => (
        <StationMarker key={s.id} station={s} active={nearStation?.id === s.id} />
      ))}
      {others.map((p) => (
        <OtherPlayerAvatar key={p.userId} player={p} bubble={chatBubbles[p.userId]} emote={emotes[p.userId]} />
      ))}
      <Player positionRef={positionRef} keysRef={keysRef} onMove={onMove} color={myColor} />
    </>
  );
}

export default function WorldExplorer() {
  const router = useRouter();
  const { user } = useRequireAuth();
  const positionRef = useRef(loadStoredPosition());
  const [ready, setReady] = useState(false);
  const keysRef = useRef<Record<string, boolean>>({});
  const [nearStation, setNearStation] = useState<Station | null>(null);
  const [myColor, setMyColor] = useState("#22d3ee");
  const { others, reportPosition, chatBubbles, sendChat, emotes, sendEmote } = usePresenceSocket(user?.id);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatValue, setChatValue] = useState("");
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getProfile()
      .then((res) => setMyColor(res.user.avatarColor))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (chatOpen) return;
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;
      if (key === "e" && nearStation) {
        setReady(false);
        setTimeout(() => router.push(nearStation.href), 200);
      }
      if (key === "t") {
        e.preventDefault();
        setChatOpen(true);
      }
      const emoteIndex = Number(key) - 1;
      if (emoteIndex >= 0 && emoteIndex < EMOTES.length) {
        sendEmote(EMOTES[emoteIndex]);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [nearStation, router, chatOpen, sendEmote]);

  useEffect(() => {
    if (chatOpen) {
      keysRef.current = {};
      chatInputRef.current?.focus();
    }
  }, [chatOpen]);

  const submitChat = () => {
    if (chatValue.trim()) sendChat(chatValue.trim());
    setChatValue("");
    setChatOpen(false);
  };

  // Poll proximity on an interval instead of every R3F frame, cheap enough and
  // keeps this component free of a useFrame dependency outside the Canvas.
  // Same interval also persists the player's spot so re-entering /world after
  // a room visit resumes where they left off instead of snapping to spawn.
  useEffect(() => {
    const interval = setInterval(() => {
      const { x, z } = positionRef.current;
      const closest = STATIONS.find((s) => Math.hypot(s.x - x, s.z - z) < INTERACT_DISTANCE);
      setNearStation((prev) => (prev?.id === closest?.id ? prev : (closest ?? null)));
      sessionStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x, z }));
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Fade the scene in on mount rather than popping in fully rendered, a
  // small touch that makes returning from a room feel like arriving back
  // rather than a hard cut.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const stationList = useMemo(() => STATIONS, []);

  return (
    <div
      className="relative h-[36rem] w-full overflow-hidden rounded-lg border border-gray-800 bg-black transition-opacity duration-500"
      style={{ opacity: ready ? 1 : 0 }}
    >
      <Canvas camera={{ position: [0, 9, 9], fov: 50 }}>
        <Scene
          positionRef={positionRef}
          keysRef={keysRef}
          nearStation={nearStation}
          onMove={reportPosition}
          others={others}
          chatBubbles={chatBubbles}
          emotes={emotes}
          myColor={myColor}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-black/60 px-3 py-2 text-xs text-gray-300">
        WASD / panah untuk jalan · T untuk chat · 1-4 untuk emote
      </div>

      {chatOpen && (
        <div className="absolute bottom-16 left-1/2 w-72 -translate-x-1/2">
          <input
            ref={chatInputRef}
            value={chatValue}
            onChange={(e) => setChatValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") submitChat();
              if (e.key === "Escape") {
                setChatValue("");
                setChatOpen(false);
              }
            }}
            onBlur={() => setChatOpen(false)}
            maxLength={140}
            placeholder="Ketik pesan, Enter untuk kirim..."
            className="w-full rounded-md border border-accent bg-black/85 px-3 py-2 text-sm text-gray-100 outline-none"
          />
        </div>
      )}

      {others.length > 0 && (
        <div className="pointer-events-none absolute left-4 top-16 rounded-md bg-black/60 px-3 py-2 text-xs text-pink-300">
          {others.length} pemain lain online di World
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col gap-1 rounded-md bg-black/60 p-2 text-xs text-gray-400">
        {stationList.map((s) => (
          <span key={s.id}>
            {s.icon} {s.label}
          </span>
        ))}
      </div>

      {nearStation && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md border border-accent bg-black/80 px-4 py-2 text-sm text-accent">
          Tekan <kbd className="rounded bg-gray-800 px-1.5 py-0.5">E</kbd> untuk masuk {nearStation.label}
        </div>
      )}
    </div>
  );
}
