"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A blocky Roblox-style humanoid built from a handful of boxes instead of a
// single capsule, feet anchored at local y=0 so callers can position the
// group directly at [x, 0, z] on whatever floor they're standing on. Swings
// arms/legs while `movingRef` is true and eases back to a neutral pose when
// it stops, rather than a hard freeze mid-stride.
export function BlockyAvatar({ color, movingRef }: { color: string; movingRef?: React.MutableRefObject<boolean> }) {
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);
  const ampRef = useRef(0);

  useFrame((_, delta) => {
    const moving = movingRef?.current ?? false;
    phaseRef.current += delta * 9;
    ampRef.current = THREE.MathUtils.lerp(ampRef.current, moving ? 0.6 : 0, delta * 8);
    const swing = Math.sin(phaseRef.current) * ampRef.current;
    if (leftArmRef.current) leftArmRef.current.rotation.x = swing;
    if (rightArmRef.current) rightArmRef.current.rotation.x = -swing;
    if (leftLegRef.current) leftLegRef.current.rotation.x = -swing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = swing;
  });

  return (
    <group>
      <group ref={leftLegRef} position={[-0.15, 0.7, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[0.22, 0.7, 0.22]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.15, 0.7, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <boxGeometry args={[0.22, 0.7, 0.22]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.55, 0.65, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <group ref={leftArmRef} position={[-0.38, 1.4, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <boxGeometry args={[0.18, 0.6, 0.18]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.38, 1.4, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <boxGeometry args={[0.18, 0.6, 0.18]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
    </group>
  );
}
