"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Text } from "@react-three/drei";
import * as THREE from "three";
import { usePresenceSocket, type OtherPlayer } from "@/hooks/usePresenceSocket";
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
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const facing = useRef(0);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    let dx = 0;
    let dz = 0;
    if (keys["w"] || keys["arrowup"]) dz -= 1;
    if (keys["s"] || keys["arrowdown"]) dz += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx = (dx / len) * PLAYER_SPEED * delta;
      dz = (dz / len) * PLAYER_SPEED * delta;
      positionRef.current.x = THREE.MathUtils.clamp(positionRef.current.x + dx, -20, 20);
      positionRef.current.z = THREE.MathUtils.clamp(positionRef.current.z + dz, -20, 20);
      facing.current = Math.atan2(dx, dz);
    }

    if (meshRef.current) {
      meshRef.current.position.set(positionRef.current.x, 0.6, positionRef.current.z);
      meshRef.current.rotation.y = facing.current;
    }

    const targetCamPos = new THREE.Vector3(positionRef.current.x, 9, positionRef.current.z + 9);
    camera.position.lerp(targetCamPos, Math.min(1, delta * 4));
    camera.lookAt(positionRef.current.x, 0, positionRef.current.z);

    onMove(positionRef.current.x, positionRef.current.z);
  });

  return (
    <mesh ref={meshRef}>
      <capsuleGeometry args={[0.4, 0.6, 4, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function OtherPlayerAvatar({ player }: { player: OtherPlayer }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Smoothly lerp toward the latest reported position each frame instead of
  // snapping, since updates only arrive ~every 150ms over the socket.
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, player.x, Math.min(1, delta * 8));
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, player.z, Math.min(1, delta * 8));
  });

  return (
    <group>
      <mesh ref={meshRef} position={[player.x, 0.6, player.z]}>
        <capsuleGeometry args={[0.4, 0.6, 4, 8]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
      <Text position={[player.x, 1.5, player.z]} fontSize={0.35} color={player.color} anchorX="center">
        {player.username}
      </Text>
    </group>
  );
}

function Scene({
  positionRef,
  keysRef,
  nearStation,
  onMove,
  others,
  myColor,
}: {
  positionRef: React.MutableRefObject<{ x: number; z: number }>;
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  nearStation: Station | null;
  onMove: (x: number, z: number) => void;
  others: OtherPlayer[];
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
        <OtherPlayerAvatar key={p.userId} player={p} />
      ))}
      <Player positionRef={positionRef} keysRef={keysRef} onMove={onMove} color={myColor} />
    </>
  );
}

export default function WorldExplorer() {
  const router = useRouter();
  const { user } = useRequireAuth();
  const positionRef = useRef({ x: 0, z: 0 });
  const keysRef = useRef<Record<string, boolean>>({});
  const [nearStation, setNearStation] = useState<Station | null>(null);
  const [myColor, setMyColor] = useState("#22d3ee");
  const { others, reportPosition } = usePresenceSocket(user?.id);

  useEffect(() => {
    getProfile()
      .then((res) => setMyColor(res.user.avatarColor))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === "e" && nearStation) {
        router.push(nearStation.href);
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
  }, [nearStation, router]);

  // Poll proximity on an interval instead of every R3F frame, cheap enough and
  // keeps this component free of a useFrame dependency outside the Canvas.
  useEffect(() => {
    const interval = setInterval(() => {
      const { x, z } = positionRef.current;
      const closest = STATIONS.find((s) => Math.hypot(s.x - x, s.z - z) < INTERACT_DISTANCE);
      setNearStation((prev) => (prev?.id === closest?.id ? prev : (closest ?? null)));
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const stationList = useMemo(() => STATIONS, []);

  return (
    <div className="relative h-[36rem] w-full overflow-hidden rounded-lg border border-gray-800 bg-black">
      <Canvas camera={{ position: [0, 9, 9], fov: 50 }}>
        <Scene
          positionRef={positionRef}
          keysRef={keysRef}
          nearStation={nearStation}
          onMove={reportPosition}
          others={others}
          myColor={myColor}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-black/60 px-3 py-2 text-xs text-gray-300">
        WASD / panah untuk jalan
      </div>

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
