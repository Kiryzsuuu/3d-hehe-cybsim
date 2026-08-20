"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { Line, PointerLockControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { startScenario, completeScenario } from "@/lib/api";
import { FpvRig, FpvRoom, FpvOverlay, useFpvKeys, useFpvInteraction } from "./fpv";
import { useRequireAuth } from "@/hooks/useAuth";
import { usePresenceSocket } from "@/hooks/usePresenceSocket";

interface Device {
  id: string;
  label: string;
  color: string;
  position: [number, number, number];
  portOffset: [number, number, number];
}

const DEVICES: Device[] = [
  { id: "router", label: "Router", color: "#3b82f6", position: [-4, 0, -8], portOffset: [0.9, 0.4, 0] },
  { id: "switch", label: "Switch", color: "#a855f7", position: [4, 0, -8], portOffset: [-0.9, 0.4, 0] },
];

// Points awarded to match the "Sambungkan router ke switch" objective in the
// intro-topology scenario data (apps/api/src/db/seed.ts obj-2). This is a
// simplified integration: it completes the whole scenario at that objective's
// point value rather than tracking all three of its objectives individually,
// which would need a dedicated physical-objective endpoint out of scope here.
const CABLE_BONUS_SCORE = 10;
const TARGET_SCENARIO_SLUG = "intro-topology";

function DeviceRack({
  device,
  portRef,
  selected,
  connected,
}: {
  device: Device;
  portRef: (el: THREE.Mesh | null) => void;
  selected: boolean;
  connected: boolean;
}) {
  return (
    <group position={device.position}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[1.4, 1.5, 1]} />
        <meshStandardMaterial color={device.color} />
      </mesh>
      <Text position={[0, 1.8, 0]} fontSize={0.35} color="#e6e6e6" anchorX="center">
        {device.label}
      </Text>
      <mesh ref={portRef} position={device.portOffset} name={`port-${device.id}`}>
        {/* Radius is deliberately larger than the visible ~0.15 dot would
            suggest: a tight hitbox on a small sphere is hard to aim at with
            FPV mouselook, so the clickable volume is generous relative to
            what's drawn. */}
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial
          color={connected ? "#22c55e" : selected ? "#facc15" : "#ef4444"}
          emissive={connected ? "#22c55e" : selected ? "#facc15" : "#000000"}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}

function Cable({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const points = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y -= 0.5; // sag, like a real hanging cable
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(20);
  }, [from, to]);

  return <Line points={points} color="#22c55e" lineWidth={3} />;
}

function portWorldPosition(device: Device): [number, number, number] {
  return [
    device.position[0] + device.portOffset[0],
    device.position[1] + device.portOffset[1],
    device.position[2] + device.portOffset[2],
  ];
}

interface SceneProps {
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  selectedId: string | null;
  connectedPair: [string, string] | null;
  portMeshesRef: React.MutableRefObject<Record<string, THREE.Object3D | null>>;
}

function Scene({ keysRef, selectedId, connectedPair, portMeshesRef }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 5, -8]} intensity={40} />
      <FpvRoom />
      {DEVICES.map((d) => (
        <DeviceRack
          key={d.id}
          device={d}
          portRef={(el) => (portMeshesRef.current[d.id] = el)}
          selected={selectedId === d.id}
          connected={!!connectedPair}
        />
      ))}
      {connectedPair && <Cable from={portWorldPosition(DEVICES[0])} to={portWorldPosition(DEVICES[1])} />}
      <FpvRig keysRef={keysRef} lookAt={[0, 1, -8]} />
    </>
  );
}

export default function NetworkRoom() {
  const router = useRouter();
  const { user } = useRequireAuth();
  const { others } = usePresenceSocket(user?.id);
  const keysRef = useFpvKeys();
  const portMeshesRef = useRef<Record<string, THREE.Object3D | null>>({});
  const cameraRef = useRef<THREE.Camera | null>(null);
  const [locked, setLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectedPair, setConnectedPair] = useState<[string, string] | null>(null);
  const [bonusAwarded, setBonusAwarded] = useState(false);

  useEffect(() => {
    startScenario(TARGET_SCENARIO_SLUG).catch(() => {});
  }, []);

  const selectedIdRef = useRef<string | null>(null);
  const connectedRef = useRef(false);

  const onHit = useCallback((hitId: string) => {
    if (connectedRef.current) return;
    const prev = selectedIdRef.current;
    if (!prev) {
      selectedIdRef.current = hitId;
      setSelectedId(hitId);
      return;
    }
    if (prev === hitId) {
      selectedIdRef.current = null; // clicking the same port again deselects
      setSelectedId(null);
      return;
    }
    connectedRef.current = true;
    selectedIdRef.current = null;
    setSelectedId(null);
    setConnectedPair([prev, hitId]);
  }, []);

  const { hoveredId } = useFpvInteraction({ locked, cameraRef, targetsRef: portMeshesRef, onHit });

  useEffect(() => {
    if (!connectedPair || bonusAwarded) return;
    setBonusAwarded(true);
    completeScenario(TARGET_SCENARIO_SLUG, CABLE_BONUS_SCORE).catch(() => {
      setBonusAwarded(false);
    });
  }, [connectedPair, bonusAwarded]);

  const hoveredLabel = hoveredId && !connectedPair ? `Port ${DEVICES.find((d) => d.id === hoveredId)?.label}` : null;

  return (
    <div className="relative h-[36rem] w-full overflow-hidden rounded-lg border border-gray-800 bg-black">
      <Canvas camera={{ position: [0, 1.6, 0], fov: 70 }} onCreated={({ camera }) => (cameraRef.current = camera)}>
        <Scene keysRef={keysRef} selectedId={selectedId} connectedPair={connectedPair} portMeshesRef={portMeshesRef} />
        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
      </Canvas>

      <FpvOverlay
        locked={locked}
        entryTitle="Klik untuk masuk mode FPV"
        entryBody="WASD untuk jalan, mouse untuk lihat sekeliling, klik port merah di router lalu klik port di switch untuk menyambungkan kabel. ESC untuk keluar mode FPV."
        hoveredLabel={hoveredLabel}
      />

      {others.length > 0 && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-black/60 px-3 py-2 text-xs text-pink-300">
          {others.length} pemain lain online
        </div>
      )}

      {connectedPair && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 rounded-md border border-green-700 bg-black/80 px-4 py-3 text-center">
          <p className="text-sm text-green-400">✓ Kabel tersambung: Router ↔ Switch (+{CABLE_BONUS_SCORE} pts)</p>
          <button
            onClick={() => router.push("/world")}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black"
          >
            Kembali ke World
          </button>
        </div>
      )}
    </div>
  );
}
