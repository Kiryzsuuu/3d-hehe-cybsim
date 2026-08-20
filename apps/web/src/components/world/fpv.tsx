"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { OtherPlayer } from "@/hooks/usePresenceSocket";

const MOVE_SPEED = 6;

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

// Renders other players physically inside this FPV room as capsules with a
// floating username label, lerped toward their latest reported position
// since updates only arrive ~every 150ms over the socket.
function OtherFpvPlayer({ player }: { player: OtherPlayer }) {
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
    </group>
  );
}

export function FpvOtherPlayers({ players }: { players: OtherPlayer[] }) {
  return (
    <>
      {players.map((p) => (
        <OtherFpvPlayer key={p.userId} player={p} />
      ))}
    </>
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
        </>
      )}
    </>
  );
}
