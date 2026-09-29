// Automatic layout for the graph screen.
//
// ELK's layered algorithm places the nodes, so no node has to be dragged by
// hand; the canvas renders the nodes at the positions this module computes.
// Sizes are passed to ELK instead of being measured in the DOM, so the layout
// and the rendered cards agree.

import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api.js";

import type { GraphEdge, GraphNode, GraphView } from "./graph";

const elk = new ELK();

export interface GraphNodeSize {
  width: number;
  height: number;
}

/**
 * The size ELK reserves for a node. The width follows the label so a readable
 * label fits in two lines; the card in the canvas uses the same numbers.
 */
export function graphNodeSize(node: GraphNode): GraphNodeSize {
  const base = node.kind === "capability" ? 150 : 190;
  return {
    width: Math.min(300, Math.max(base, node.label.length * 8 + 28)),
    height: node.subtitle === null || node.subtitle === "" ? 56 : 76,
  };
}

export interface PositionedNode {
  node: GraphNode;
  position: { x: number; y: number };
  size: GraphNodeSize;
}

export interface PositionedGraph {
  nodes: PositionedNode[];
  edges: GraphEdge[];
}

/**
 * Places every node of the view. The direction is the reading direction of the
 * flow: `DOWN` for a chain over time, `RIGHT` for the bipartite agent and
 * capability graph.
 */
export async function layoutGraph(
  view: GraphView,
  direction: "DOWN" | "RIGHT",
): Promise<PositionedGraph> {
  const sizes = new Map(view.nodes.map((node) => [node.id, graphNodeSize(node)]));
  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.layered.spacing.nodeNodeBetweenLayers": "70",
      "elk.spacing.nodeNode": "50",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    },
    children: view.nodes.map((node) => ({
      id: node.id,
      ...sizes.get(node.id),
    })),
    edges: view.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const laidOut = await elk.layout(graph);
  const positions = new Map(
    (laidOut.children ?? []).map((child) => [
      child.id,
      { x: child.x ?? 0, y: child.y ?? 0 },
    ]),
  );

  return {
    nodes: view.nodes.map((node) => ({
      node,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      size: sizes.get(node.id) ?? { width: 190, height: 76 },
    })),
    edges: view.edges,
  };
}
