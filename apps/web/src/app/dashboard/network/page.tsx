"use client";

import dynamic from "next/dynamic";

const TopologyEditor = dynamic(() => import("@/components/network/TopologyEditor"), {
  ssr: false,
  loading: () => <div className="h-[32rem] w-full rounded-lg border border-gray-800 bg-gray-950" />,
});

// Three.js + drei pull in a heavy bundle — lazy-load and skip SSR since Canvas needs WebGL/DOM.
const ServerRack = dynamic(() => import("@/components/3d/ServerRack"), {
  ssr: false,
  loading: () => <div className="h-[28rem] w-full rounded-lg border border-gray-800 bg-black" />,
});

export default function NetworkPage() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <h1 className="mb-2 text-2xl font-semibold">Network Topology</h1>
      <p className="mb-6 text-sm text-gray-500">
        Susun perangkat dan sambungkan node di editor, lalu lihat visualisasi 3D-nya di panel Server Rack.
      </p>
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-gray-500">Topology Editor</h2>
          <TopologyEditor />
        </section>
        <section>
          <h2 className="mb-2 text-sm uppercase tracking-wide text-gray-500">Server Rack (3D)</h2>
          <ServerRack />
        </section>
      </div>
    </main>
  );
}
