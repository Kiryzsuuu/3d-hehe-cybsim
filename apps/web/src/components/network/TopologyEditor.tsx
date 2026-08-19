"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeDragHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { useNetworkStore } from "@/stores/networkStore";
import DeviceNode, { type DeviceNodeData } from "./DeviceNode";
import type { NodeType } from "@cybersim/types";

const NODE_TYPES = { device: DeviceNode };
const DEVICE_TYPES: NodeType[] = ["router", "switch", "pc", "server", "firewall"];

export default function TopologyEditor() {
  const { nodes, edges, selectedNodeId, addNode, addEdge, removeNode, selectNode, updateNodePosition } =
    useNetworkStore();

  const flowNodes: Node<DeviceNodeData>[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "device",
        position: n.position,
        data: { label: n.label, type: n.type },
      })),
    [nodes]
  );

  const flowEdges: Edge[] = useMemo(
    () => edges.map((e) => ({ id: e.id, source: e.source, target: e.target, animated: true })),
    [edges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) addEdge(connection.source, connection.target);
    },
    [addEdge]
  );

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => selectNode(node.id), [selectNode]);

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_e, node) => updateNodePosition(node.id, node.position),
    [updateNodePosition]
  );

  const spawn = (type: NodeType) => {
    const position = { x: 80 + Math.random() * 300, y: 80 + Math.random() * 200 };
    addNode(type, position);
  };

  return (
    <div className="flex h-[32rem] flex-col rounded-lg border border-gray-800">
      <div className="flex flex-wrap gap-2 border-b border-gray-800 p-2">
        {DEVICE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => spawn(type)}
            className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:border-accent hover:text-accent"
          >
            + {type}
          </button>
        ))}
        {selectedNodeId && (
          <button
            onClick={() => removeNode(selectedNodeId)}
            className="ml-auto rounded-md border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
          >
            Hapus node terpilih
          </button>
        )}
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1f2937" gap={16} />
          <Controls />
          <MiniMap pannable zoomable className="!bg-gray-900" />
        </ReactFlow>
      </div>
    </div>
  );
}
