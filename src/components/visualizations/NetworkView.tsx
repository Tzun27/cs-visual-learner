import type { BackpropPhase, BackpropSnapshot } from "@/lib/ml/types";

export type NetworkHighlightKind = "active" | "current" | "updated";

export type NetworkHighlight =
  | { readonly target: "node"; readonly id: NetworkNodeId; readonly kind: NetworkHighlightKind }
  | { readonly target: "edge"; readonly id: NetworkEdgeId; readonly kind: NetworkHighlightKind };

export type NetworkNodeId = "x1" | "x2" | "h1" | "h2" | "y";
export type NetworkEdgeId = "w11" | "w12" | "w21" | "w22" | "v1" | "v2" | "b1" | "b2" | "c";

export type NetworkViewProps = {
  snapshot: BackpropSnapshot;
  highlights?: readonly NetworkHighlight[];
  className?: string;
};

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 360;

const COL_X = { input: 110, hidden: 360, output: 610 } as const;
const ROW_INPUT = { x1: 90, x2: 270 } as const;
const ROW_HIDDEN = { h1: 90, h2: 270 } as const;
const ROW_OUTPUT = { y: 180 } as const;

const NODE_RADIUS = 24;

const nodePositions: Record<NetworkNodeId, { x: number; y: number }> = {
  x1: { x: COL_X.input, y: ROW_INPUT.x1 },
  x2: { x: COL_X.input, y: ROW_INPUT.x2 },
  h1: { x: COL_X.hidden, y: ROW_HIDDEN.h1 },
  h2: { x: COL_X.hidden, y: ROW_HIDDEN.h2 },
  y: { x: COL_X.output, y: ROW_OUTPUT.y },
};

type EdgeSpec = {
  readonly id: NetworkEdgeId;
  readonly from: NetworkNodeId;
  readonly to: NetworkNodeId;
  readonly weightKey: keyof BackpropSnapshot["weights"];
};

const edgeSpecs: readonly EdgeSpec[] = [
  { id: "w11", from: "x1", to: "h1", weightKey: "w11" },
  { id: "w12", from: "x2", to: "h1", weightKey: "w12" },
  { id: "w21", from: "x1", to: "h2", weightKey: "w21" },
  { id: "w22", from: "x2", to: "h2", weightKey: "w22" },
  { id: "v1", from: "h1", to: "y", weightKey: "v1" },
  { id: "v2", from: "h2", to: "y", weightKey: "v2" },
];

function fmt(value: number | undefined, digits = 2): string {
  if (value === undefined) return "—";
  return value.toFixed(digits);
}

function nodeValueLabel(snapshot: BackpropSnapshot, id: NetworkNodeId): string {
  const a = snapshot.activations;
  switch (id) {
    case "x1":
      return fmt(snapshot.inputs[0]);
    case "x2":
      return fmt(snapshot.inputs[1]);
    case "h1":
      return fmt(a.h1);
    case "h2":
      return fmt(a.h2);
    case "y":
      return fmt(a.y);
  }
}

function nodeGradientLabel(snapshot: BackpropSnapshot, id: NetworkNodeId): string | undefined {
  if (snapshot.phase !== "backward" && snapshot.phase !== "update" && snapshot.phase !== "done") {
    return undefined;
  }
  const g = snapshot.gradients;
  switch (id) {
    case "h1":
      return g.dLdh1Pre !== undefined ? `∂L/∂h₁ = ${fmt(g.dLdh1Pre)}` : undefined;
    case "h2":
      return g.dLdh2Pre !== undefined ? `∂L/∂h₂ = ${fmt(g.dLdh2Pre)}` : undefined;
    case "y":
      return g.dLdy !== undefined ? `∂L/∂y = ${fmt(g.dLdy)}` : undefined;
    default:
      return undefined;
  }
}

const palette: Record<
  NetworkHighlightKind | "default",
  { node: { fill: string; stroke: string }; edge: { stroke: string; width: number } }
> = {
  default: {
    node: { fill: "var(--background)", stroke: "var(--bar-default)" },
    edge: { stroke: "var(--bar-default)", width: 1.5 },
  },
  active: {
    node: { fill: "var(--bar-swap)", stroke: "var(--bar-swap-stroke)" },
    edge: { stroke: "var(--bar-swap-stroke)", width: 2.5 },
  },
  current: {
    node: { fill: "var(--bar-compare)", stroke: "var(--bar-compare-stroke)" },
    edge: { stroke: "var(--bar-compare-stroke)", width: 2.5 },
  },
  updated: {
    node: { fill: "var(--bar-pivot)", stroke: "var(--bar-pivot-stroke)" },
    edge: { stroke: "var(--bar-pivot-stroke)", width: 2.5 },
  },
};

function phaseLabel(phase: BackpropPhase): string {
  switch (phase) {
    case "forward":
      return "forward pass";
    case "loss":
      return "loss computed";
    case "backward":
      return "backward pass";
    case "update":
      return "weights updated";
    case "done":
      return "done";
  }
}

export function NetworkView({ snapshot, highlights = [], className }: NetworkViewProps) {
  const nodeHighlight = new Map<NetworkNodeId, NetworkHighlightKind>();
  const edgeHighlight = new Map<NetworkEdgeId, NetworkHighlightKind>();
  for (const h of highlights) {
    if (h.target === "node") nodeHighlight.set(h.id, h.kind);
    else edgeHighlight.set(h.id, h.kind);
  }

  const ariaLabel = `Backprop on a 2-2-1 MLP, ${phaseLabel(snapshot.phase)}`;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {/* edges (drawn under nodes) */}
      {edgeSpecs.map((spec) => {
        const from = nodePositions[spec.from];
        const to = nodePositions[spec.to];
        const kind = edgeHighlight.get(spec.id);
        const colors = palette[kind ?? "default"].edge;
        // Slight inset so the line ends on the node border, not centre.
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        const x1 = from.x + ux * NODE_RADIUS;
        const y1 = from.y + uy * NODE_RADIUS;
        const x2 = to.x - ux * NODE_RADIUS;
        const y2 = to.y - uy * NODE_RADIUS;
        const weight = snapshot.weights[spec.weightKey];
        return (
          <g key={`edge-${spec.id}`}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={colors.stroke}
              strokeWidth={colors.width}
              strokeOpacity={0.85}
            />
            <text
              x={(x1 + x2) / 2}
              y={(y1 + y2) / 2 - 6}
              textAnchor="middle"
              fontFamily="var(--font-mono), monospace"
              fontSize={11}
              fill="var(--foreground)"
            >
              {fmt(weight)}
            </text>
          </g>
        );
      })}

      {/* nodes */}
      {(Object.keys(nodePositions) as NetworkNodeId[]).map((id) => {
        const pos = nodePositions[id];
        const kind = nodeHighlight.get(id);
        const colors = palette[kind ?? "default"].node;
        const value = nodeValueLabel(snapshot, id);
        const gradLabel = nodeGradientLabel(snapshot, id);
        return (
          <g key={`node-${id}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={NODE_RADIUS}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={kind ? 2.5 : 1.5}
            />
            <text
              x={pos.x}
              y={pos.y - 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-mono), monospace"
              fontSize={13}
              fontWeight={600}
              fill="var(--foreground)"
            >
              {id}
            </text>
            <text
              x={pos.x}
              y={pos.y + 12}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="var(--font-mono), monospace"
              fontSize={10}
              fill="var(--foreground)"
            >
              {value}
            </text>
            {gradLabel && (
              <text
                x={pos.x}
                y={pos.y + NODE_RADIUS + 16}
                textAnchor="middle"
                fontFamily="var(--font-mono), monospace"
                fontSize={10}
                fill="var(--bar-compare-stroke)"
              >
                {gradLabel}
              </text>
            )}
          </g>
        );
      })}

      {/* loss readout (top right) when available */}
      {snapshot.loss !== undefined && (
        <text
          x={VIEWBOX_WIDTH - 16}
          y={28}
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize={12}
          fill="var(--foreground)"
        >
          L = {fmt(snapshot.loss, 3)}
        </text>
      )}

      {/* target readout (top left) */}
      <text
        x={16}
        y={28}
        fontFamily="var(--font-mono), monospace"
        fontSize={12}
        fill="var(--foreground)"
      >
        t = {fmt(snapshot.target)}
      </text>
    </svg>
  );
}
