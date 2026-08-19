import { z } from "zod";

export const nodeTypeSchema = z.enum(["router", "switch", "pc", "server", "firewall"]);
export type NodeType = z.infer<typeof nodeTypeSchema>;

export const networkNodeSchema = z.object({
  id: z.string(),
  type: nodeTypeSchema,
  label: z.string().max(64),
  position: z.object({ x: z.number(), y: z.number() }),
  ipAddress: z.string().ip().optional(),
});
export type NetworkNode = z.infer<typeof networkNodeSchema>;

export const networkEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});
export type NetworkEdge = z.infer<typeof networkEdgeSchema>;

export const networkTopologySchema = z.object({
  nodes: z.array(networkNodeSchema),
  edges: z.array(networkEdgeSchema),
});
export type NetworkTopology = z.infer<typeof networkTopologySchema>;
