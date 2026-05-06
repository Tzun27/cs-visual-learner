import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CS Concept Visualizer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#0a0a0a",
        color: "#fafafa",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa", marginBottom: 24 }}>
        CS Concept Visualizer
      </div>
      <div style={{ display: "flex", fontSize: 88, fontWeight: 600, lineHeight: 1.05 }}>
        Learn computer science
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 88,
          fontWeight: 600,
          lineHeight: 1.05,
          color: "#a1a1aa",
        }}
      >
        by watching it run.
      </div>
      <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa", marginTop: 36 }}>
        Step through algorithms in real time.
      </div>
    </div>,
    size,
  );
}
