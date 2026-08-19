"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { NodeType } from "@cybersim/types";

const ICONS: Record<NodeType, string> = {
  router: "🌐",
  switch: "🔀",
  pc: "🖥️",
  server: "🗄️",
  firewall: "🛡️",
};

export interface DeviceNodeData {
  label: string;
  type: NodeType;
}

function DeviceNode({ data, selected }: NodeProps<DeviceNodeData>) {
  return (
    <div
      className={`flex min-w-[100px] flex-col items-center gap-1 rounded-md border bg-gray-900 px-3 py-2 text-xs ${
        selected ? "border-accent" : "border-gray-700"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent" />
      <span className="text-xl">{ICONS[data.type]}</span>
      <span className="text-gray-300">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-accent" />
    </div>
  );
}

export default memo(DeviceNode);
