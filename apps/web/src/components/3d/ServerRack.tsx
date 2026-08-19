"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { useNetworkStore } from "@/stores/networkStore";

interface RackUnitProps {
  position: [number, number, number];
  label: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}

function RackUnit({ position, label, color, selected, onClick }: RackUnitProps) {
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >

      <mesh>
        <boxGeometry args={[3, 0.4, 1.2]} />
        <meshStandardMaterial color={selected ? "#22d3ee" : color} emissive={selected ? "#0e7490" : "#000000"} />
      </mesh>
      <Text position={[0, 0, 0.65]} fontSize={0.16} color="#e6e6e6" anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
}

const COLOR_BY_TYPE: Record<string, string> = {
  router: "#3b82f6",
  switch: "#a855f7",
  server: "#22c55e",
  firewall: "#ef4444",
  pc: "#6b7280",
};

export default function ServerRack() {
  const nodes = useNetworkStore((s) => s.nodes);
  const [selected, setSelected] = useState<string | null>(null);

  const units = useMemo(
    () =>
      nodes.map((n, i) => ({
        node: n,
        position: [0, 2 - i * 0.6, 0] as [number, number, number],
      })),
    [nodes]
  );

  return (
    <div className="h-[28rem] w-full rounded-lg border border-gray-800 bg-black">
      <Canvas camera={{ position: [5, 2, 5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[5, 5, 5]} intensity={40} />
        <group>
          {/* Rack frame */}
          <mesh position={[0, 0, -0.7]}>
            <boxGeometry args={[3.4, 6, 0.1]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          {units.length === 0 ? (
            <Text position={[0, 0, 0.3]} fontSize={0.2} color="#6b7280" anchorX="center">
              Tambahkan perangkat di Topology Editor
            </Text>
          ) : (
            units.map(({ node, position }) => (
              <RackUnit
                key={node.id}
                position={position}
                label={node.label}
                color={COLOR_BY_TYPE[node.type] ?? "#6b7280"}
                selected={selected === node.id}
                onClick={() => setSelected(node.id)}
              />
            ))
          )}
        </group>
        <OrbitControls enablePan={false} minDistance={3} maxDistance={12} />
      </Canvas>
    </div>
  );
}
