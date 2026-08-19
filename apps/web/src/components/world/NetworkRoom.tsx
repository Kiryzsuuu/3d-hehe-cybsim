"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, PointerLockControls, Text } from "@react-three/drei";
import * as THREE from "three";

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

const MOVE_SPEED = 6;

function Rig({ keysRef }: { keysRef: React.MutableRefObject<Record<string, boolean>> }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1, -8);
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
      camera.position.x = THREE.MathUtils.clamp(camera.position.x + move.x, -9, 9);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + move.z, -9, 9);
    }
    camera.position.y = 1.6;
  });

  return null;
}

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0, 3, -10]}>
        <boxGeometry args={[20, 6, 0.3]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 3, 10]}>
        <boxGeometry args={[20, 6, 0.3]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[-10, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 6, 0.3]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[10, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 6, 0.3]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </group>
  );
}

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

interface SceneProps {
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  selectedId: string | null;
  connectedPair: [string, string] | null;
  portMeshesRef: React.MutableRefObject<Record<string, THREE.Mesh | null>>;
}

function Scene({ keysRef, selectedId, connectedPair, portMeshesRef }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 5, -8]} intensity={40} />
      <Room />
      {DEVICES.map((d) => (
        <DeviceRack
          key={d.id}
          device={d}
          portRef={(el) => (portMeshesRef.current[d.id] = el)}
          selected={selectedId === d.id}
          connected={!!connectedPair}
        />
      ))}
      {connectedPair && (
        <Cable
          from={[
            DEVICES[0].position[0] + DEVICES[0].portOffset[0],
            DEVICES[0].position[1] + DEVICES[0].portOffset[1],
            DEVICES[0].position[2] + DEVICES[0].portOffset[2],
          ]}
          to={[
            DEVICES[1].position[0] + DEVICES[1].portOffset[0],
            DEVICES[1].position[1] + DEVICES[1].portOffset[1],
            DEVICES[1].position[2] + DEVICES[1].portOffset[2],
          ]}
        />
      )}
      <Rig keysRef={keysRef} />
    </>
  );
}

export default function NetworkRoom() {
  const router = useRouter();
  const keysRef = useRef<Record<string, boolean>>({});
  const portMeshesRef = useRef<Record<string, THREE.Mesh | null>>({});
  const [locked, setLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectedPair, setConnectedPair] = useState<[string, string] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

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

  // Raycast from screen center against the port meshes on every click while locked.
  useEffect(() => {
    if (!locked) return;
    const raycaster = new THREE.Raycaster();
    const onClick = () => {
      const camera = cameraRef.current;
      if (!camera) return;
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera as THREE.PerspectiveCamera);
      const meshes = Object.entries(portMeshesRef.current).filter(([, m]) => !!m) as [string, THREE.Mesh][];
      const intersects = raycaster.intersectObjects(
        meshes.map(([, m]) => m),
        false
      );
      if (intersects.length === 0 || intersects[0].distance > 15) return;

      const hitMesh = intersects[0].object;
      const hitId = meshes.find(([, m]) => m === hitMesh)?.[0];
      if (!hitId || connectedPair) return;

      setSelectedId((prev) => {
        if (!prev) return hitId;
        if (prev === hitId) return null; // clicking the same port again deselects
        setConnectedPair([prev, hitId]);
        return null;
      });
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [locked, connectedPair]);

  // Poll hover (center raycast) for the crosshair label, independent of clicks.
  useEffect(() => {
    if (!locked) return;
    const raycaster = new THREE.Raycaster();
    const interval = setInterval(() => {
      const camera = cameraRef.current;
      if (!camera) return;
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera as THREE.PerspectiveCamera);
      const meshes = Object.entries(portMeshesRef.current).filter(([, m]) => !!m) as [string, THREE.Mesh][];
      const intersects = raycaster.intersectObjects(
        meshes.map(([, m]) => m),
        false
      );
      if (intersects.length > 0 && intersects[0].distance <= 15) {
        const hitId = meshes.find(([, m]) => m === intersects[0].object)?.[0];
        const device = DEVICES.find((d) => d.id === hitId);
        setHoveredLabel(device ? `Port ${device.label}` : null);
      } else {
        setHoveredLabel(null);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [locked]);

  return (
    <div className="relative h-[36rem] w-full overflow-hidden rounded-lg border border-gray-800 bg-black">
      <Canvas camera={{ position: [0, 1.6, 0], fov: 70 }} onCreated={({ camera }) => (cameraRef.current = camera)}>
        <Scene keysRef={keysRef} selectedId={selectedId} connectedPair={connectedPair} portMeshesRef={portMeshesRef} />
        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
      </Canvas>

      {!locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center">
          <p className="text-lg text-gray-100">Klik untuk masuk mode FPV</p>
          <p className="max-w-sm text-sm text-gray-400">
            WASD untuk jalan, mouse untuk lihat sekeliling, klik port merah di router lalu klik port di switch untuk
            menyambungkan kabel. ESC untuk keluar mode FPV.
          </p>
        </div>
      )}

      {locked && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70" />
          {hoveredLabel && !connectedPair && (
            <div className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 text-xs text-yellow-300">
              Klik: {hoveredLabel}
            </div>
          )}
        </>
      )}

      {connectedPair && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 rounded-md border border-green-700 bg-black/80 px-4 py-3 text-center">
          <p className="text-sm text-green-400">✓ Kabel tersambung: Router ↔ Switch</p>
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
