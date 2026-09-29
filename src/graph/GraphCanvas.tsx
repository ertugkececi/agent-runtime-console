// The canvas: React Flow cards placed by the automatic ELK layout.
//
// Nodes are focusable and Enter/Space selects the focused node, so the whole
// graph is reachable by keyboard; every node carries a readable aria-label.
// Dragging is off because the layout is automatic — the positions come from
// elk.ts, not from the pointer.

import { useEffect, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type DefaultEdgeOptions,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { layoutGraph, type GraphNodeSize } from "./elk";
import { graphNodeStatusLabel, type GraphNode, type GraphView } from "./graph";

type GraphNodeData = { view: GraphNode; selected: boolean; direction: "DOWN" | "RIGHT" };

const KIND_STYLES: Record<GraphNode["kind"], { background: string; border: string }> = {
  agent: { background: "#eef4ff", border: "#4f6bed" },
  capability: { background: "#eafaef", border: "#3f9d5a" },
  run: { background: "#f5f0ff", border: "#7a5af8" },
  turn: { background: "#fff6e8", border: "#c98a2b" },
};

function GraphNodeCard({ data }: NodeProps) {
  const view = data.view as GraphNode;
  const selected = data.selected === true;
  const direction = data.direction === "RIGHT" ? "RIGHT" : "DOWN";
  const palette = KIND_STYLES[view.kind];
  const status = graphNodeStatusLabel(view);

  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        padding: "6px 8px",
        overflow: "hidden",
        background: palette.background,
        border: `${selected ? 3 : 1}px solid ${selected ? "#1d4ed8" : palette.border}`,
        borderRadius: 6,
        fontFamily: "inherit",
      }}
    >
      <Handle
        type="target"
        position={direction === "RIGHT" ? Position.Left : Position.Top}
        isConnectable={false}
        style={{ opacity: 0 }}
      />
      <div
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.2,
        }}
      >
        {view.label}
      </div>
      {view.subtitle !== null ? (
        <div style={{ fontSize: 11, color: "#444", lineHeight: 1.25 }}>{view.subtitle}</div>
      ) : null}
      {status !== null ? (
        <div style={{ fontSize: 11, color: "#222", fontWeight: 600 }}>{status}</div>
      ) : null}
      <Handle
        type="source"
        position={direction === "RIGHT" ? Position.Right : Position.Bottom}
        isConnectable={false}
        style={{ opacity: 0 }}
      />
    </div>
  );
}

const nodeTypes = { graphNode: GraphNodeCard };

const defaultEdgeOptions: DefaultEdgeOptions = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  labelStyle: { fontSize: 11 },
  labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
  labelBgPadding: [4, 2],
  labelBgBorderRadius: 3,
};

/**
 * The layout signature: node ids with their label sizes and the edge ids.
 * Only a different signature re-runs ELK, so a status-only update does not
 * move the graph, while a reload that adds a run or a handoff does.
 */
function viewSignature(view: GraphView): string {
  const nodes = view.nodes
    .map((node) => `${node.id}@${node.label.length}:${node.subtitle?.length ?? 0}`)
    .join(",");
  const edges = view.edges.map((edge) => edge.id).join(",");
  return `${nodes}|${edges}`;
}

interface GraphCanvasProps {
  view: GraphView;
  direction: "DOWN" | "RIGHT";
  selectedId: string | null;
  onSelect: (nodeId: string | null) => void;
}

type Positions = Map<string, GraphNodeSize & { x: number; y: number }>;

export function GraphCanvas({ view, direction, selectedId, onSelect }: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner
        view={view}
        direction={direction}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner({ view, direction, selectedId, onSelect }: GraphCanvasProps) {
  const reactFlow = useReactFlow();
  // A computed layout is keyed by the signature it belongs to, so a view that
  // changed since the last computation renders as pending instead of showing
  // nodes at stale positions.
  const [computed, setComputed] = useState<{
    signature: string;
    direction: "DOWN" | "RIGHT";
    positions: Positions;
  } | null>(null);

  // The effect reads the view through a ref so the layout is keyed on the
  // signature, not on an array identity a parent render could change.
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const signature = viewSignature(view);

  useEffect(() => {
    let cancelled = false;
    void layoutGraph(viewRef.current, direction).then((laidOut) => {
      if (cancelled) {
        return;
      }
      setComputed({
        signature,
        direction,
        positions: new Map(
          laidOut.nodes.map((item) => [
            item.node.id,
            { x: item.position.x, y: item.position.y, ...item.size },
          ]),
        ),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [signature, direction]);

  const ready =
    computed !== null && computed.signature === signature && computed.direction === direction;

  // A new layout brings new bounds; fit them once the browser has measured the
  // cards, so nothing sits outside the visible area.
  useEffect(() => {
    if (!ready) {
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        void reactFlow.fitView({ padding: 0.2, duration: 200 });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [computed, ready, reactFlow]);

  if (!ready) {
    return <p role="status">Graf yerleşimi hesaplanıyor…</p>;
  }

  const positions = computed.positions;

  const nodes: Node<GraphNodeData>[] = view.nodes.map((node) => {
    const placed = positions.get(node.id);
    const selected = node.id === selectedId;
    return {
      id: node.id,
      type: "graphNode",
      position: { x: placed?.x ?? 0, y: placed?.y ?? 0 },
      // React Flow takes the selection from the node object when the nodes
      // prop is rebuilt, so the selected node is marked here as well as in the
      // card data; otherwise a re-render would clear the selection and the
      // detail panel would close.
      selected,
      data: { view: node, selected, direction },
      style: { width: placed?.width ?? 190, height: placed?.height ?? 76 },
      draggable: false,
      connectable: false,
      ariaLabel: nodeAriaLabel(node),
    };
  });

  const edges: Edge[] = view.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label ?? undefined,
  }));

  return (
    <div style={{ height: 480, border: "1px solid #bbb" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        aria-label="Graf tuvali"
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        minZoom={0.2}
        onNodesChange={(changes) => {
          // With controlled nodes, React Flow reports a selection as a change
          // instead of updating its own store; applying it to the screen's
          // selectedId is what keeps the node object, the card and the detail
          // panel in agreement.
          const selectChanges = changes.filter((change) => change.type === "select");
          if (selectChanges.length === 0) {
            return;
          }
          onSelect(selectChanges.find((change) => change.selected)?.id ?? null);
        }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

/** The readable label a screen reader announces for a node. */
function nodeAriaLabel(node: GraphNode): string {
  const parts = [node.label];
  if (node.subtitle !== null) {
    parts.push(node.subtitle);
  }
  const status = graphNodeStatusLabel(node);
  if (status !== null) {
    parts.push(status);
  }
  parts.push("Düğümü seçmek için Enter");
  return parts.join(". ");
}
