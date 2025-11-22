import React from "react";

/**
 * Utility to build a trapezoid (funnel segment) polygon string
 */
function buildSegmentPoints({
  topWidth,
  bottomWidth,
  topY,
  height,
  svgWidth,
}) {
  const centerX = svgWidth / 2;
  const halfTop = topWidth / 2;
  const halfBottom = bottomWidth / 2;
  const x1 = centerX - halfTop;      // top-left
  const y1 = topY;
  const x2 = centerX + halfTop;      // top-right
  const y2 = topY;
  const x3 = centerX + halfBottom;   // bottom-right
  const y3 = topY + height;
  const x4 = centerX - halfBottom;   // bottom-left
  const y4 = topY + height;

  return `${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`;
}

const cardStyle: React.CSSProperties = {
  flex: 1,
  background: "#ffffff",
  borderRadius: "16px",
  padding: "20px 24px",
  boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const headerPillStyle: React.CSSProperties = {
  width: "100%",
  background: "#f5f7fb",
  borderRadius: "12px",
  padding: "12px 16px",
  textAlign: "center",
  fontWeight: 700,
  fontSize: "20px",
  color: "#0f172a",
};

const titleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#111827",
};

const layoutStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  gap: "12px",
};

const labelsColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "8px 0",
  fontSize: "14px",
  fontWeight: 600,
  color: "#111827",
};

const labelRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "4px",
};

interface FunnelStage {
  label: string;
  value: string;
  color: string;
}

interface FunnelCardProps {
  title: string;
  totalLabel: string;
  stages: FunnelStage[];
}

/**
 * FunnelCard component
 */
function FunnelCard({ title, totalLabel, stages }: FunnelCardProps) {
  const svgWidth = 260;
  const svgHeight = 220;

  // Predefined widths to give a neat funnel shape similar to your reference
  const topWidths = [220, 190, 160, 200];
  const bottomWidths = [190, 160, 130, 200];
  const segmentHeight = 42;
  const gap = 8;

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={headerPillStyle}>{totalLabel}</div>
      <div style={layoutStyle}>
        {/* Funnel SVG */}
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          {stages.map((stage, index) => {
            const topY = 10 + index * (segmentHeight + gap);
            const points = buildSegmentPoints({
              topWidth: topWidths[index],
              bottomWidth: bottomWidths[index],
              topY,
              height: segmentHeight,
              svgWidth,
            });

            return (
              <polygon
                key={stage.label}
                points={points}
                fill={stage.color}
                stroke="white"
                strokeWidth="2"
              />
            );
          })}
        </svg>

        {/* Labels */}
        <div style={labelsColumnStyle}>
          {stages.map((stage) => (
            <div key={stage.label} style={labelRowStyle}>
              <span>{stage.label} :</span>
              <span>{stage.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FunnelCard;



