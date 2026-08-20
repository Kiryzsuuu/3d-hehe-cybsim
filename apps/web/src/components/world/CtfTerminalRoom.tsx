"use client";

import { useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PointerLockControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { getScenario, submitFlag, type ScenarioDetail } from "@/lib/api";
import { announceUnlocked } from "@/components/AchievementToast";
import {
  FpvRig,
  FpvRoom,
  FpvOverlay,
  FpvPresenceReporter,
  FpvOtherPlayers,
  FpvChatBox,
  FpvBackLink,
  useFpvKeys,
  useFpvInteraction,
  useFpvEmoteKeys,
  useFadeIn,
} from "./fpv";
import { useRequireAuth } from "@/hooks/useAuth";
import { usePresenceSocket, type OtherPlayer, type EmoteState } from "@/hooks/usePresenceSocket";

const ROOM_ID = "ctf-terminal";

const SCENARIO_SLUG = "ctf-decode-flag";
const TERMINAL_POSITION: [number, number, number] = [0, 0, -8];

function Terminal({ hacked, hint }: { hacked: boolean; hint: string | null }) {
  return (
    <group position={TERMINAL_POSITION}>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[2, 2, 0.6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 1.1, 0.31]} name="terminal-screen">
        <planeGeometry args={[1.5, 1.1]} />
        <meshStandardMaterial
          color={hacked ? "#052e16" : "#020617"}
          emissive={hacked ? "#22c55e" : "#0ea5e9"}
          emissiveIntensity={hacked ? 0.5 : 0.3}
        />
      </mesh>
      <Text position={[0, 1.1, 0.33]} fontSize={0.09} color={hacked ? "#4ade80" : "#38bdf8"} maxWidth={1.3} textAlign="center" anchorX="center" anchorY="middle">
        {hacked ? "✓ FLAG CAPTURED" : (hint ?? "Klik untuk buka terminal")}
      </Text>
      <Text position={[0, 2.3, 0]} fontSize={0.3} color="#e6e6e6" anchorX="center">
        Terminal CTF
      </Text>
    </group>
  );
}

interface SceneProps {
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  hacked: boolean;
  hint: string | null;
  terminalRef: React.MutableRefObject<Record<string, THREE.Object3D | null>>;
  others: OtherPlayer[];
  chatBubbles: Record<string, string>;
  emotes: Record<string, EmoteState>;
  reportPosition: (x: number, z: number) => void;
}

function Scene({ keysRef, hacked, hint, terminalRef, others, chatBubbles, emotes, reportPosition }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 5, -8]} intensity={40} />
      <FpvRoom wallColor="#312e81" floorColor="#0f0a2e" />
      <group position={TERMINAL_POSITION}>
        {/* The raycast target must be the mesh itself, not a wrapping group:
            THREE.Raycaster.intersectObjects() only descends into children
            when called with recursive=true, and the shared fpv.tsx hook
            calls it non-recursively (matching how NetworkRoom/ServerConsoleRoom
            put their refs directly on meshes too). */}
        <mesh
          position={[0, 1.1, 0.31]}
          name="terminal-hitbox"
          ref={(el) => {
            terminalRef.current["terminal"] = el;
          }}
        >
          <planeGeometry args={[2, 2]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>
      <Terminal hacked={hacked} hint={hint} />
      <FpvOtherPlayers players={others} chatBubbles={chatBubbles} emotes={emotes} />
      <FpvPresenceReporter reportPosition={reportPosition} />
      <FpvRig keysRef={keysRef} lookAt={[TERMINAL_POSITION[0], 1.1, TERMINAL_POSITION[2]]} />
    </>
  );
}

export default function CtfTerminalRoom() {
  const { user } = useRequireAuth();
  const { others, reportPosition, chatBubbles, sendChat, emotes, sendEmote } = usePresenceSocket(user?.id, ROOM_ID);
  const keysRef = useFpvKeys();
  const terminalRef = useRef<Record<string, THREE.Object3D | null>>({});
  const cameraRef = useRef<THREE.Camera | null>(null);
  const [locked, setLocked] = useState(false);
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [flagInput, setFlagInput] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "wrong" | "hacked" | "already">("idle");
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const ready = useFadeIn();
  const [leaving, setLeaving] = useState(false);

  const onHit = useCallback(() => {
    if (status === "hacked") return;
    setPanelOpen(true);
    // Release pointer lock so the mouse cursor comes back and the user can
    // actually click/type into the HTML form below — while locked, the OS
    // cursor stays hidden/captured and can't interact with overlaid DOM UI.
    document.exitPointerLock?.();
    if (!scenario) {
      getScenario(SCENARIO_SLUG)
        .then((res) => setScenario(res.scenario))
        .catch(() => {});
    }
  }, [status, scenario]);

  const { hoveredId } = useFpvInteraction({ locked, cameraRef, targetsRef: terminalRef, onHit });
  useFpvEmoteKeys(locked, sendEmote);

  const onSubmit = async () => {
    if (!flagInput.trim()) return;
    setStatus("checking");
    try {
      const result = await submitFlag(SCENARIO_SLUG, flagInput.trim());
      if (!result.correct) setStatus("wrong");
      else if (result.alreadyCaptured) setStatus("already");
      else {
        setStatus("hacked");
        setPointsAwarded(result.pointsAwarded);
        announceUnlocked(result.newlyUnlocked);
      }
    } catch {
      setStatus("wrong");
    }
  };

  const hint = scenario?.data.hints[0] ?? null;

  return (
    <div
      className="relative h-[36rem] w-full overflow-hidden rounded-lg border border-gray-800 bg-black transition-opacity duration-500"
      style={{ opacity: ready && !leaving ? 1 : 0 }}
    >
      <Canvas camera={{ position: [0, 1.6, 0], fov: 70 }} onCreated={({ camera }) => (cameraRef.current = camera)}>
        <Scene
          keysRef={keysRef}
          hacked={status === "hacked"}
          hint={hint}
          terminalRef={terminalRef}
          others={others}
          chatBubbles={chatBubbles}
          emotes={emotes}
          reportPosition={reportPosition}
        />
        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
      </Canvas>

      {!panelOpen && (
        <FpvOverlay
          locked={locked}
          entryTitle="Klik untuk masuk mode FPV"
          entryBody="WASD untuk jalan, mouse untuk lihat sekeliling. Dekati terminal di depan dan klik untuk membukanya, lalu pecahkan flag CTF-nya. Tekan T untuk chat, 1-4 untuk emote."
          hoveredLabel={hoveredId && status !== "hacked" ? "Buka Terminal" : null}
        />
      )}
      {!panelOpen && <FpvChatBox locked={locked} onSend={sendChat} />}
      {!panelOpen && <FpvBackLink onBeforeLeave={() => setLeaving(true)} />}

      {others.length > 0 && !panelOpen && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-black/60 px-3 py-2 text-xs text-pink-300">
          {others.length} pemain lain online
        </div>
      )}

      {panelOpen && status !== "hacked" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm rounded-lg border border-accent bg-gray-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-accent">Terminal CTF</h2>
              <button onClick={() => setPanelOpen(false)} className="text-xs text-gray-500 hover:text-gray-300">
                Tutup (ESC)
              </button>
            </div>
            {scenario ? (
              <>
                <p className="mb-2 text-xs text-gray-400">{scenario.description}</p>
                {scenario.data.hints.map((h, i) => (
                  <p key={i} className="mb-1 rounded bg-gray-900 p-2 text-xs text-gray-300">
                    {h}
                  </p>
                ))}
                <div className="mt-3 flex gap-2">
                  <input
                    value={flagInput}
                    onChange={(e) => {
                      setFlagInput(e.target.value);
                      setStatus("idle");
                    }}
                    placeholder="CYBERSIM{...}"
                    className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-200"
                  />
                  <button
                    onClick={onSubmit}
                    disabled={!flagInput.trim() || status === "checking"}
                    className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-accent hover:text-accent disabled:opacity-40"
                  >
                    {status === "checking" ? "..." : "Submit"}
                  </button>
                </div>
                {status === "wrong" && <p className="mt-2 text-xs text-red-400">Flag salah, coba lagi.</p>}
                {status === "already" && <p className="mt-2 text-xs text-yellow-400">Sudah pernah ditangkap sebelumnya.</p>}
              </>
            ) : (
              <p className="text-xs text-gray-500">Memuat...</p>
            )}
          </div>
        </div>
      )}

      {status === "hacked" && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 rounded-md border border-green-700 bg-black/80 px-4 py-3 text-center">
          <p className="text-sm text-green-400">✓ Terminal berhasil diretas! +{pointsAwarded} pts</p>
        </div>
      )}
    </div>
  );
}
