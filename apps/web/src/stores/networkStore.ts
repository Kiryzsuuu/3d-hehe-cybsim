import { create } from "zustand";
import type { NetworkNode, NetworkEdge, NodeType } from "@cybersim/types";

interface NetworkState {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedNodeId: string | null;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  addEdge: (source: string, target: string) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
}

let nodeCounter = 0;
let edgeCounter = 0;

export const useNetworkStore = create<NetworkState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  addNode: (type, position) =>
    set((state) => {
      nodeCounter += 1;
      const id = `node-${nodeCounter}`;
      const node: NetworkNode = { id, type, label: `${type}-${nodeCounter}`, position };
      return { nodes: [...state.nodes, node] };
    }),

  addEdge: (source, target) =>
    set((state) => {
      if (source === target) return state;
      const exists = state.edges.some(
        (e) => (e.source === source && e.target === target) || (e.source === target && e.target === source)
      );
      if (exists) return state;
      edgeCounter += 1;
      return { edges: [...state.edges, { id: `edge-${edgeCounter}`, source, target }] };
    }),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodePosition: (id, position) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    })),
}));
