"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PointerLockControls, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  getSandboxStatus,
  startSandbox,
  stopSandbox,
  getDvwaStatus,
  startDvwa,
  stopDvwa,
} from "@/lib/api";
import { FpvRig, FpvRoom, FpvOverlay, useFpvKeys, useFpvInteraction } from "./fpv";

type ConsoleState = "off" | "on" | "busy";

interface Console_ {
  id: "sandbox" | "dvwa";
  label: string;
  color: string;
  position: [number, number, number];
}

const CONSOLES: Console_[] = [
  { id: "sandbox", label: "Sandbox CLI", color: "#22d3ee", position: [-4, 0, -8] },
  { id: "dvwa", label: "DVWA Target", color: "#f59e0b", position: [4, 0, -8] },
];

function ServerCabinet({
  cons,
  state,
  buttonRef,
}: {
  cons: Console_;
  state: ConsoleState;
  buttonRef: (el: THREE.Mesh | null) => void;
}) {
  const lightColor = state === "on" ? "#22c55e" : state === "busy" ? "#eab308" : "#ef4444";
  return (
    <group position={cons.position}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[1.6, 2.4, 1]} />
        <meshStandardMaterial color={cons.color} />
      </mesh>
      <Text position={[0, 2.7, 0]} fontSize={0.35} color="#e6e6e6" anchorX="center">
        {cons.label}
      </Text>
      {/* Status light strip */}
      <mesh position={[0, 2.2, 0.51]}>
        <boxGeometry args={[1.2, 0.15, 0.02]} />
        <meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={0.8} />
      </mesh>
      {/* Power button (the clickable hit target). Radius is generous relative
          to what's visually drawn, same reasoning as the port hitboxes in
          NetworkRoom: a small target is hard to hit with FPV mouselook. */}
      <mesh ref={buttonRef} position={[0, 0.9, 0.55]} rotation={[Math.PI / 2, 0, 0]} name={`button-${cons.id}`}>
        <cylinderGeometry args={[0.6, 0.6, 0.15, 24]} />
        <meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

interface SceneProps {
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  states: Record<string, ConsoleState>;
  buttonMeshesRef: React.MutableRefObject<Record<string, THREE.Object3D | null>>;
}

function Scene({ keysRef, states, buttonMeshesRef }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 5, -8]} intensity={40} />
      <FpvRoom wallColor="#1e293b" floorColor="#0f172a" />
      {CONSOLES.map((c) => (
        <ServerCabinet
          key={c.id}
          cons={c}
          state={states[c.id] ?? "off"}
          buttonRef={(el) => (buttonMeshesRef.current[c.id] = el)}
        />
      ))}
      <FpvRig keysRef={keysRef} lookAt={[0, 1, -8]} />
    </>
  );
}

export default function ServerConsoleRoom() {
  const keysRef = useFpvKeys();
  const buttonMeshesRef = useRef<Record<string, THREE.Object3D | null>>({});
  const cameraRef = useRef<THREE.Camera | null>(null);
  const [locked, setLocked] = useState(false);
  const [states, setStates] = useState<Record<string, ConsoleState>>({ sandbox: "off", dvwa: "off" });
  const [error, setError] = useState<string | null>(null);
  const [dvwaUrl, setDvwaUrl] = useState<string | null>(null);

  useEffect(() => {
    getSandboxStatus()
      .then((s) => setStates((prev) => ({ ...prev, sandbox: s.running ? "on" : "off" })))
      .catch(() => {});
    getDvwaStatus()
      .then((s) => {
        setStates((prev) => ({ ...prev, dvwa: s.running ? "on" : "off" }));
        setDvwaUrl(s.url);
      })
      .catch(() => {});
  }, []);

  const toggle = useCallback(
    async (id: "sandbox" | "dvwa") => {
      setStates((prev) => ({ ...prev, [id]: "busy" }));
      setError(null);
      try {
        if (id === "sandbox") {
          const current = await getSandboxStatus();
          const result = current.running ? await stopSandbox() : await startSandbox();
          setStates((prev) => ({ ...prev, sandbox: result.running ? "on" : "off" }));
        } else {
          const current = await getDvwaStatus();
          const result = current.running ? await stopDvwa() : await startDvwa();
          setStates((prev) => ({ ...prev, dvwa: result.running ? "on" : "off" }));
          setDvwaUrl(result.url);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengubah status");
        setStates((prev) => ({ ...prev, [id]: prev[id] === "busy" ? "off" : prev[id] }));
      }
    },
    []
  );

  const onHit = useCallback(
    (hitId: string) => {
      const id = hitId.replace("button-", "") as "sandbox" | "dvwa";
      if (states[id] === "busy") return;
      toggle(id);
    },
    [states, toggle]
  );

  const { hoveredId } = useFpvInteraction({ locked, cameraRef, targetsRef: buttonMeshesRef, onHit });

  const hoveredLabel = hoveredId
    ? `${states[hoveredId] === "on" ? "Matikan" : "Nyalakan"} ${CONSOLES.find((c) => c.id === hoveredId)?.label}`
    : null;

  return (
    <div className="relative h-[36rem] w-full overflow-hidden rounded-lg border border-gray-800 bg-black">
      <Canvas camera={{ position: [0, 1.6, 0], fov: 70 }} onCreated={({ camera }) => (cameraRef.current = camera)}>
        <Scene keysRef={keysRef} states={states} buttonMeshesRef={buttonMeshesRef} />
        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
      </Canvas>

      <FpvOverlay
        locked={locked}
        entryTitle="Klik untuk masuk mode FPV"
        entryBody="WASD untuk jalan, mouse untuk lihat sekeliling, klik tombol power di rak untuk menyalakan/mematikan container Docker sungguhan."
        hoveredLabel={hoveredLabel}
      />

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-md bg-red-950/80 px-3 py-1.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {states.dvwa === "on" && dvwaUrl && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-accent bg-black/80 px-4 py-2 text-center">
          <a href={dvwaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent">
            Buka DVWA di tab baru →
          </a>
        </div>
      )}
    </div>
  );
}
